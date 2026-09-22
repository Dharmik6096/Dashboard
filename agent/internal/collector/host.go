// collector/host.go — reads CPU, RAM, load average, uptime from /proc
package collector

import (
	"bufio"
	"fmt"
	"math"
	"os"
	"runtime"
	"strconv"
	"strings"
	"time"
)

type HostMetrics struct {
	Hostname     string  `json:"hostname"`
	OS           string  `json:"os"`
	Kernel       string  `json:"kernel"`
	Architecture string  `json:"architecture"`
	CPUCores     int     `json:"cpu_cores"`
	CPUModel     string  `json:"cpu_model"`
	CPUPercent   float64 `json:"cpu_percent"`
	Load1        float64 `json:"load_1"`
	Load5        float64 `json:"load_5"`
	Load15       float64 `json:"load_15"`
	UptimeSeconds int64   `json:"uptime_seconds"`
	RAMTotal     int64   `json:"ram_total"`
	RAMUsed      int64   `json:"ram_used"`
	RAMFree      int64   `json:"ram_free"`
	RAMCached    int64   `json:"ram_cached"`
	RAMBuffers   int64   `json:"ram_buffers"`
	RAMAvailable int64   `json:"ram_available"`
	SwapTotal    int64   `json:"swap_total"`
	SwapUsed     int64   `json:"swap_used"`
	SwapFree     int64   `json:"swap_free"`
}

// CPU stat sample for delta calculation
type cpuStat struct {
	user, nice, system, idle, iowait, irq, softirq, steal uint64
}

var prevCPUStat *cpuStat
var prevCPUTime time.Time

func CollectHost() (*HostMetrics, error) {
	m := &HostMetrics{}

	// Hostname
	if h, err := os.Hostname(); err == nil {
		m.Hostname = h
	}

	// OS and kernel
	m.OS = readOSRelease()
	m.Kernel = readKernelVersion()
	m.Architecture = runtime.GOARCH

	// CPU cores
	m.CPUCores = runtime.NumCPU()
	m.CPUModel = readCPUModel()

	// CPU usage (delta between two /proc/stat reads)
	m.CPUPercent = readCPUPercent()

	// Load average
	m.Load1, m.Load5, m.Load15 = readLoadAvg()

	// Uptime
	m.UptimeSeconds = readUptime()

	// Memory
	readMemInfo(m)

	return m, nil
}

func readCPUPercent() float64 {
	curr := readCPUStat()
	if curr == nil {
		return 0
	}
	if prevCPUStat == nil {
		prevCPUStat = curr
		prevCPUTime = time.Now()
		// Wait a tiny moment and re-read
		time.Sleep(200 * time.Millisecond)
		curr = readCPUStat()
		if curr == nil {
			return 0
		}
	}

	dUser := curr.user - prevCPUStat.user
	dNice := curr.nice - prevCPUStat.nice
	dSystem := curr.system - prevCPUStat.system
	dIdle := curr.idle - prevCPUStat.idle
	dIOWait := curr.iowait - prevCPUStat.iowait
	dIRQ := curr.irq - prevCPUStat.irq
	dSoftIRQ := curr.softirq - prevCPUStat.softirq
	dSteal := curr.steal - prevCPUStat.steal

	total := dUser + dNice + dSystem + dIdle + dIOWait + dIRQ + dSoftIRQ + dSteal
	busy := total - dIdle - dIOWait

	prevCPUStat = curr
	prevCPUTime = time.Now()

	if total == 0 {
		return 0
	}
	pct := float64(busy) / float64(total) * 100
	return math.Round(pct*100) / 100
}

func readCPUStat() *cpuStat {
	f, err := os.Open("/proc/stat")
	if err != nil {
		return nil
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "cpu ") {
			fields := strings.Fields(line)
			if len(fields) < 8 {
				return nil
			}
			parse := func(s string) uint64 { v, _ := strconv.ParseUint(s, 10, 64); return v }
			return &cpuStat{
				user: parse(fields[1]), nice: parse(fields[2]),
				system: parse(fields[3]), idle: parse(fields[4]),
				iowait: parse(fields[5]), irq: parse(fields[6]),
				softirq: parse(fields[7]), steal: func() uint64 {
					if len(fields) > 8 { return parse(fields[8]) }; return 0
				}(),
			}
		}
	}
	return nil
}

func readLoadAvg() (float64, float64, float64) {
	data, err := os.ReadFile("/proc/loadavg")
	if err != nil {
		return 0, 0, 0
	}
	fields := strings.Fields(string(data))
	if len(fields) < 3 {
		return 0, 0, 0
	}
	parse := func(s string) float64 { v, _ := strconv.ParseFloat(s, 64); return v }
	return parse(fields[0]), parse(fields[1]), parse(fields[2])
}

func readUptime() int64 {
	data, err := os.ReadFile("/proc/uptime")
	if err != nil {
		return 0
	}
	fields := strings.Fields(string(data))
	if len(fields) < 1 {
		return 0
	}
	v, _ := strconv.ParseFloat(fields[0], 64)
	return int64(v)
}

func readMemInfo(m *HostMetrics) {
	f, err := os.Open("/proc/meminfo")
	if err != nil {
		return
	}
	defer f.Close()

	kv := make(map[string]int64)
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		parts := strings.Fields(line)
		if len(parts) >= 2 {
			key := strings.TrimSuffix(parts[0], ":")
			val, _ := strconv.ParseInt(parts[1], 10, 64)
			kv[key] = val * 1024 // convert kB to bytes
		}
	}

	m.RAMTotal = kv["MemTotal"]
	m.RAMFree = kv["MemFree"]
	m.RAMCached = kv["Cached"] + kv["SReclaimable"]
	m.RAMBuffers = kv["Buffers"]
	m.RAMAvailable = kv["MemAvailable"]
	m.RAMUsed = m.RAMTotal - m.RAMAvailable
	m.SwapTotal = kv["SwapTotal"]
	m.SwapFree = kv["SwapFree"]
	m.SwapUsed = m.SwapTotal - m.SwapFree
}

func readOSRelease() string {
	f, err := os.Open("/etc/os-release")
	if err != nil {
		return "Linux"
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "PRETTY_NAME=") {
			return strings.Trim(strings.TrimPrefix(line, "PRETTY_NAME="), `"`)
		}
	}
	return "Linux"
}

func readKernelVersion() string {
	data, err := os.ReadFile("/proc/version")
	if err != nil {
		return ""
	}
	fields := strings.Fields(string(data))
	if len(fields) >= 3 {
		return fields[2]
	}
	return string(data)
}

func readCPUModel() string {
	f, err := os.Open("/proc/cpuinfo")
	if err != nil {
		return ""
	}
	defer f.Close()
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		if strings.HasPrefix(line, "model name") {
			parts := strings.SplitN(line, ":", 2)
			if len(parts) == 2 {
				return strings.TrimSpace(parts[1])
			}
		}
	}
	return fmt.Sprintf("%d cores", runtime.NumCPU())
}
