// collector/docker.go — collects container data via Docker API socket (no docker CLI needed)
package collector

import (
	"bufio"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

type ContainerInfo struct {
	ID            string            `json:"id"`
	Name          string            `json:"name"`
	Image         string            `json:"image"`
	Status        string            `json:"status"`
	State         string            `json:"state"`
	RestartCount  int               `json:"restart_count"`
	ExitCode      int               `json:"exit_code"`
	OOMKilled     bool              `json:"oom_killed"`
	HealthStatus  string            `json:"health_status"`
	NetworkMode   string            `json:"network_mode"`
	Ports         map[string]string `json:"ports"`
	Volumes       []string          `json:"volumes"`
	Labels        map[string]string `json:"labels"`
	Env           []string          `json:"env"`
	CreatedAt     string            `json:"created_at"`
	StartedAt     string            `json:"started_at"`
}

type ContainerStats struct {
	ID           string  `json:"id"`
	Name         string  `json:"name"`
	CPUPercent   float64 `json:"cpu_percent"`
	MemUsage     int64   `json:"mem_usage"`
	MemLimit     int64   `json:"mem_limit"`
	MemPercent   float64 `json:"mem_percent"`
	NetRX        int64   `json:"net_rx"`
	NetTX        int64   `json:"net_tx"`
	BlockRead    int64   `json:"block_read"`
	BlockWrite   int64   `json:"block_write"`
	PIDs         int     `json:"pids"`
}

type ContainerProcess struct {
	PID     int     `json:"pid"`
	PPID    int     `json:"ppid"`
	User    string  `json:"user"`
	CPUPct  float64 `json:"cpu_percent"`
	MemPct  float64 `json:"mem_percent"`
	Elapsed string  `json:"elapsed"`
	Command string  `json:"command"`
	Args    string  `json:"args"`
}

type DockerVersion struct {
	Version    string `json:"version"`
	APIVersion string `json:"api_version"`
	OS         string `json:"os"`
}

var dockerClient *http.Client

func init() {
	dockerClient = &http.Client{
		Transport: &http.Transport{
			DialContext: func(ctx context.Context, _, _ string) (net.Conn, error) {
				return net.Dial("unix", "/var/run/docker.sock")
			},
		},
		Timeout: 10 * time.Second,
	}
}

func dockerGet(path string) ([]byte, error) {
	resp, err := dockerClient.Get("http://localhost" + path)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	return io.ReadAll(resp.Body)
}

func CollectDockerVersion() (*DockerVersion, error) {
	data, err := dockerGet("/version")
	if err != nil {
		return nil, err
	}
	var v struct {
		Version       string `json:"Version"`
		APIVersion    string `json:"ApiVersion"`
		Os            string `json:"Os"`
	}
	if err := json.Unmarshal(data, &v); err != nil {
		return nil, err
	}
	return &DockerVersion{Version: v.Version, APIVersion: v.APIVersion, OS: v.Os}, nil
}

func CollectContainers() ([]ContainerInfo, error) {
	data, err := dockerGet("/containers/json?all=true")
	if err != nil {
		return nil, err
	}

	var raw []map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, err
	}

	var containers []ContainerInfo
	for _, c := range raw {
		id := getString(c, "Id")
		names := getStringSlice(c, "Names")
		name := ""
		if len(names) > 0 {
			name = strings.TrimPrefix(names[0], "/")
		}

		// Get inspect for more details
		inspect := getContainerInspect(id)

		ports := make(map[string]string)
		if pm, ok := c["Ports"].([]interface{}); ok {
			for _, p := range pm {
				if pm, ok := p.(map[string]interface{}); ok {
					priv := fmt.Sprintf("%v/%v", pm["PrivatePort"], pm["Type"])
					pub := fmt.Sprintf("%v", pm["PublicPort"])
					ports[priv] = pub
				}
			}
		}

		info := ContainerInfo{
			ID:      id[:min(len(id), 12)],
			Name:    name,
			Image:   getString(c, "Image"),
			Status:  strings.ToLower(getString(c, "Status")),
			State:   strings.ToLower(getString(c, "State")),
			Labels:  getStringMap(c, "Labels"),
			Ports:   ports,
		}

		if inspect != nil {
			if state, ok := inspect["State"].(map[string]interface{}); ok {
				info.RestartCount = int(getFloat(inspect, "RestartCount"))
				info.ExitCode = int(getFloat(state, "ExitCode"))
				info.OOMKilled = getBool(state, "OOMKilled")
				info.StartedAt = getString(state, "StartedAt")

				if health, ok := state["Health"].(map[string]interface{}); ok {
					info.HealthStatus = getString(health, "Status")
				}
			}
			info.CreatedAt = getString(inspect, "Created")

			if hostConfig, ok := inspect["HostConfig"].(map[string]interface{}); ok {
				info.NetworkMode = getString(hostConfig, "NetworkMode")
			}

			if cfg, ok := inspect["Config"].(map[string]interface{}); ok {
				if env, ok := cfg["Env"].([]interface{}); ok {
					for _, e := range env {
						if es, ok := e.(string); ok {
							info.Env = append(info.Env, es)
						}
					}
				}
			}

			if mounts, ok := inspect["Mounts"].([]interface{}); ok {
				for _, m := range mounts {
					if mm, ok := m.(map[string]interface{}); ok {
						src := getString(mm, "Source")
						dst := getString(mm, "Destination")
						info.Volumes = append(info.Volumes, src+"→"+dst)
					}
				}
			}
		}

		containers = append(containers, info)
	}
	return containers, nil
}

func getContainerInspect(id string) map[string]interface{} {
	data, err := dockerGet("/containers/" + id + "/json")
	if err != nil {
		return nil
	}
	var result map[string]interface{}
	json.Unmarshal(data, &result)
	return result
}

func CollectContainerStats() ([]ContainerStats, error) {
	// Get list of running containers
	data, err := dockerGet("/containers/json")
	if err != nil {
		return nil, err
	}
	var raw []map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, err
	}

	var stats []ContainerStats
	for _, c := range raw {
		id := getString(c, "Id")
		name := ""
		if names := getStringSlice(c, "Names"); len(names) > 0 {
			name = strings.TrimPrefix(names[0], "/")
		}

		s := getContainerStats(id, name)
		if s != nil {
			stats = append(stats, *s)
		}
	}
	return stats, nil
}

func getContainerStats(id, name string) *ContainerStats {
	data, err := dockerGet("/containers/" + id + "/stats?stream=false")
	if err != nil {
		return nil
	}

	var raw map[string]interface{}
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil
	}

	// CPU calculation
	cpuPct := 0.0
	if cpuStats, ok := raw["cpu_stats"].(map[string]interface{}); ok {
		if preCPU, ok := raw["precpu_stats"].(map[string]interface{}); ok {
			cpuDelta := getNestedFloat(cpuStats, "cpu_usage", "total_usage") -
				getNestedFloat(preCPU, "cpu_usage", "total_usage")
			sysDelta := getFloat(cpuStats, "system_cpu_usage") -
				getFloat(preCPU, "system_cpu_usage")
			numCPUs := getNestedFloat(cpuStats, "online_cpus", "")
			if numCPUs == 0 {
				if percpu, ok := cpuStats["cpu_usage"].(map[string]interface{}); ok {
					if perList, ok := percpu["percpu_usage"].([]interface{}); ok {
						numCPUs = float64(len(perList))
					}
				}
			}
			if sysDelta > 0 && numCPUs > 0 {
				cpuPct = (cpuDelta / sysDelta) * numCPUs * 100.0
			}
		}
	}

	// Memory
	memUsage := int64(0)
	memLimit := int64(0)
	if memStats, ok := raw["memory_stats"].(map[string]interface{}); ok {
		usage := int64(getFloat(memStats, "usage"))
		// Subtract cache from usage (Docker does this)
		if statsInner, ok := memStats["stats"].(map[string]interface{}); ok {
			cache := int64(getFloat(statsInner, "cache"))
			usage -= cache
		}
		memUsage = usage
		memLimit = int64(getFloat(memStats, "limit"))
	}
	memPct := 0.0
	if memLimit > 0 {
		memPct = float64(memUsage) / float64(memLimit) * 100
	}

	// Network (sum all interfaces)
	netRX, netTX := int64(0), int64(0)
	if networks, ok := raw["networks"].(map[string]interface{}); ok {
		for _, v := range networks {
			if iface, ok := v.(map[string]interface{}); ok {
				netRX += int64(getFloat(iface, "rx_bytes"))
				netTX += int64(getFloat(iface, "tx_bytes"))
			}
		}
	}

	// Block I/O
	blockRead, blockWrite := int64(0), int64(0)
	if blkio, ok := raw["blkio_stats"].(map[string]interface{}); ok {
		if ioService, ok := blkio["io_service_bytes_recursive"].([]interface{}); ok {
			for _, entry := range ioService {
				if e, ok := entry.(map[string]interface{}); ok {
					switch getString(e, "op") {
					case "read", "Read":
						blockRead += int64(getFloat(e, "value"))
					case "write", "Write":
						blockWrite += int64(getFloat(e, "value"))
					}
				}
			}
		}
	}

	pids := 0
	if pidsStats, ok := raw["pids_stats"].(map[string]interface{}); ok {
		pids = int(getFloat(pidsStats, "current"))
	}

	return &ContainerStats{
		ID:         id[:min(len(id), 12)],
		Name:       name,
		CPUPercent: roundF(cpuPct, 2),
		MemUsage:   memUsage,
		MemLimit:   memLimit,
		MemPercent: roundF(memPct, 1),
		NetRX:      netRX,
		NetTX:      netTX,
		BlockRead:  blockRead,
		BlockWrite: blockWrite,
		PIDs:       pids,
	}
}

// CollectContainerTop reads processes inside a container via host /proc filesystem.
// Works even without ps inside the container.
func CollectContainerTop(containerID string) ([]ContainerProcess, error) {
	// Get the container's cgroup path to identify its PIDs
	fullID, err := resolveContainerFullID(containerID)
	if err != nil {
		return nil, err
	}

	pids, err := findContainerPIDs(fullID)
	if err != nil {
		return nil, err
	}

	var processes []ContainerProcess
	for _, pid := range pids {
		proc, err := readProcInfo(pid)
		if err != nil {
			continue
		}
		processes = append(processes, *proc)
	}

	// Sort by CPU descending
	sortByField(processes)
	return processes, nil
}

func resolveContainerFullID(shortID string) (string, error) {
	data, err := dockerGet("/containers/" + shortID + "/json")
	if err != nil {
		return "", err
	}
	var inspect map[string]interface{}
	if err := json.Unmarshal(data, &inspect); err != nil {
		return "", err
	}
	id := getString(inspect, "Id")
	if id == "" {
		return "", fmt.Errorf("container not found: %s", shortID)
	}
	return id, nil
}

func findContainerPIDs(containerID string) ([]int, error) {
	var pids []int
	// Walk /proc looking for processes in this container's cgroup
	procDir, err := os.Open("/proc")
	if err != nil {
		return nil, err
	}
	defer procDir.Close()

	entries, err := procDir.Readdir(-1)
	if err != nil {
		return nil, err
	}

	shortID := containerID
	if len(containerID) > 12 {
		shortID = containerID[:12]
	}

	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		pid, err := strconv.Atoi(entry.Name())
		if err != nil {
			continue
		}
		cgroupFile := fmt.Sprintf("/proc/%d/cgroup", pid)
		data, err := os.ReadFile(cgroupFile)
		if err != nil {
			continue
		}
		if strings.Contains(string(data), containerID) || strings.Contains(string(data), shortID) {
			pids = append(pids, pid)
		}
	}
	return pids, nil
}

func readProcInfo(pid int) (*ContainerProcess, error) {
	// Read /proc/pid/stat for CPU and state
	statData, err := os.ReadFile(fmt.Sprintf("/proc/%d/stat", pid))
	if err != nil {
		return nil, err
	}

	// Read /proc/pid/cmdline for full command
	cmdData, _ := os.ReadFile(fmt.Sprintf("/proc/%d/cmdline", pid))
	cmd := strings.ReplaceAll(string(cmdData), "\x00", " ")
	cmd = strings.TrimSpace(cmd)

	// Read /proc/pid/status for user and ppid
	statusData, _ := os.ReadFile(fmt.Sprintf("/proc/%d/status", pid))
	ppid := 0
	user := "unknown"
	for _, line := range strings.Split(string(statusData), "\n") {
		if strings.HasPrefix(line, "PPid:") {
			fmt.Sscanf(strings.TrimPrefix(line, "PPid:"), " %d", &ppid)
		}
	}

	// Parse /proc/pid/stat
	statStr := string(statData)
	// Format: pid (comm) state ppid ...
	fields := strings.Fields(statStr)
	if len(fields) < 14 {
		return nil, fmt.Errorf("short stat")
	}

	// Calculate CPU usage from utime + stime
	utime, _ := strconv.ParseInt(fields[13], 10, 64)
	stime, _ := strconv.ParseInt(fields[14], 10, 64)
	startTime, _ := strconv.ParseInt(fields[21], 10, 64)

	// Get system uptime and clock ticks
	uptimeData, _ := os.ReadFile("/proc/uptime")
	uptimeSecs := 0.0
	fmt.Sscanf(string(uptimeData), "%f", &uptimeSecs)
	clkTck := int64(100) // typically 100 on Linux
	elapsed := uptimeSecs - float64(startTime)/float64(clkTck)
	cpuTime := float64(utime+stime) / float64(clkTck)
	cpuPct := 0.0
	if elapsed > 0 {
		cpuPct = (cpuTime / elapsed) * 100
	}

	elapsedStr := formatElapsed(int64(elapsed))

	// Try to get user from uid
	uidData, _ := os.ReadFile(fmt.Sprintf("/proc/%d/loginuid", pid))
	if string(uidData) != "" && string(uidData) != "4294967295" {
		user = "uid:" + strings.TrimSpace(string(uidData))
	}

	// Short command for display
	shortCmd := cmd
	if len(shortCmd) > 100 {
		shortCmd = shortCmd[:100] + "..."
	}

	return &ContainerProcess{
		PID:     pid,
		PPID:    ppid,
		User:    user,
		CPUPct:  roundF(cpuPct, 1),
		Elapsed: elapsedStr,
		Command: shortCmd,
	}, nil
}

func formatElapsed(seconds int64) string {
	if seconds < 60 {
		return fmt.Sprintf("%ds", seconds)
	} else if seconds < 3600 {
		return fmt.Sprintf("%dm", seconds/60)
	} else if seconds < 86400 {
		return fmt.Sprintf("%dh", seconds/3600)
	}
	return fmt.Sprintf("%dd", seconds/86400)
}

func sortByField(procs []ContainerProcess) {
	for i := 1; i < len(procs); i++ {
		for j := i; j > 0 && procs[j].CPUPct > procs[j-1].CPUPct; j-- {
			procs[j], procs[j-1] = procs[j-1], procs[j]
		}
	}
}

func CollectContainerLogs(containerID string, tail int, since string) ([]string, error) {
	path := fmt.Sprintf("/containers/%s/logs?stdout=true&stderr=true&tail=%d&timestamps=true", containerID, tail)
	if since != "" {
		path += "&since=" + since
	}

	resp, err := dockerClient.Get("http://localhost" + path)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	var lines []string
	scanner := bufio.NewScanner(resp.Body)
	for scanner.Scan() {
		line := scanner.Text()
		// Docker log stream prepends 8-byte header; skip non-printable prefix
		if len(line) > 8 {
			cleaned := strings.Map(func(r rune) rune {
				if r < 32 && r != '\t' && r != '\n' { return -1 }
				return r
			}, line)
			lines = append(lines, strings.TrimSpace(cleaned))
		}
	}
	return lines, nil
}

// ─── Helpers ───────────────────────────────────────────────────────────────

func getString(m map[string]interface{}, key string) string {
	if v, ok := m[key]; ok {
		if s, ok := v.(string); ok {
			return s
		}
	}
	return ""
}

func getStringSlice(m map[string]interface{}, key string) []string {
	if v, ok := m[key]; ok {
		if sl, ok := v.([]interface{}); ok {
			var result []string
			for _, item := range sl {
				if s, ok := item.(string); ok {
					result = append(result, s)
				}
			}
			return result
		}
	}
	return nil
}

func getStringMap(m map[string]interface{}, key string) map[string]string {
	result := make(map[string]string)
	if v, ok := m[key]; ok {
		if sm, ok := v.(map[string]interface{}); ok {
			for k, val := range sm {
				result[k] = fmt.Sprintf("%v", val)
			}
		}
	}
	return result
}

func getFloat(m map[string]interface{}, key string) float64 {
	if v, ok := m[key]; ok {
		switch f := v.(type) {
		case float64:
			return f
		case int:
			return float64(f)
		}
	}
	return 0
}

func getBool(m map[string]interface{}, key string) bool {
	if v, ok := m[key]; ok {
		if b, ok := v.(bool); ok {
			return b
		}
	}
	return false
}

func getNestedFloat(m map[string]interface{}, key1, key2 string) float64 {
	if v, ok := m[key1]; ok {
		if inner, ok := v.(map[string]interface{}); ok {
			return getFloat(inner, key2)
		}
	}
	return 0
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}

func CollectDockerDiskUsage() map[string]interface{} {
	data, err := dockerGet("/system/df")
	if err != nil {
		return nil
	}
	var result map[string]interface{}
	json.Unmarshal(data, &result)
	return result
}

func readFileLines(path string, maxLines int) []string {
	f, err := os.Open(path)
	if err != nil {
		return nil
	}
	defer f.Close()

	var lines []string
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		lines = append(lines, scanner.Text())
	}
	if len(lines) > maxLines {
		return lines[len(lines)-maxLines:]
	}
	return lines
}

func readFileLinesFromEnd(path string, n int) []string {
	f, err := os.Open(path)
	if err != nil {
		return nil
	}
	defer f.Close()

	// Read to end, keep last n lines
	var all []string
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		all = append(all, scanner.Text())
	}
	if len(all) <= n {
		return all
	}
	return all[len(all)-n:]
}
