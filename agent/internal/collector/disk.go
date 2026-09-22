// collector/disk.go — reads disk partitions and usage from /proc/mounts + statfs
package collector

import (
	"bufio"
	"os"
	"strings"
	"syscall"
)

type DiskPartition struct {
	MountPoint  string  `json:"mount_point"`
	Filesystem  string  `json:"filesystem"`
	Device      string  `json:"device"`
	Total       int64   `json:"total"`
	Used        int64   `json:"used"`
	Free        int64   `json:"free"`
	UsePercent  float64 `json:"use_percent"`
	InodeTotal  int64   `json:"inode_total"`
	InodeUsed   int64   `json:"inode_used"`
	InodeFree   int64   `json:"inode_free"`
	InodePercent float64 `json:"inode_percent"`
}

var skipFS = map[string]bool{
	"proc": true, "sysfs": true, "devtmpfs": true, "devpts": true,
	"tmpfs": true, "securityfs": true, "cgroup": true, "cgroup2": true,
	"pstore": true, "bpf": true, "autofs": true, "mqueue": true,
	"hugetlbfs": true, "debugfs": true, "fusectl": true, "configfs": true,
	"overlay": true, "nsfs": true, "ramfs": true,
}

func CollectDisk() ([]DiskPartition, error) {
	var partitions []DiskPartition

	f, err := os.Open("/proc/mounts")
	if err != nil {
		return nil, err
	}
	defer f.Close()

	seen := map[string]bool{}
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		fields := strings.Fields(line)
		if len(fields) < 3 {
			continue
		}
		device := fields[0]
		mountPoint := fields[1]
		fsType := fields[2]

		if skipFS[fsType] {
			continue
		}
		if strings.HasPrefix(device, "/dev/loop") {
			continue
		}
		if seen[mountPoint] {
			continue
		}
		seen[mountPoint] = true

		var stat syscall.Statfs_t
		if err := syscall.Statfs(mountPoint, &stat); err != nil {
			continue
		}

		total := int64(stat.Blocks) * stat.Bsize
		free := int64(stat.Bfree) * stat.Bsize
		avail := int64(stat.Bavail) * stat.Bsize
		used := total - free

		if total == 0 {
			continue
		}

		usePercent := float64(used) / float64(total) * 100
		inodeTotal := int64(stat.Files)
		inodeFree := int64(stat.Ffree)
		inodeUsed := inodeTotal - inodeFree
		inodePct := 0.0
		if inodeTotal > 0 {
			inodePct = float64(inodeUsed) / float64(inodeTotal) * 100
		}

		partitions = append(partitions, DiskPartition{
			MountPoint:   mountPoint,
			Filesystem:   fsType,
			Device:       device,
			Total:        total,
			Used:         used,
			Free:         avail,
			UsePercent:   roundF(usePercent, 1),
			InodeTotal:   inodeTotal,
			InodeUsed:    inodeUsed,
			InodeFree:    inodeFree,
			InodePercent: roundF(inodePct, 1),
		})
	}

	return partitions, nil
}

func roundF(v float64, decimals int) float64 {
	factor := 1.0
	for i := 0; i < decimals; i++ {
		factor *= 10
	}
	return float64(int(v*factor+0.5)) / factor
}
