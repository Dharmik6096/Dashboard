package config

import (
	"log"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

type Config struct {
	Port        string
	AgentToken  string
	DockerHost  string
	LogLevel    string
}

func Load() *Config {
	_ = godotenv.Load()

	port := getEnv("AGENT_PORT", "9100")
	token := getEnv("AGENT_TOKEN", "")
	if token == "" {
		log.Fatal("[FATAL] AGENT_TOKEN must be set. Generate with: openssl rand -hex 32")
	}

	return &Config{
		Port:       port,
		AgentToken: token,
		DockerHost: getEnv("DOCKER_HOST", "unix:///var/run/docker.sock"),
		LogLevel:   getEnv("LOG_LEVEL", "info"),
	}
}

func getEnv(key, fallback string) string {
	if val, ok := os.LookupEnv(key); ok {
		return val
	}
	return fallback
}

func getEnvInt(key string, fallback int) int {
	if val, ok := os.LookupEnv(key); ok {
		if i, err := strconv.Atoi(val); err == nil {
			return i
		}
	}
	return fallback
}
