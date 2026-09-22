// collector/network.go — reads network interface stats from /proc/net/dev
package collector

import (
	"bufio"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"
)

type NetworkInterface struct {
	Name    string  `json:"name"`
	RXBytes int64   `json:"rx_bytes"`
	TXBytes int64   `json:"tx_bytes"`
	RXRate  float64 `json:"rx_rate"`  // bytes/sec
	TXRate  float64 `json:"tx_rate"`
	RXErrors int64  `json:"rx_errors"`
	TXErrors int64  `json:"tx_errors"`
	RXDropped int64 `json:"rx_dropped"`
	TXDropped int64 `json:"tx_dropped"`
}

type TCPStats struct {
	Established int `json:"established"`
	TimeWait    int `json:"time_wait"`
	CloseWait   int `json:"close_wait"`
	Listen      int `json:"listen"`
	Total       int `json:"total"`
}

var (
	prevNetStats   map[string]NetworkInterface
	prevNetTime    time.Time
	netStatsMu     sync.Mutex
)

func CollectNetwork() ([]NetworkInterface, *TCPStats) {
	netStatsMu.Lock()
	defer netStatsMu.Unlock()

	current := readNetDev()
	now := time.Now()

	var interfaces []NetworkInterface
	for name, curr := range current {
		iface := NetworkInterface{
			Name:     name,
			RXBytes:  curr.RXBytes,
			TXBytes:  curr.TXBytes,
			RXErrors: curr.RXErrors,
			TXErrors: curr.TXErrors,
			RXDropped: curr.RXDropped,
			TXDropped: curr.TXDropped,
		}
		if prevNetStats != nil && !prevNetTime.IsZero() {
			elapsed := now.Sub(prevNetTime).Seconds()
			if elapsed > 0 {
				if prev, ok := prevNetStats[name]; ok {
					iface.RXRate = float64(curr.RXBytes-prev.RXBytes) / elapsed
					iface.TXRate = float64(curr.TXBytes-prev.TXBytes) / elapsed
					if iface.RXRate < 0 { iface.RXRate = 0 }
					if iface.TXRate < 0 { iface.TXRate = 0 }
				}
			}
		}
		interfaces = append(interfaces, iface)
	}

	prevNetStats = current
	prevNetTime = now

	tcp := readTCPStats()
	return interfaces, tcp
}

func readNetDev() map[string]NetworkInterface {
	result := make(map[string]NetworkInterface)
	f, err := os.Open("/proc/net/dev")
	if err != nil {
		return result
	}
	defer f.Close()

	scanner := bufio.NewScanner(f)
	lineNum := 0
	for scanner.Scan() {
		lineNum++
		if lineNum <= 2 {
			continue // skip headers
		}
		line := scanner.Text()
		// Format: iface: rx_bytes rx_packets rx_errs rx_drop ... tx_bytes ...
		colonIdx := strings.Index(line, ":")
		if colonIdx < 0 {
			continue
		}
		name := strings.TrimSpace(line[:colonIdx])
		if name == "lo" {
			continue
		}
		fields := strings.Fields(line[colonIdx+1:])
		if len(fields) < 16 {
			continue
		}
		parse := func(s string) int64 { v, _ := strconv.ParseInt(s, 10, 64); return v }
		result[name] = NetworkInterface{
			Name:      name,
			RXBytes:   parse(fields[0]),
			RXErrors:  parse(fields[2]),
			RXDropped: parse(fields[3]),
			TXBytes:   parse(fields[8]),
			TXErrors:  parse(fields[10]),
			TXDropped: parse(fields[11]),
		}
	}
	return result
}

func readTCPStats() *TCPStats {
	stats := &TCPStats{}
	// State codes: 01=ESTABLISHED 02=SYN_SENT 0A=LISTEN 06=TIME_WAIT 08=CLOSE_WAIT
	stateMap := map[string]string{
		"01": "established", "06": "time_wait", "08": "close_wait", "0A": "listen",
	}
	for _, path := range []string{"/proc/net/tcp", "/proc/net/tcp6"} {
		f, err := os.Open(path)
		if err != nil {
			continue
		}
		scanner := bufio.NewScanner(f)
		first := true
		for scanner.Scan() {
			if first {
				first = false
				continue
			}
			fields := strings.Fields(scanner.Text())
			if len(fields) < 4 {
				continue
			}
			state := strings.ToUpper(fields[3])
			stats.Total++
			switch stateMap[state] {
			case "established":
				stats.Established++
			case "time_wait":
				stats.TimeWait++
			case "close_wait":
				stats.CloseWait++
			case "listen":
				stats.Listen++
			}
		}
		f.Close()
	}
	return stats
}
