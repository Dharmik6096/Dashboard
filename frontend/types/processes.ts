export interface Process {
  pid: string | number;
  ppid: string | number;
  user: string;
  name: string;
  command: string;
  cpu_percent: number | null;
  memory_percent: number | null;
  rss_bytes: number | null;
  state: string | null;
  elapsed_seconds: number | null;
  threads: number | null;
  server_id: string;
  server_name: string;
  container_id: string | null;
  container_name: string | null;
  sampled_at: string;
}
