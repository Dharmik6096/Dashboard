// collector/cron.go — reads host cron jobs from crontab and /etc/cron.d/
package collector

import (
	"bufio"
	"os"
	"os/exec"
	"strings"
)

type CronJob struct {
	Schedule   string `json:"schedule"`
	Command    string `json:"command"`
	User       string `json:"user"`
	Source     string `json:"source"`
	IsRunning  bool   `json:"is_running"`
	RunningPID int    `json:"running_pid"`
}

func CollectCronJobs() []CronJob {
	var jobs []CronJob

	// Read system crontab
	systemJobs := readCrontab("/etc/crontab", "root")
	jobs = append(jobs, systemJobs...)

	// Read /etc/cron.d/
	cronD, _ := os.ReadDir("/etc/cron.d")
	for _, entry := range cronD {
		if entry.IsDir() { continue }
		path := "/etc/cron.d/" + entry.Name()
		j := readCrontab(path, "")
		jobs = append(jobs, j...)
	}

	// Read root crontab via crontab -l
	if out, err := exec.Command("crontab", "-l").Output(); err == nil {
		for _, line := range strings.Split(string(out), "\n") {
			line = strings.TrimSpace(line)
			if line == "" || strings.HasPrefix(line, "#") {
				continue
			}
			jobs = append(jobs, CronJob{
				Schedule: extractSchedule(line),
				Command:  extractCommand(line),
				User:     "root",
				Source:   "crontab -l",
			})
		}
	}

	// Mark running jobs by checking /proc
	runningCmds := getRunningCommands()
	for i, job := range jobs {
		for _, proc := range runningCmds {
			if strings.Contains(proc.cmd, job.Command) || strings.Contains(job.Command, extractBaseCmd(proc.cmd)) {
				jobs[i].IsRunning = true
				jobs[i].RunningPID = proc.pid
				break
			}
		}
	}

	return jobs
}

type runningProc struct {
	pid int
	cmd string
}

func getRunningCommands() []runningProc {
	var procs []runningProc
	procDir, err := os.Open("/proc")
	if err != nil { return procs }
	defer procDir.Close()
	entries, _ := procDir.Readdir(-1)
	for _, e := range entries {
		if !e.IsDir() { continue }
		pid := 0
		parseIntFromString(e.Name(), &pid)
		if pid == 0 { continue }
		cmdData, _ := os.ReadFile("/proc/" + e.Name() + "/cmdline")
		cmd := strings.ReplaceAll(string(cmdData), "\x00", " ")
		cmd = strings.TrimSpace(cmd)
		if cmd != "" {
			procs = append(procs, runningProc{pid: pid, cmd: cmd})
		}
	}
	return procs
}

func readCrontab(path, defaultUser string) []CronJob {
	var jobs []CronJob
	f, err := os.Open(path)
	if err != nil { return jobs }
	defer f.Close()

	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") || strings.HasPrefix(line, "SHELL=") ||
			strings.HasPrefix(line, "PATH=") || strings.HasPrefix(line, "MAILTO=") {
			continue
		}
		fields := strings.Fields(line)
		if len(fields) < 6 { continue }

		schedule := strings.Join(fields[:5], " ")
		user := defaultUser
		cmd := strings.Join(fields[5:], " ")
		// If system crontab format (has user field)
		if defaultUser == "root" && len(fields) >= 7 {
			user = fields[5]
			cmd = strings.Join(fields[6:], " ")
		}

		jobs = append(jobs, CronJob{
			Schedule: schedule,
			Command:  cmd,
			User:     user,
			Source:   path,
		})
	}
	return jobs
}

func extractSchedule(line string) string {
	fields := strings.Fields(line)
	if len(fields) >= 5 {
		return strings.Join(fields[:5], " ")
	}
	return ""
}

func extractCommand(line string) string {
	fields := strings.Fields(line)
	if len(fields) > 5 {
		return strings.Join(fields[5:], " ")
	}
	return line
}

func extractBaseCmd(cmd string) string {
	parts := strings.Fields(cmd)
	if len(parts) == 0 { return "" }
	base := parts[0]
	// Extract last path component
	if idx := strings.LastIndex(base, "/"); idx >= 0 {
		return base[idx+1:]
	}
	return base
}
