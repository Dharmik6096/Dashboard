package main

import (
	"log"
	"github.com/devops-dashboard/agent/internal/api"
	"github.com/devops-dashboard/agent/internal/config"
)

func main() {
	log.Println("[AGENT] DevOps Dashboard Monitoring Agent v1.0.0")
	log.Println("[AGENT] Read-only monitoring — no control actions")

	cfg := config.Load()

	srv := api.New(cfg)
	if err := srv.Start(); err != nil {
		log.Fatalf("[FATAL] Agent failed to start: %v", err)
	}
}
