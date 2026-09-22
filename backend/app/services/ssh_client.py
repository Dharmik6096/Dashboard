"""
SSH Client — provides an agent-less monitoring fallback using safe read-only commands.
"""
import asyncssh
import json
import structlog
import asyncio
from typing import Any, Optional
import time

log = structlog.get_logger()

class SSHClient:
    def __init__(self, host: str, port: int, username: str, password: Optional[str] = None, private_key: Optional[str] = None, expected_fingerprint: Optional[str] = None):
        self.host = host
        self.port = port
        self.username = username
        self.password = password
        self.private_key = private_key
        self.expected_fingerprint = expected_fingerprint
        self.conn = None
        self._last_cpu_idle = 0
        self._last_cpu_total = 0

    async def connect(self):
        try:
            self.conn = await asyncssh.connect(
                self.host,
                port=self.port,
                username=self.username,
                password=self.password,
                client_keys=[self.private_key] if self.private_key else None,
                known_hosts=None # In a full prod version this verifies expected_fingerprint
            )
            # Check OS Support
            os_check = await self._run_safe_command("cat /etc/os-release")
            if "Ubuntu" not in os_check and "Debian" not in os_check:
                raise ValueError("Unsupported OS. Only Ubuntu and Debian are supported in Phase 3.")
            return True
        except Exception as e:
            log.error("ssh_connect_error", host=self.host, error=str(e))
            raise

    async def disconnect(self):
        if self.conn:
            self.conn.close()

    async def _run_command_full(self, command: str, timeout: int = 15, use_sudo: bool = False) -> tuple[str, str, int]:
        if not self.conn:
            raise ConnectionError("Not connected to SSH")
        
        # Strict whitelist
        allowed_prefixes = [
            "cat /proc/stat", "cat /proc/meminfo", "cat /proc/net/dev", "cat /etc/os-release",
            "grep -c ^processor /proc/cpuinfo", "hostname", "uptime", "df -k", "df -h", "df -hP", "df -P", "df -iP", "df ",
            "free -m", "free -b", "docker ps", "docker stats", "docker inspect", "docker top",
            "docker logs", "docker info", "systemctl is-active", "systemctl show", "crontab -l",
            "echo", "which docker", "docker --version", "ps aux", "ps -eo", "nginx -T",
            "ss -lntup", "ss -lntu", "ss -H -lntup", "ss -H -lntu",  # port discovery variants
            "du ", "ls ", "findmnt", "lsblk", "stat ", "mount", "find ",
            "docker images", "docker volume ls", "docker system df", "tail "
        ]
        
        command_clean = command.strip()
        is_allowed = any(command_clean.startswith(prefix) for prefix in allowed_prefixes)
        
        # Strict read-only enforcement for docker exec
        if command_clean.startswith("docker exec "):
            import re
            # Only allow specific read-only tools inside docker exec
            if re.match(r"^docker exec(?: \-[a-zA-Z]+)* [a-zA-Z0-9_\-]+ (curl|rabbitmq-diagnostics -q status|rabbitmqctl list_queues|redis-cli)", command_clean):
                is_allowed = True
                
        if not is_allowed:
            raise ValueError(f"Command '{command_clean}' is not in the allowed monitoring whitelist.")
            
        final_cmd = command
        input_data = None
        if use_sudo:
            if self.password:
                final_cmd = f"sudo -k -S {command}"
                input_data = self.password + "\n"
            else:
                final_cmd = f"sudo -n {command}"
            
        result = await asyncio.wait_for(self.conn.run(final_cmd, check=False, input=input_data), timeout=timeout)
        return (result.stdout or "", result.stderr or "", result.exit_status)

    async def _run_safe_command(self, command: str, timeout: int = 15, use_sudo: bool = False) -> str:
        out, err, code = await self._run_command_full(command, timeout, use_sudo)
        if code != 0 and code != 1: # 1 is often grep/no result
            log.debug("ssh_command_failed", host=self.host, command=command, stderr=err)
        return out

    async def _run_with_sudo_fallback(self, command: str, command_type: str, timeout: int = 15) -> tuple[str, str, int]:
        out, err, code = await self._run_command_full(command, timeout, use_sudo=False)
        
        if code != 0 and ("permission denied" in err.lower() or "permission denied" in out.lower() or "cannot connect to the docker daemon" in err.lower() or "cannot connect to the docker daemon" in out.lower() or "dial unix /var/run/docker.sock" in err.lower()):
            if self.password:
                out_sudo, err_sudo, code_sudo = await self._run_command_full(command, timeout, use_sudo=True)
                log.info("audit_sudo_read", 
                         server=self.host, 
                         command_type=command_type, 
                         result="SUCCESS" if code_sudo == 0 else "FAILED",
                         command=command)
                return out_sudo, err_sudo, code_sudo
                
        return out, err, code


    async def test_connection(self) -> dict:
        failed_step = "Network/SSH"
        try:
            await self.connect()
            failed_step = "Authentication"
            # connect() covers authentication if it succeeds
            
            failed_step = "Linux OS Check"
            os_info = await self._run_safe_command("cat /etc/os-release")
            hostname = await self._run_safe_command("hostname")
            
            failed_step = "Metrics Collection"
            # Get CPU Cores
            cores_out = await self._run_safe_command("grep -c ^processor /proc/cpuinfo")
            cpu_cores = int(cores_out.strip()) if cores_out.strip().isdigit() else 1
            
            # Get RAM
            free_out = await self._run_safe_command("free -b")
            ram_total = 0
            if "Mem:" in free_out:
                parts = free_out.split("\n")[1].split()
                ram_total = int(parts[1])
                
            # Check Docker Status
            docker_info = (await self._run_with_sudo_fallback("docker info", "Docker Info"))[0]
            
            os_name = "Unknown"
            if "PRETTY_NAME" in os_info:
                for line in os_info.split("\n"):
                    if line.startswith("PRETTY_NAME="):
                        os_name = line.split("=")[1].strip('"')
            elif "Ubuntu" in os_info:
                os_name = "Ubuntu"
            elif "Debian" in os_info:
                os_name = "Debian"
                
            has_docker = "Server Version" in docker_info
            await self.disconnect()
            
            return {
                "success": True,
                "hostname": hostname.strip(),
                "os": os_name,
                "docker_available": has_docker,
                "cpu_cores": cpu_cores,
                "ram_total": ram_total
            }
        except Exception as e:
            return {
                "success": False,
                "reason": str(e),
                "failed_step": failed_step
            }

    async def host_metrics(self) -> dict[str, Any] | None:
        try:
            await self.connect()
            
            # Memory via free
            free_out = await self._run_safe_command("free -b")
            ram_total = 0
            ram_used = 0
            if "Mem:" in free_out:
                parts = free_out.split("\n")[1].split()
                ram_total = int(parts[1])
                ram_used = int(parts[2])
                
            # CPU via /proc/stat
            stat_out = await self._run_safe_command("cat /proc/stat")
            cpu_percent = 0.0
            if stat_out:
                cpu_line = stat_out.split("\n")[0].split()
                if cpu_line[0] == "cpu":
                    # user, nice, system, idle, iowait, irq, softirq, steal
                    idle = float(cpu_line[4]) + float(cpu_line[5])
                    total = sum(float(x) for x in cpu_line[1:8])
                    if self._last_cpu_total > 0:
                        idle_delta = idle - self._last_cpu_idle
                        total_delta = total - self._last_cpu_total
                        if total_delta > 0:
                            cpu_percent = 100.0 * (1.0 - idle_delta / total_delta)
                    self._last_cpu_idle = idle
                    self._last_cpu_total = total

            # Load via uptime
            uptime_out = await self._run_safe_command("uptime")
            load_1 = 0.0
            load_5 = 0.0
            load_15 = 0.0
            if "load average:" in uptime_out:
                loads = uptime_out.split("load average:")[1].split(",")
                load_1 = float(loads[0].strip())
                load_5 = float(loads[1].strip())
                load_15 = float(loads[2].strip())

            await self.disconnect()
            return {
                "cpu_percent": round(cpu_percent, 2),
                "ram_total": ram_total,
                "ram_used": ram_used,
                "load_1": load_1,
                "load_5": load_5,
                "load_15": load_15
            }
        except Exception as e:
            log.error("ssh_host_metrics_error", host=self.host, error=str(e))
            return None

    async def disk_metrics(self) -> dict[str, Any] | None:
        try:
            await self.connect()
            df_out = await self._run_safe_command("df -P -k -x tmpfs -x devtmpfs -x squashfs -x overlay -x shm")
            disks = []
            lines = df_out.strip().split("\n")
            for line in lines[1:]:
                parts = line.split()
                if len(parts) >= 6:
                    disks.append({
                        "device": parts[0],
                        "total": int(parts[1]) * 1024,
                        "used": int(parts[2]) * 1024,
                        "free": int(parts[3]) * 1024,
                        "mountpoint": parts[5]
                    })
            await self.disconnect()
            return {"disks": disks}
        except Exception:
            return None

    async def network_metrics(self) -> dict[str, Any] | None:
        try:
            await self.connect()
            net_out = await self._run_safe_command("cat /proc/net/dev")
            interfaces = []
            lines = net_out.strip().split("\n")
            for line in lines[2:]:
                if ":" in line:
                    parts = line.split(":")
                    iface = parts[0].strip()
                    stats = parts[1].split()
                    interfaces.append({
                        "name": iface,
                        "rx_bytes": int(stats[0]),
                        "tx_bytes": int(stats[8])
                    })
            await self.disconnect()
            return {"interfaces": interfaces}
        except Exception:
            return None

    async def snapshot(self) -> dict[str, Any] | None:
        """Collect multiple metrics in one session to reduce overhead."""
        try:
            await self.connect()
            
            # Inline commands to prevent reconnects/disconnects
            # Using user's preferred fast awk scripts
            bash_script = """
echo "Hostname: $(hostname)"
echo "CPU: $(vmstat 1 2 | tail -1 | awk '{printf "%.1f%%", 100-$15}')"
echo "RAM: $(free | awk '/^Mem:/ {printf "%.1f%%", (1-$7/$2)*100}')"
echo "RAM_TOTAL_BYTES: $(free -b | awk '/^Mem:/ {print $2}')"
echo "RAM_USED_BYTES: $(free -b | awk '/^Mem:/ {print $3}')"
echo "LOAD: $(cat /proc/loadavg | awk '{print $1 "," $2 "," $3}')"
echo "UPTIME_SECONDS: $(cat /proc/uptime | awk '{print int($1)}')"
echo "OS: $(cat /etc/os-release | grep '^PRETTY_NAME=' | cut -d= -f2 | tr -d '"')"
echo "ARCH: $(uname -m)"
echo "CORES: $(grep -c ^processor /proc/cpuinfo)"
"""
            combined_out = await self._run_safe_command(bash_script)
            
            # Parse the combined output
            cpu_percent = 0.0
            ram_percent = 0.0
            ram_total_bytes = 0
            ram_used_bytes = 0
            load_1 = None; load_5 = None; load_15 = None
            uptime_seconds = None
            os_name = "Unknown"
            architecture = "Unknown"
            cpu_cores = 1
            disks = []
            
            for line in (combined_out or "").split("\n"):
                line = line.strip()
                if line.startswith("CPU:"):
                    try:
                        cpu_percent = float(line.split("CPU:")[1].strip().replace("%", ""))
                    except: pass
                elif line.startswith("RAM:"):
                    try:
                        ram_percent = float(line.split("RAM:")[1].strip().replace("%", ""))
                    except: pass
                elif line.startswith("RAM_TOTAL_BYTES:"):
                    try:
                        ram_total_bytes = int(line.split("RAM_TOTAL_BYTES:")[1].strip())
                    except: pass
                elif line.startswith("RAM_USED_BYTES:"):
                    try:
                        ram_used_bytes = int(line.split("RAM_USED_BYTES:")[1].strip())
                    except: pass
                elif line.startswith("LOAD:"):
                    try:
                        load_parts = line.split("LOAD:")[1].strip().split(",")
                        if len(load_parts) >= 3:
                            load_1 = float(load_parts[0])
                            load_5 = float(load_parts[1])
                            load_15 = float(load_parts[2])
                    except: pass
                elif line.startswith("UPTIME_SECONDS:"):
                    try:
                        uptime_seconds = int(line.split("UPTIME_SECONDS:")[1].strip())
                    except: pass
                elif line.startswith("OS:"):
                    os_name = line.split("OS:")[1].strip() or "Unknown"
                elif line.startswith("ARCH:"):
                    architecture = line.split("ARCH:")[1].strip() or "Unknown"
                elif line.startswith("CORES:"):
                    try:
                        cpu_cores = int(line.split("CORES:")[1].strip())
                    except: pass
            
            # We still need network interfaces from /proc/net/dev to not break network graphs
            net_out = await self._run_safe_command("cat /proc/net/dev")
            interfaces = []
            for line in (net_out or "").strip().split("\n")[2:]:
                if ":" in line:
                    parts = line.split(":")
                    iface = parts[0].strip()
                    stats = parts[1].split()
                    interfaces.append({"name": iface, "rx_bytes": int(stats[0]), "tx_bytes": int(stats[8])})
                    
            # For RAM total/used expected by the backend
            ram_total = ram_total_bytes if ram_total_bytes > 0 else 100
            ram_used = ram_used_bytes if ram_used_bytes > 0 else ram_percent


            # Parse Docker
            containers = []
            container_stats = []
            docker_status = "UNKNOWN"
            try:
                # Step 2 & 3: Container Discovery and Status
                docker_ps_out, docker_ps_err, docker_ps_code = await self._run_with_sudo_fallback("docker ps -a --no-trunc --format \'{{.ID}}|{{.Names}}|{{.Image}}|{{.State}}|{{.Status}}|{{.Ports}}|{{.CreatedAt}}\'", "Docker PS")
                
                if docker_ps_code == 127 or "command not found" in docker_ps_err.lower():
                    docker_status = "NOT INSTALLED"
                elif "permission denied" in docker_ps_err.lower() or "permission denied" in docker_ps_out.lower():
                    docker_status = "PERMISSION DENIED"
                elif "cannot connect" in docker_ps_err.lower() or "is the docker daemon running" in docker_ps_err.lower():
                    docker_status = "UNAVAILABLE"
                elif docker_ps_code == 0:
                    docker_status = "AVAILABLE"
                else:
                    docker_status = "UNAVAILABLE"

                if docker_ps_out and docker_status == "AVAILABLE":
                    for line in docker_ps_out.strip().split("\n"):
                        if not line: continue
                        try:
                            parts = line.split("|", 6)
                            if len(parts) < 7: continue
                            full_id = parts[0]
                            # Determine Health
                            status_str = parts[4]
                            health = "NO HEALTHCHECK"
                            if "(healthy)" in status_str:
                                health = "HEALTHY"
                            elif "(unhealthy)" in status_str:
                                health = "UNHEALTHY"
                            elif "(health: starting)" in status_str:
                                health = "STARTING"
                                
                            containers.append({
                                "full_id": full_id,
                                "short_id": full_id[:12] if len(full_id) >= 12 else full_id,
                                "name": parts[1],
                                "image": parts[2],
                                "state": parts[3].upper(), # RUNNING, EXITED, etc.
                                "status_text": status_str,
                                "health": health,
                                "ports": parts[5],
                                "created_at": parts[6]
                            })
                        except Exception as parse_e:
                            log.debug("docker_ps_parse_error", error=str(parse_e), line=line)
                
                # Step 4: Container Live Metrics
                if docker_status == "AVAILABLE":
                    docker_stats_out = (await self._run_with_sudo_fallback("docker stats --no-stream --no-trunc --format \'{{json .}}\'", "Docker Stats"))[0]
                    if docker_stats_out:
                        for line in docker_stats_out.strip().split("\n"):
                            if not line: continue
                            try:
                                s = json.loads(line)
                                full_id = s.get("ID", "")
                                
                                # Parse Memory
                                mem_usage_str = s.get("MemUsage", "0B / 0B")
                                # Example: "15.4MiB / 2GiB"
                                
                                # Parse Network
                                net_io = s.get("NetIO", "0B / 0B")
                                
                                # Parse Block IO
                                block_io = s.get("BlockIO", "0B / 0B")
                                
                                container_stats.append({
                                    "full_id": full_id,
                                    "cpu_percent": float(s.get("CPUPerc", "0%").strip('%')),
                                    "mem_percent": float(s.get("MemPerc", "0%").strip('%')),
                                    "mem_usage_str": mem_usage_str,
                                    "net_io": net_io,
                                    "block_io": block_io,
                                    "pids": int(s.get("PIDs", "0")) if str(s.get("PIDs", "0")).isdigit() else 0
                                })
                            except Exception as parse_e:
                                log.debug("docker_stats_parse_error", error=str(parse_e), line=line)
            except Exception as e:
                import traceback
                log.warning("ssh_docker_parse_error", host=self.host, error=str(e), traceback=traceback.format_exc())
                
            # Disk Collection Logic
            try:
                df_cmd = "df -P -B1 -x tmpfs -x devtmpfs -x squashfs -x overlay -x shm"
                df_out, df_err, df_code = await self._run_command_full(df_cmd, timeout=15, use_sudo=False)
                if df_code == 0 and df_out.strip():
                    lines = df_out.strip().split("\n")
                    for line in lines[1:]:
                        parts = line.split()
                        if len(parts) >= 6:
                            disk_fs = parts[0]
                            disk_total = int(parts[1])
                            disk_used = int(parts[2])
                            disk_avail = int(parts[3])
                            disk_use_pct = float(parts[4].replace("%", ""))
                            disk_mount = parts[5]
                            disks.append({
                                "device": disk_fs,
                                "filesystem": disk_fs,
                                "total": disk_total,
                                "used": disk_used,
                                "free": disk_avail,
                                "use_percent": disk_use_pct,
                                "mount_point": disk_mount,
                                "source": "main_disk" if disk_mount == "/" else "secondary",
                                "is_docker_data": False
                            })
                            
                # Determine Docker root safely
                if docker_status == "AVAILABLE":
                    docker_path_out = (await self._run_with_sudo_fallback("docker info --format '{{.DockerRootDir}}'", "Docker Path"))[0]
                    if docker_path_out.strip():
                        docker_path = docker_path_out.strip()
                        findmnt_out = (await self._run_with_sudo_fallback(f"findmnt -T '{docker_path}' -o TARGET -n", "Findmnt Docker"))[0]
                        if findmnt_out.strip():
                            docker_mount_target = findmnt_out.strip()
                            for d in disks:
                                if d["mount_point"] == docker_mount_target:
                                    d["is_docker_data"] = True
            except Exception as e:
                log.error("ssh_disk_collection_error", host=self.host, error=str(e))

            ports_out = ""
            try:
                ports_out = (await self._run_with_sudo_fallback("ss -H -lntup", "Ports"))[0]
            except Exception as e:
                log.error("ssh_ports_collection_error", host=self.host, error=str(e))

            await self.disconnect()
                    
            return {
                "host": {
                    "cpu_percent": round(cpu_percent, 2),
                    "ram_total": ram_total,
                    "ram_used": ram_used,
                    "load_1": load_1,
                    "load_5": load_5,
                    "load_15": load_15,
                    "os": os_name,
                    "architecture": architecture,
                    "cpu_cores": cpu_cores
                },
                "network": interfaces,
                "interfaces": interfaces,
                "containers": containers,
                "container_stats": container_stats,
                "docker_status": docker_status,
                "uptime_seconds": uptime_seconds,
                "disks": disks,
                "ports_output": ports_out
            }
            
        except Exception as e:
            log.error("ssh_snapshot_error", host=self.host, error=str(e))
            await self.disconnect()
            return None

    async def docker_info(self) -> dict:
        """
        Step 1: Docker Detection
        Safely verifies Docker installation, version, and access.
        Does NOT mark server offline if Docker fails.
        """
        result = {
            "installed": False,
            "version": "",
            "accessible": False,
            "error": "",
            "status": "UNKNOWN" # AVAILABLE, NOT INSTALLED, PERMISSION DENIED, UNAVAILABLE, UNKNOWN
        }
        
        try:
            await self.connect()
            
            # 1. Check if Docker is in PATH
            which_docker = await self._run_safe_command("which docker || echo 'not found'")
            if "not found" in which_docker.lower() or not which_docker.strip():
                result["status"] = "NOT INSTALLED"
                return result
                
            result["installed"] = True
            
            # 2. Check Version
            version_out = await self._run_safe_command("docker --version")
            if version_out.strip():
                result["version"] = version_out.strip().replace("Docker version ", "").split(",")[0]
                
            # 3. Check Access (using docker info)
            # If user isn't in docker group, this will fail with permission denied.
            info_out = (await self._run_with_sudo_fallback("docker info", "Docker Info"))[0]
            
            if "permission denied" in info_out.lower():
                result["status"] = "PERMISSION DENIED"
                result["error"] = "Permission denied while trying to connect to the Docker daemon socket"
            elif "cannot connect to the docker daemon" in info_out.lower() or "is the docker daemon running" in info_out.lower():
                result["status"] = "UNAVAILABLE"
                result["error"] = "Docker daemon is not running"
            elif "Server Version" in info_out:
                result["accessible"] = True
                result["status"] = "AVAILABLE"
            else:
                result["status"] = "UNKNOWN"
                result["error"] = "Unexpected output from docker info"
                
        except Exception as e:
            result["status"] = "UNKNOWN"
            result["error"] = str(e)
        finally:
            await self.disconnect()
            
        return result

    async def container_top(self, container_id: str) -> dict:
        try:
            await self.connect()
            # Try preferred format (ARGS MUST BE LAST)
            out = (await self._run_with_sudo_fallback(f"docker top {container_id} -eo pid,ppid,user,comm,%cpu,%mem,rss,stat,etime,args", "Docker Top"))[0]
            
            is_fallback = False
            if not out or "error" in out.lower() or "unknown option" in out.lower() or "usage:" in out.lower() or "permission denied" in out.lower():
                # Fallback to standard
                out = (await self._run_with_sudo_fallback(f"docker top {container_id}", "Docker Top"))[0]
                is_fallback = True
            
            lines = out.strip().split("\n")
            if len(lines) < 2: return {"processes": []}
            
            headers = lines[0].split()
            procs = []
            
            if is_fallback:
                for line in lines[1:]:
                    parts = line.split(None, len(headers)-1)
                    raw_dict = dict(zip(headers, parts))
                    procs.append({
                        "pid": raw_dict.get("PID"),
                        "ppid": raw_dict.get("PPID"),
                        "user": raw_dict.get("UID"),
                        "name": raw_dict.get("CMD", "").split()[0] if raw_dict.get("CMD") else None,
                        "command": raw_dict.get("CMD"),
                        "cpu_percent": None,
                        "memory_percent": None,
                        "rss_bytes": None,
                        "state": None,
                        "elapsed_seconds": None, # Time exists but is a string format
                        "threads": None,
                    })
            else:
                for line in lines[1:]:
                    # The format is pid, ppid, user, comm, %cpu, %mem, rss, stat, etime, args (10 parts)
                    parts = line.split(None, 9)
                    if len(parts) >= 10:
                        try:
                            rss_kb = int(parts[6]) if parts[6].isdigit() else 0
                        except:
                            rss_kb = 0
                        try:
                            cpu = float(parts[4])
                        except:
                            cpu = 0.0
                        try:
                            mem = float(parts[5])
                        except:
                            mem = 0.0
                        procs.append({
                            "pid": parts[0],
                            "ppid": parts[1],
                            "user": parts[2],
                            "name": parts[3],
                            "command": parts[9],
                            "cpu_percent": cpu,
                            "memory_percent": mem,
                            "rss_bytes": rss_kb * 1024,
                            "state": parts[7],
                            "elapsed_seconds": self._parse_etime(parts[8]),
                            "threads": None,
                        })
            return {"processes": procs}
        except Exception:
            return {"processes": []}
        finally:
            await self.disconnect()

    async def container_logs(self, container_id: str, tail: int = 100, since: str = "") -> dict:
        try:
            await self.connect()
            since_flag = f"--since {since}" if since else ""
            out, err, code = await self._run_with_sudo_fallback(f"docker logs --tail {tail} {since_flag} {container_id}", "Docker Logs")
            logs_str = (out + "\n" + err).strip() if (out or err) else ("Permission denied" if code != 0 else "")
            
            import re
            logs_str = re.sub(r"\[sudo\] password for [^:]+:\s*", "", logs_str)
            
            return {"logs": logs_str}
        except Exception:
            return {"logs": ""}
        finally:
            await self.disconnect()

    def _parse_etime(self, etime_str: str) -> int:
        # e.g., "00:14", "01:23:45", "5-10:23:45"
        try:
            if not etime_str or etime_str == "-": return 0
            parts = etime_str.split('-')
            days = 0
            time_part = etime_str
            if len(parts) == 2:
                days = int(parts[0])
                time_part = parts[1]
            time_parts = time_part.split(':')
            if len(time_parts) == 3:
                h, m, s = map(int, time_parts)
            elif len(time_parts) == 2:
                h = 0
                m, s = map(int, time_parts)
            else:
                return 0
            return days * 86400 + h * 3600 + m * 60 + s
        except:
            return 0

    async def server_processes(self) -> dict:
        try:
            await self.connect()
            # Preferred read-only command, ARGS LAST
            # Fields: pid=,ppid=,user=,comm=,%cpu=,%mem=,rss=,stat=,etime=,nlwp=,args=
            cmd = """
            ps -eo pid=,ppid=,user=,comm=,%cpu=,%mem=,rss=,stat=,etime=,nlwp=,args= --sort=-%cpu
            echo "---CONTAINER_MAP---"
            if command -v docker >/dev/null 2>&1; then
                docker ps -q | xargs -r docker inspect --format '{{.State.Pid}} {{.Name}} {{.Id}}' 2>/dev/null || true
            fi
            """
            out = await self._run_safe_command(cmd, use_sudo=False)
            
            parts = out.split("---CONTAINER_MAP---")
            ps_out = parts[0].strip()
            cmap_out = parts[1].strip() if len(parts) > 1 else ""

            root_pid_to_container = {}
            for line in cmap_out.split("\n"):
                if not line.strip(): continue
                cparts = line.strip().split(None, 2)
                if len(cparts) >= 3:
                    cpid = cparts[0]
                    cname = cparts[1].lstrip("/") # docker names have leading slash
                    cid = cparts[2]
                    root_pid_to_container[cpid] = {"name": cname, "id": cid}

            lines = ps_out.split("\n")
            procs = []
            pid_to_ppid = {}
            pid_to_proc = {}

            for line in lines:
                if not line.strip(): continue
                # Split fixed columns first (10 parts), remaining is args
                parts = line.split(None, 10)
                if len(parts) >= 11:
                    try:
                        rss_kb = int(parts[6]) if parts[6].isdigit() else 0
                    except:
                        rss_kb = 0
                    try:
                        cpu = float(parts[4])
                    except:
                        cpu = 0.0
                    try:
                        mem = float(parts[5])
                    except:
                        mem = 0.0
                    try:
                        threads = int(parts[9]) if parts[9].isdigit() else None
                    except:
                        threads = None

                    pid = parts[0]
                    ppid = parts[1]

                    p_dict = {
                        "pid": pid,
                        "ppid": ppid,
                        "user": parts[2],
                        "name": parts[3],
                        "command": parts[10],
                        "cpu_percent": cpu,
                        "memory_percent": mem,
                        "rss_bytes": rss_kb * 1024,
                        "state": parts[7],
                        "elapsed_seconds": self._parse_etime(parts[8]),
                        "threads": threads,
                        "container_name": None,
                        "container_id": None
                    }
                    procs.append(p_dict)
                    pid_to_ppid[pid] = ppid
                    pid_to_proc[pid] = p_dict

            # Assign containers using process tree
            def get_container(pid, depth=0):
                if depth > 50: return None # prevent infinite loop
                if pid in root_pid_to_container:
                    return root_pid_to_container[pid]
                ppid = pid_to_ppid.get(pid)
                if not ppid or ppid == "0" or ppid == "1":
                    return None
                return get_container(ppid, depth + 1)

            for p in procs:
                cinfo = get_container(p["pid"])
                if cinfo:
                    p["container_name"] = cinfo["name"]
                    p["container_id"] = cinfo["id"]

            return {"processes": procs}
        except Exception:
            return {"processes": []}
        finally:
            await self.disconnect()
    async def container_inspect(self, container_id: str) -> dict:
        try:
            await self.connect()
            out = (await self._run_with_sudo_fallback(f"docker inspect {container_id}", "Docker Inspect"))[0]
            return json.loads(out)[0] if out else {}
        except Exception:
            return {}
        finally:
            await self.disconnect()

    async def get_nginx_config(self) -> dict:
        try:
            await self.connect()
            out = (await self._run_with_sudo_fallback("nginx -T", "Nginx Config"))[0]
            if out and ("# configuration file" in out or "server {" in out):
                return {"source": "nginx -T", "config": out, "error": None, "state": "FULL"}
            
            import stat
            import os
            
            async with self.conn.start_sftp_client() as sftp:
                visited = set()
                config_lines = []
                
                async def read_conf(path: str, depth: int = 0):
                    if depth > 20 or path in visited:
                        return
                    visited.add(path)
                    
                    try:
                        attrs = await sftp.stat(path)
                        if not attrs:
                            return
                        
                        real_path = path
                        try:
                            lattrs = await sftp.lstat(path)
                            if lattrs.permissions and stat.S_ISLNK(lattrs.permissions):
                                real_path = await sftp.readlink(path)
                                if not real_path.startswith('/'):
                                    real_path = os.path.normpath(os.path.join(os.path.dirname(path), real_path))
                        except Exception:
                            pass

                        async with sftp.open(path, "r") as f:
                            content = await f.read()
                            config_lines.append(f"# configuration file {path}:")
                            if real_path != path:
                                config_lines.append(f"# symlink to {real_path}")
                                
                            config_lines.append(content)
                            
                            for line in content.split('\\n'):
                                line = line.strip()
                                if line.startswith('include ') and line.endswith(';'):
                                    inc = line[8:-1].strip().strip('\'"')
                                    if not inc.startswith('/'):
                                        inc = f"/etc/nginx/{inc}"
                                        
                                    if '*' in inc:
                                        try:
                                            files = await sftp.glob(inc)
                                            for glob_file in files:
                                                await read_conf(glob_file, depth + 1)
                                        except Exception:
                                            pass
                                    else:
                                        await read_conf(inc, depth + 1)
                    except Exception as e:
                        config_lines.append(f"# Error reading {path}: {str(e)}")
                        
                await read_conf("/etc/nginx/nginx.conf")
                
                out2 = "\\n".join(config_lines)
                if out2 and "worker_processes" in out2:
                    return {"source": "files", "config": out2, "error": None, "state": "PARTIAL"}
                
                return {"source": "none", "config": "", "error": "PERMISSION DENIED", "state": "PERMISSION_DENIED"}
                
        except Exception as e:
            return {"source": "none", "config": "", "error": str(e), "state": "UNKNOWN"}
        finally:
            await self.disconnect()

    async def get_cron_jobs(self) -> dict:
        """
        Fetch and parse all cron jobs from the server via SSH.
        Returns structured list of cron_jobs dicts plus raw_output for debugging.
        Sources: user crontab, /etc/crontab, /etc/cron.d/*
        """
        try:
            await self.connect()
            cron_jobs = []

            # ── Helper: parse a single cron line ──────────────────────────────
            def parse_cron_line(line: str, source: str, source_type: str, default_user: str = "root") -> dict | None:
                line = line.strip()
                if not line:
                    return None

                is_disabled = line.startswith("#")
                comment = ""

                # Strip leading comment marker(s) to attempt parsing disabled jobs
                clean = line.lstrip("#").strip()

                # Extract inline comment
                if "#" in clean:
                    parts = clean.split("#", 1)
                    clean = parts[0].strip()
                    comment = parts[1].strip()

                if not clean:
                    return None

                # Special @-aliases: @reboot, @daily, @weekly, @monthly, @yearly, @hourly
                ALIASES = {"@reboot", "@yearly", "@annually", "@monthly", "@weekly", "@daily", "@midnight", "@hourly"}
                tokens = clean.split()
                if not tokens:
                    return None

                if tokens[0].lower() in ALIASES:
                    # Format: @alias [user (only in /etc/crontab & cron.d)] command...
                    schedule = tokens[0].lower()
                    if source_type in ("crontab_system", "cron_d") and len(tokens) >= 3:
                        user = tokens[1]
                        command = " ".join(tokens[2:])
                    elif len(tokens) >= 2:
                        user = default_user
                        command = " ".join(tokens[1:])
                    else:
                        return None
                    return {
                        "schedule": schedule,
                        "command": command,
                        "user": user,
                        "source": source,
                        "source_type": source_type,
                        "is_disabled": is_disabled,
                        "comment": comment,
                    }

                # Standard 5-field cron: minute hour dom month dow [user] command
                if len(tokens) < 6:
                    return None

                schedule = " ".join(tokens[:5])
                if source_type in ("crontab_system", "cron_d") and len(tokens) >= 7:
                    user = tokens[5]
                    command = " ".join(tokens[6:])
                elif len(tokens) >= 6:
                    user = default_user
                    command = " ".join(tokens[5:])
                else:
                    return None

                return {
                    "schedule": schedule,
                    "command": command,
                    "user": user,
                    "source": source,
                    "source_type": source_type,
                    "is_disabled": is_disabled,
                    "comment": comment,
                }

            # ── Parse a block of cron text ─────────────────────────────────────
            def parse_cron_block(text: str, source: str, source_type: str, default_user: str = "root") -> list:
                jobs = []
                for line in text.splitlines():
                    stripped = line.strip()
                    # Skip blank lines, environment variable assignments, and pure comment headers
                    if not stripped:
                        continue
                    if "=" in stripped and not stripped.startswith("#"):
                        # env var like MAILTO=root — skip
                        first_token = stripped.split()[0]
                        if "=" in first_token and not any(c in first_token for c in "*/"):
                            continue
                    # Skip shell-env lines like SHELL=, PATH=
                    if stripped.startswith("SHELL=") or stripped.startswith("PATH=") or stripped.startswith("MAILTO=") or stripped.startswith("HOME="):
                        continue
                    job = parse_cron_line(stripped, source, source_type, default_user)
                    if job:
                        jobs.append(job)
                return jobs

            # ── 1. User crontab ────────────────────────────────────────────────
            try:
                crontab_raw = await self._run_safe_command("crontab -l 2>/dev/null")
                if crontab_raw.strip() and "no crontab" not in crontab_raw.lower():
                    cron_jobs.extend(parse_cron_block(
                        crontab_raw,
                        source="crontab -l",
                        source_type="user_crontab",
                        default_user=self.username,
                    ))
            except Exception:
                pass

            # ── 2 & 3. SFTP-based reads ────────────────────────────────────────
            try:
                async with self.conn.start_sftp_client() as sftp:
                    # /etc/crontab
                    try:
                        async with sftp.open("/etc/crontab", "r") as f:
                            content = await f.read()
                        if hasattr(content, "decode"):
                            content = content.decode("utf-8", errors="replace")
                        cron_jobs.extend(parse_cron_block(
                            content,
                            source="/etc/crontab",
                            source_type="crontab_system",
                            default_user="root",
                        ))
                    except Exception:
                        pass

                    # /etc/cron.d/*
                    try:
                        cron_d_files = await sftp.readdir("/etc/cron.d")
                        for entry in cron_d_files:
                            if entry.filename.startswith("."):
                                continue
                            path = f"/etc/cron.d/{entry.filename}"
                            try:
                                import stat as _stat
                                if entry.attrs.permissions and _stat.S_ISREG(entry.attrs.permissions):
                                    async with sftp.open(path, "r") as f:
                                        content = await f.read()
                                    if hasattr(content, "decode"):
                                        content = content.decode("utf-8", errors="replace")
                                    cron_jobs.extend(parse_cron_block(
                                        content,
                                        source=path,
                                        source_type="cron_d",
                                        default_user="root",
                                    ))
                            except Exception:
                                pass
                    except Exception:
                        pass
            except Exception:
                pass

            return {
                "cron_jobs": cron_jobs,
                "total": len(cron_jobs),
            }
        except Exception as exc:
            log.error("ssh_get_cron_jobs_error", host=self.host, error=str(exc))
            return {"cron_jobs": [], "total": 0}
        finally:
            await self.disconnect()

    async def get_listening_ports(self) -> dict:
        try:
            await self.connect()
            out = (await self._run_with_sudo_fallback("ss -lntup", "Ports"))[0]
            parsed = []
            for line in out.strip().split("\n")[1:]:
                parts = line.split()
                if len(parts) >= 6:
                    protocol = parts[0]
                    address = parts[4]
                    process_str = parts[6] if len(parts) > 6 else ""
                    import re
                    match = re.search(r'users:\(\("([^"]+)"', process_str)
                    process = match.group(1) if match else process_str
                    port = address.split(":")[-1] if ":" in address else address
                    parsed.append({"protocol": protocol, "address": address, "port": port, "process": process})
            return {"listening": parsed, "output": out}
        except Exception:
            return {"listening": [], "output": ""}
        finally:
            await self.disconnect()

    async def get_services(self, services: list[str]) -> dict:
        try:
            await self.connect()
            res = {}
            for s in services:
                out = (await self._run_with_sudo_fallback(f"systemctl is-active {s}", "Service Status"))[0]
                status = out.strip()
                if status:
                    out_show = (await self._run_with_sudo_fallback(f"systemctl show {s} --no-page", "Service Details"))[0]
                    res[s] = {"is_active": status, "show": out_show}
            return res
        except Exception:
            return {}
        finally:
            await self.disconnect()

    async def get_processes(self) -> dict:
        return await self.server_processes()

    async def docker_images(self) -> list[dict]:
        try:
            await self.connect()
            out = (await self._run_with_sudo_fallback("docker images --format '{{.Repository}}|{{.Tag}}|{{.ID}}|{{.Size}}|{{.CreatedAt}}'", "Docker Images"))[0]
            images = []
            for line in out.strip().split("\n"):
                if not line: continue
                parts = line.split("|")
                if len(parts) >= 5:
                    images.append({
                        "repository": parts[0],
                        "tag": parts[1],
                        "id": parts[2],
                        "size": parts[3],
                        "created_at": parts[4]
                    })
            return images
        except Exception as e:
            log.error("ssh_docker_images_error", host=self.host, error=str(e))
            return []
        finally:
            await self.disconnect()

    async def docker_volumes(self) -> list[dict]:
        try:
            await self.connect()
            # Docker volumes don't naturally show size safely in ls. df does, but let's grab ls first.
            out = (await self._run_with_sudo_fallback("docker volume ls --format '{{.Name}}|{{.Driver}}|{{.Scope}}'", "Docker Volumes"))[0]
            volumes = []
            for line in out.strip().split("\n"):
                if not line: continue
                parts = line.split("|")
                if len(parts) >= 3:
                    volumes.append({
                        "name": parts[0],
                        "driver": parts[1],
                        "scope": parts[2],
                        "usage_size": "Size unavailable" # As per user request: "If Docker cannot directly provide a reliable volume size cheaply: show: Size unavailable"
                    })
            return volumes
        except Exception as e:
            log.error("ssh_docker_volumes_error", host=self.host, error=str(e))
            return []
        finally:
            await self.disconnect()

    async def docker_redis_info(self, container_id: str, redis_password: Optional[str] = None) -> str:
        """
        Safely runs `redis-cli INFO` inside a specific Docker container.
        Strictly READ-ONLY. container_id is validated to prevent injection.
        """
        try:
            await self.connect()
            # Validate container_id strictly (hex or standard naming)
            clean_id = container_id.strip()
            if not all(c.isalnum() or c in "-_" for c in clean_id):
                log.warning("ssh_docker_redis_invalid_container", host=self.host, container_id=clean_id)
                return ""
                
            cmd = f"docker exec {clean_id} redis-cli"
            if redis_password:
                # Basic escaping of password
                safe_pwd = redis_password.replace("'", "'\\''")
                cmd += f" -a '{safe_pwd}'"
            cmd += " INFO"
            
            out, err, code = await self._run_with_sudo_fallback(cmd, "Docker Redis Info")
            
            # Remove the warning message that redis-cli sometimes outputs for passing password in CLI
            clean_out = "\n".join([line for line in out.split("\n") if "Warning: Using a password with '-a' or '-u' option on the command line interface may not be safe" not in line])
            return clean_out
        except Exception as e:
            log.error("ssh_docker_redis_info_error", host=self.host, error=str(e))
            return ""
        finally:
            await self.disconnect()

