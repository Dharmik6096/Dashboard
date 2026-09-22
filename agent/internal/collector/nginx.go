// collector/nginx.go — nginx health monitoring (read-only)
package collector

import (
	"bufio"
	"os"
	"os/exec"
	"strings"
)

type NginxStatus struct {
	ServiceRunning bool     `json:"service_running"`
	ConfigValid    bool     `json:"config_valid"`
	ConfigErrors   []string `json:"config_errors"`
	MasterPID      int      `json:"master_pid"`
	WorkerCount    int      `json:"worker_count"`
	ErrorLogTail   []string `json:"error_log_tail"`
	ErrorLogPath   string   `json:"error_log_path"`
	AccessLogPath  string   `json:"access_log_path"`
}

func CollectNginx() *NginxStatus {
	status := &NginxStatus{}

	// Check if nginx process is running
	if pid, workers := findNginxProcesses(); pid > 0 {
		status.ServiceRunning = true
		status.MasterPID = pid
		status.WorkerCount = workers
	}

	// Test nginx config (nginx -t)
	cmd := exec.Command("nginx", "-t")
	output, err := cmd.CombinedOutput()
	outputStr := string(output)
	if err == nil && strings.Contains(outputStr, "successful") {
		status.ConfigValid = true
	} else {
		status.ConfigValid = false
		// Parse error lines
		for _, line := range strings.Split(outputStr, "\n") {
			if strings.Contains(strings.ToLower(line), "error") {
				status.ConfigErrors = append(status.ConfigErrors, strings.TrimSpace(line))
			}
		}
	}

	// Read error log tail
	errorLogPaths := []string{
		"/var/log/nginx/error.log",
		"/usr/local/nginx/logs/error.log",
	}
	for _, path := range errorLogPaths {
		if _, err := os.Stat(path); err == nil {
			status.ErrorLogPath = path
			status.ErrorLogTail = readFileLinesFromEnd(path, 20)
			break
		}
	}

	// Access log path (just report, don't read — could be huge)
	accessLogPaths := []string{"/var/log/nginx/access.log", "/usr/local/nginx/logs/access.log"}
	for _, path := range accessLogPaths {
		if _, err := os.Stat(path); err == nil {
			status.AccessLogPath = path
			break
		}
	}

	return status
}

func findNginxProcesses() (masterPID int, workerCount int) {
	procDir, err := os.Open("/proc")
	if err != nil {
		return 0, 0
	}
	defer procDir.Close()

	entries, _ := procDir.Readdir(-1)
	for _, entry := range entries {
		if !entry.IsDir() {
			continue
		}
		cmdlineData, err := os.ReadFile("/proc/" + entry.Name() + "/cmdline")
		if err != nil {
			continue
		}
		cmdline := strings.ReplaceAll(string(cmdlineData), "\x00", " ")
		if strings.Contains(cmdline, "nginx") {
			if strings.Contains(cmdline, "master") {
				pid := 0
				_, _ = parseIntFromString(entry.Name(), &pid)
				masterPID = pid
			} else if strings.Contains(cmdline, "worker") {
				workerCount++
			}
		}
	}
	return
}

func parseIntFromString(s string, out *int) (int, error) {
	n := 0
	for _, c := range s {
		if c < '0' || c > '9' {
			return n, nil
		}
		n = n*10 + int(c-'0')
	}
	if out != nil {
		*out = n
	}
	return n, nil
}
