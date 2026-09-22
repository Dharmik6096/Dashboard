import asyncio
import json
import uuid
from typing import List, Dict, Any, Optional
from datetime import datetime, timezone
import structlog
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.models.server import Server
from app.models.container import Container
from app.models.audit import CredentialVault
from app.services.credential_vault import decrypt_credential
from app.services.ssh_client import SSHClient

log = structlog.get_logger()

_RABBITMQ_TIMEOUT = 10

class RabbitmqService:
    @staticmethod
    async def _fetch_server_rabbitmq(server: Server, db: AsyncSession) -> List[Dict[str, Any]]:
        results = []
        
        # Get credentials
        password = None
        private_key = None
        cred_res = await db.execute(select(CredentialVault).where(CredentialVault.server_id == server.id))
        cred = cred_res.scalars().first()
        if cred:
            decrypted = decrypt_credential(cred.encrypted_value)
            if cred.auth_type == "password":
                password = decrypted
            else:
                private_key = decrypted

        ssh = SSHClient(
            host=server.ip_address,
            port=server.ssh_port,
            username=server.ssh_username or "root",
            password=password,
            private_key=private_key
        )

        try:
            await ssh.connect()
            
            # Discover RabbitMQ containers
            docker_ps_cmd = "docker ps -a --format '{{.ID}}|{{.Names}}|{{.Image}}|{{.State}}|{{.Status}}|{{.Ports}}'"
            out, err, code = await ssh._run_command_full(docker_ps_cmd, timeout=10, use_sudo=False)
            if code != 0:
                if ssh.password:
                    out, err, code = await ssh._run_command_full(docker_ps_cmd, timeout=10, use_sudo=True)
            
            if code != 0 or not out:
                return results
                
            rabbitmq_containers = []
            for line in out.strip().split("\n"):
                if not line: continue
                parts = line.split("|")
                if len(parts) >= 6:
                    image = parts[2].lower()
                    if "rabbitmq" in image:
                        rabbitmq_containers.append({
                            "id": parts[0],
                            "name": parts[1],
                            "image": parts[2],
                            "state": parts[3].upper(),
                            "status_text": parts[4],
                            "ports": parts[5]
                        })
            
            now_iso = datetime.now(timezone.utc).isoformat()
            
            # Extract details for each
            for c in rabbitmq_containers:
                if c["state"] != "RUNNING" and c["state"] != "UP":
                    broker = RabbitmqService._create_offline_broker(server, c, now_iso)
                    results.append(broker)
                    continue
                    
                curl_cmd = f"docker exec {c['id']} curl -s -u guest:guest http://localhost:15672/api/overview"
                overview_out, _, curl_code = await ssh._run_command_full(curl_cmd, timeout=10, use_sudo=True)
                
                broker = RabbitmqService._create_offline_broker(server, c, now_iso)
                broker["status"] = "Unknown"
                broker["uptime"] = "—"
                
                queues_cmd = f"docker exec {c['id']} curl -s -u guest:guest http://localhost:15672/api/queues"
                queues_out, _, q_code = await ssh._run_command_full(queues_cmd, timeout=10, use_sudo=True)
                
                if curl_code != 0 or "Unauthorized" in overview_out or not overview_out.strip().startswith("{"):
                    # Fallback to CLI
                    broker["api_error"] = "Management API (http://localhost:15672) unreachable or unauthorized. Ensure rabbitmq_management plugin is enabled."
                    status_cmd = f"docker exec {c['id']} rabbitmq-diagnostics -q status --formatter json"
                    stat_out, _, stat_code = await ssh._run_command_full(status_cmd, timeout=10, use_sudo=True)
                    
                    if stat_code == 0 and stat_out.strip().startswith("{"):
                        try:
                            stat_json = json.loads(stat_out)
                            broker["status"] = "Healthy"
                            broker["erlang_version"] = stat_json.get("erlang_version", "—")
                            broker["rabbitmq_version"] = stat_json.get("rabbitmq_version", "—")
                            broker["disk_alarm"] = stat_json.get("alarms", {}).get("disk_free_alarm", False)
                            broker["memory_alarm"] = stat_json.get("alarms", {}).get("memory_alarm", False)
                        except: pass
                        
                    q_cmd = f"docker exec {c['id']} rabbitmqctl list_queues name messages_ready messages_unacknowledged consumers --formatter json"
                    q_out, _, q_code2 = await ssh._run_command_full(q_cmd, timeout=10, use_sudo=True)
                    if q_code2 == 0 and q_out.strip():
                        try:
                            q_json = json.loads(q_out)
                            broker["queues"] = len(q_json)
                            broker["messages_ready"] = sum(q.get("messages_ready", 0) for q in q_json)
                            broker["messages_unacked"] = sum(q.get("messages_unacknowledged", 0) for q in q_json)
                            broker["consumers"] = sum(q.get("consumers", 0) for q in q_json)
                            broker["status"] = "Healthy" if broker["status"] != "Critical" else "Critical"
                            
                            broker["queue_list"] = [{
                                "name": q.get("name"),
                                "vhost": "/",
                                "messages_ready": q.get("messages_ready", 0),
                                "consumers": q.get("consumers", 0),
                                "type": "classic",
                                "state": "running"
                            } for q in q_json]
                        except: pass
                        
                else:
                    try:
                        ov_json = json.loads(overview_out)
                        broker["rabbitmq_version"] = ov_json.get("rabbitmq_version", "—")
                        broker["erlang_version"] = ov_json.get("erlang_version", "—")
                        
                        obj_totals = ov_json.get("object_totals", {})
                        broker["queues"] = obj_totals.get("queues", 0)
                        broker["consumers"] = obj_totals.get("consumers", 0)
                        broker["connections"] = obj_totals.get("connections", 0)
                        broker["channels"] = obj_totals.get("channels", 0)
                        
                        mq_stats = ov_json.get("message_stats", {})
                        broker["publish_rate"] = mq_stats.get("publish_details", {}).get("rate", 0)
                        broker["deliver_rate"] = mq_stats.get("deliver_get_details", {}).get("rate", 0)
                        broker["ack_rate"] = mq_stats.get("ack_details", {}).get("rate", 0)
                        
                        q_totals = ov_json.get("queue_totals", {})
                        broker["messages_ready"] = q_totals.get("messages_ready", 0)
                        broker["messages_unacked"] = q_totals.get("messages_unacknowledged", 0)
                        broker["messages_total"] = q_totals.get("messages", 0)
                        
                        node_name = ov_json.get("node", f"rabbit@{server.name}")
                        broker["node_name"] = node_name
                        broker["broker_name"] = node_name
                        
                        broker["status"] = "Healthy"
                    except Exception as e:
                        log.error("rabbitmq_api_parse_error", error=str(e))
                
                if curl_code == 0:
                    node_cmd = f"docker exec {c['id']} curl -s -u guest:guest http://localhost:15672/api/nodes/{broker.get('node_name', '')}"
                    node_out, _, node_code = await ssh._run_command_full(node_cmd, timeout=10, use_sudo=True)
                    if node_code == 0 and node_out.strip().startswith("{"):
                        try:
                            node_json = json.loads(node_out)
                            broker["memory_used"] = node_json.get("mem_used", 0)
                            broker["memory_alarm"] = node_json.get("mem_alarm", False)
                            broker["disk_alarm"] = node_json.get("disk_free_alarm", False)
                            broker["uptime"] = node_json.get("uptime", 0)
                            broker["file_descriptors_used"] = node_json.get("fd_used", 0)
                            broker["sockets_used"] = node_json.get("sockets_used", 0)
                            
                            if broker["memory_alarm"] or broker["disk_alarm"]:
                                broker["status"] = "Critical"
                        except: pass
                
                if q_code == 0 and queues_out.strip().startswith("["):
                    try:
                        q_json = json.loads(queues_out)
                        broker["queue_list"] = [{
                            "name": q.get("name"),
                            "vhost": q.get("vhost"),
                            "messages_ready": q.get("messages_ready", 0),
                            "messages_unacked": q.get("messages_unacknowledged", 0),
                            "consumers": q.get("consumers", 0),
                            "type": q.get("type", "classic"),
                            "state": q.get("state", "running")
                        } for q in q_json]
                    except: pass
                        
                results.append(broker)
            
        except Exception as e:
            log.error("rabbitmq_fetch_error", server=server.name, error=str(e))
        finally:
            await ssh.disconnect()
            
        return results

    @staticmethod
    def _create_offline_broker(server: Server, container: dict, now_iso: str) -> dict:
        return {
            "server_id": str(server.id),
            "server_name": server.name,
            "container_id": container["id"],
            "container_name": container["name"],
            "docker_image": container["image"],
            "broker_name": f"rabbit@{server.name}",
            "node_name": "—",
            "rabbitmq_version": "—",
            "erlang_version": "—",
            "role": "disc",
            "vhost_count": 1,
            "queues": 0,
            "consumers": 0,
            "connections": 0,
            "channels": 0,
            "messages_ready": 0,
            "messages_unacked": 0,
            "messages_total": 0,
            "publish_rate": 0,
            "deliver_rate": 0,
            "ack_rate": 0,
            "memory_used": 0,
            "memory_limit": 0,
            "memory_alarm": False,
            "disk_free": 0,
            "disk_free_limit": 0,
            "disk_alarm": False,
            "file_descriptors_used": 0,
            "file_descriptors_limit": 0,
            "sockets_used": 0,
            "sockets_limit": 0,
            "uptime": 0,
            "cluster_name": "—",
            "cluster_nodes": 1,
            "status": "Unavailable",
            "sampled_at": now_iso,
            "freshness": "Live",
            "queue_list": [],
            "vhost": "/"
        }
