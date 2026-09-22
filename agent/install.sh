#!/bin/bash
# DevOps Dashboard — Monitoring Agent Installer
# Run on each server you want to monitor:
# curl -sSL https://your-dashboard/install-agent.sh | bash

set -e

AGENT_VERSION="1.0.0"
INSTALL_DIR="/opt/devops-agent"
SERVICE_FILE="/etc/systemd/system/devops-agent.service"

echo "=================================================="
echo " DevOps Dashboard Monitoring Agent Installer"
echo " Version: $AGENT_VERSION"
echo "=================================================="

# Check if running as root
if [ "$EUID" -ne 0 ]; then
  echo "ERROR: Please run as root (sudo bash install.sh)"
  exit 1
fi

# Create install directory
mkdir -p "$INSTALL_DIR"

# Download agent binary (replace URL with your dashboard URL)
echo "[1/4] Downloading agent binary..."
# curl -sSL "https://your-dashboard/downloads/agent-linux-amd64" -o "$INSTALL_DIR/agent"
# For now, build from source if Go is available
if command -v go &> /dev/null; then
  echo "Building from source..."
  cd "$(dirname "$0")"
  go build -o "$INSTALL_DIR/agent" ./cmd/agent
else
  echo "ERROR: Go not found. Please install Go 1.22+ or provide binary."
  exit 1
fi

chmod +x "$INSTALL_DIR/agent"

# Generate secure token
AGENT_TOKEN=$(openssl rand -hex 32)
echo ""
echo "================================================================"
echo " IMPORTANT: Add this token to your dashboard when adding server"
echo " Agent Token: $AGENT_TOKEN"
echo "================================================================"
echo ""

# Create environment file
cat > "$INSTALL_DIR/.env" << EOF
AGENT_PORT=9100
AGENT_TOKEN=$AGENT_TOKEN
DOCKER_HOST=unix:///var/run/docker.sock
LOG_LEVEL=info
EOF
chmod 600 "$INSTALL_DIR/.env"

echo "[2/4] Creating systemd service..."
cat > "$SERVICE_FILE" << EOF
[Unit]
Description=DevOps Dashboard Monitoring Agent
After=network.target docker.service
Wants=docker.service

[Service]
Type=simple
User=root
WorkingDirectory=$INSTALL_DIR
EnvironmentFile=$INSTALL_DIR/.env
ExecStart=$INSTALL_DIR/agent
Restart=always
RestartSec=5
StandardOutput=journal
StandardError=journal

[Install]
WantedBy=multi-user.target
EOF

echo "[3/4] Starting service..."
systemctl daemon-reload
systemctl enable devops-agent
systemctl start devops-agent

echo "[4/4] Done!"
echo ""
echo "Agent is running on port 9100"
echo "Status: $(systemctl is-active devops-agent)"
echo ""
echo "Next steps:"
echo "  1. Open your DevOps Dashboard"
echo "  2. Go to Servers → Add Server"
echo "  3. Enter Agent URL: http://$(hostname -I | awk '{print $1}'):9100"
echo "  4. Enter Agent Token: $AGENT_TOKEN"
