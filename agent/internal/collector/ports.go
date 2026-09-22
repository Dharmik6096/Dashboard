// collector/ports.go — reads listening TCP/UDP ports from /proc/net
package collector

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"
)

type ListeningPort struct {
	Port     int    `json:"port"`
	Protocol string `json:"protocol"`
	Process  string `json:"process"`
	PID      int    `json:"pid"`
	Address  string `json:"address"`
}

func CollectListeningPorts() []ListeningPort {
	var ports []ListeningPort
	seen := map[int]bool{}

	// Build PID → process name map
	pidProc := buildPIDProcessMap()

	for _, entry := range readNetTCP("/proc/net/tcp") {
		if seen[entry.port] { continue }
		seen[entry.port] = true
		proc, pid := findProcessForInode(entry.inode, pidProc)
		ports = append(ports, ListeningPort{
			Port:     entry.port,
			Protocol: "tcp",
			Address:  entry.addr,
			Process:  proc,
			PID:      pid,
		})
	}
	for _, entry := range readNetTCP("/proc/net/tcp6") {
		if seen[entry.port] { continue }
		seen[entry.port] = true
		proc, pid := findProcessForInode(entry.inode, pidProc)
		ports = append(ports, ListeningPort{
			Port:     entry.port,
			Protocol: "tcp6",
			Address:  entry.addr,
			Process:  proc,
			PID:      pid,
		})
	}

	return ports
}

type netEntry struct {
	port  int
	addr  string
	inode uint64
}

func readNetTCP(path string) []netEntry {
	f, err := os.Open(path)
	if err != nil {
		return nil
	}
	defer f.Close()

	var entries []netEntry
	scanner := bufio.NewScanner(f)
	first := true
	for scanner.Scan() {
		if first { first = false; continue }
		fields := strings.Fields(scanner.Text())
		if len(fields) < 10 { continue }
		state := fields[3]
		if state != "0A" { continue } // 0A = LISTEN

		localAddr := fields[1]
		inodeStr := fields[9]
		inode, _ := strconv.ParseUint(inodeStr, 10, 64)

		// Parse local addr hex:port
		parts := strings.Split(localAddr, ":")
		if len(parts) != 2 { continue }
		portHex := parts[1]
		port, _ := strconv.ParseInt(portHex, 16, 32)

		entries = append(entries, netEntry{
			port:  int(port),
			addr:  decodeAddr(parts[0]),
			inode: inode,
		})
	}
	return entries
}

func decodeAddr(hexAddr string) string {
	if len(hexAddr) == 8 {
		// IPv4
		b := make([]byte, 4)
		for i := 0; i < 4; i++ {
			val, _ := strconv.ParseUint(hexAddr[i*2:i*2+2], 16, 8)
			b[3-i] = byte(val)
		}
		return fmt.Sprintf("%d.%d.%d.%d", b[0], b[1], b[2], b[3])
	}
	return "0.0.0.0"
}

func buildPIDProcessMap() map[uint64]struct{ name string; pid int } {
	result := make(map[uint64]struct{ name string; pid int })
	procDir, err := os.Open("/proc")
	if err != nil { return result }
	defer procDir.Close()

	entries, _ := procDir.Readdir(-1)
	for _, entry := range entries {
		if !entry.IsDir() { continue }
		pid, err := strconv.Atoi(entry.Name())
		if err != nil { continue }

		// Read process name
		commData, _ := os.ReadFile(fmt.Sprintf("/proc/%d/comm", pid))
		procName := strings.TrimSpace(string(commData))

		// Read file descriptors to find inodes
		fdDir := fmt.Sprintf("/proc/%d/fd", pid)
		fds, err := os.ReadDir(fdDir)
		if err != nil { continue }

		for _, fd := range fds {
			link, err := os.Readlink(fmt.Sprintf("%s/%s", fdDir, fd.Name()))
			if err != nil { continue }
			if strings.HasPrefix(link, "socket:[") {
				inodeStr := strings.TrimSuffix(strings.TrimPrefix(link, "socket:["), "]")
				inode, _ := strconv.ParseUint(inodeStr, 10, 64)
				result[inode] = struct{ name string; pid int }{name: procName, pid: pid}
			}
		}
	}
	return result
}

func findProcessForInode(inode uint64, pidMap map[uint64]struct{ name string; pid int }) (string, int) {
	if entry, ok := pidMap[inode]; ok {
		return entry.name, entry.pid
	}
	return "unknown", 0
}
