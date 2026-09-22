// agent/internal/api/server.go — HTTP API server with bearer token auth
package api

import (
	"encoding/json"
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/devops-dashboard/agent/internal/config"
	"github.com/devops-dashboard/agent/internal/collector"
)

type Server struct {
	cfg *config.Config
	mux *http.ServeMux
}

func New(cfg *config.Config) *Server {
	s := &Server{cfg: cfg, mux: http.NewServeMux()}
	s.registerRoutes()
	return s
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	s.mux.ServeHTTP(w, r)
}

func (s *Server) Start() error {
	addr := ":" + s.cfg.Port
	log.Printf("[AGENT] Listening on %s", addr)
	srv := &http.Server{
		Addr:         addr,
		Handler:      s,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
	}
	return srv.ListenAndServe()
}

func (s *Server) registerRoutes() {
	// All routes are GET-only, wrapped in auth middleware
	routes := map[string]http.HandlerFunc{
		"/health":                   s.handleHealth,
		"/snapshot":                 s.handleSnapshot,
		"/metrics/host":             s.handleHostMetrics,
		"/metrics/disk":             s.handleDisk,
		"/metrics/network":          s.handleNetwork,
		"/metrics/processes":        s.handleProcesses,
		"/docker/containers":        s.handleContainers,
		"/docker/stats":             s.handleContainerStats,
		"/nginx/status":             s.handleNginx,
		"/ports/listening":          s.handlePorts,
		"/cron/jobs":                s.handleCron,
	}

	for path, handler := range routes {
		p := path
		h := handler
		s.mux.HandleFunc(p, s.withAuth(s.withGETOnly(h)))
	}

	// Dynamic routes
	s.mux.HandleFunc("/docker/", s.withAuth(s.withGETOnly(s.handleDockerDynamic)))
	s.mux.HandleFunc("/services/", s.withAuth(s.withGETOnly(s.handleServiceStatus)))
}

// ─── Middleware ─────────────────────────────────────────────────────────────

func (s *Server) withAuth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/health" {
			next(w, r)
			return
		}
		auth := r.Header.Get("Authorization")
		if !strings.HasPrefix(auth, "Bearer ") {
			jsonError(w, "unauthorized", http.StatusUnauthorized)
			return
		}
		token := strings.TrimPrefix(auth, "Bearer ")
		if token != s.cfg.AgentToken {
			jsonError(w, "forbidden", http.StatusForbidden)
			return
		}
		next(w, r)
	}
}

func (s *Server) withGETOnly(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodGet {
			jsonError(w, "method not allowed — this agent is read-only", http.StatusMethodNotAllowed)
			return
		}
		next(w, r)
	}
}

// ─── Handlers ───────────────────────────────────────────────────────────────

func (s *Server) handleHealth(w http.ResponseWriter, r *http.Request) {
	jsonOK(w, map[string]string{"status": "ok", "agent": "devops-dashboard-agent"})
}

func (s *Server) handleSnapshot(w http.ResponseWriter, r *http.Request) {
	host, _ := collector.CollectHost()
	disks, _ := collector.CollectDisk()
	ifaces, tcp := collector.CollectNetwork()
	containers, _ := collector.CollectContainers()
	stats, _ := collector.CollectContainerStats()
	nginx := collector.CollectNginx()
	ports := collector.CollectListeningPorts()
	cron := collector.CollectCronJobs()
	dockerVer, _ := collector.CollectDockerVersion()

	jsonOK(w, map[string]interface{}{
		"timestamp":       time.Now().UTC().Format(time.RFC3339),
		"agent_version":   "1.0.0",
		"host":            host,
		"disks":           disks,
		"network":         ifaces,
		"tcp_stats":       tcp,
		"containers":      containers,
		"container_stats": stats,
		"nginx":           nginx,
		"ports":           ports,
		"cron_jobs":       cron,
		"docker_version":  dockerVer,
	})
}

func (s *Server) handleHostMetrics(w http.ResponseWriter, r *http.Request) {
	data, err := collector.CollectHost()
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, data)
}

func (s *Server) handleDisk(w http.ResponseWriter, r *http.Request) {
	data, err := collector.CollectDisk()
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]interface{}{"disks": data})
}

func (s *Server) handleNetwork(w http.ResponseWriter, r *http.Request) {
	ifaces, tcp := collector.CollectNetwork()
	jsonOK(w, map[string]interface{}{"interfaces": ifaces, "tcp": tcp})
}

func (s *Server) handleProcesses(w http.ResponseWriter, r *http.Request) {
	// Top host processes from /proc
	jsonOK(w, map[string]interface{}{"processes": []string{}}) // placeholder for host process listing
}

func (s *Server) handleContainers(w http.ResponseWriter, r *http.Request) {
	data, err := collector.CollectContainers()
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]interface{}{"containers": data})
}

func (s *Server) handleContainerStats(w http.ResponseWriter, r *http.Request) {
	data, err := collector.CollectContainerStats()
	if err != nil {
		jsonError(w, err.Error(), http.StatusInternalServerError)
		return
	}
	jsonOK(w, map[string]interface{}{"stats": data})
}

func (s *Server) handleNginx(w http.ResponseWriter, r *http.Request) {
	data := collector.CollectNginx()
	jsonOK(w, data)
}

func (s *Server) handlePorts(w http.ResponseWriter, r *http.Request) {
	data := collector.CollectListeningPorts()
	jsonOK(w, map[string]interface{}{"ports": data})
}

func (s *Server) handleCron(w http.ResponseWriter, r *http.Request) {
	data := collector.CollectCronJobs()
	jsonOK(w, map[string]interface{}{"cron_jobs": data})
}

func (s *Server) handleDockerDynamic(w http.ResponseWriter, r *http.Request) {
	// /docker/{id}/top  /docker/{id}/logs  /docker/{id}/inspect
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/docker/"), "/")
	if len(parts) < 2 {
		jsonError(w, "invalid path", http.StatusBadRequest)
		return
	}
	containerID := parts[0]
	action := parts[1]

	switch action {
	case "top":
		procs, err := collector.CollectContainerTop(containerID)
		if err != nil {
			jsonError(w, err.Error(), http.StatusInternalServerError)
			return
		}
		jsonOK(w, map[string]interface{}{"processes": procs})
	case "logs":
		tail := 100
		since := r.URL.Query().Get("since")
		lines, err := collector.CollectContainerLogs(containerID, tail, since)
		if err != nil {
			jsonError(w, err.Error(), http.StatusInternalServerError)
			return
		}
		jsonOK(w, map[string]interface{}{"logs": lines})
	case "inspect":
		jsonOK(w, map[string]interface{}{"message": "use /docker/containers endpoint"})
	default:
		jsonError(w, "unknown action", http.StatusNotFound)
	}
}

func (s *Server) handleServiceStatus(w http.ResponseWriter, r *http.Request) {
	// /services/{name}/status
	parts := strings.Split(strings.TrimPrefix(r.URL.Path, "/services/"), "/")
	if len(parts) < 1 || parts[0] == "" {
		jsonError(w, "service name required", http.StatusBadRequest)
		return
	}
	serviceName := parts[0]
	// Check if service process exists
	running := isServiceRunning(serviceName)
	jsonOK(w, map[string]interface{}{"service": serviceName, "running": running})
}

func isServiceRunning(name string) bool {
	procDir, _ := os.Open("/proc")
	if procDir == nil { return false }
	defer procDir.Close()
	entries, _ := procDir.Readdir(-1)
	for _, e := range entries {
		if !e.IsDir() { continue }
		comm, _ := os.ReadFile("/proc/" + e.Name() + "/comm")
		if strings.TrimSpace(string(comm)) == name {
			return true
		}
	}
	return false
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

func jsonOK(w http.ResponseWriter, data interface{}) {
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(data)
}

func jsonError(w http.ResponseWriter, msg string, code int) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(code)
	json.NewEncoder(w).Encode(map[string]string{"error": msg})
}
