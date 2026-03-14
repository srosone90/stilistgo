#!/bin/bash
set -e

echo "=== Evolution API Setup ==="

# 1. Installa Docker
apt-get update -q
apt-get install -y docker.io curl
systemctl start docker
systemctl enable docker

# Installa docker compose plugin
mkdir -p /usr/local/lib/docker/cli-plugins
curl -SL https://github.com/docker/compose/releases/download/v2.24.6/docker-compose-linux-x86_64 \
  -o /usr/local/lib/docker/cli-plugins/docker-compose
chmod +x /usr/local/lib/docker/cli-plugins/docker-compose

# 2. Ottieni IP pubblico
VPS_IP=$(curl -s ifconfig.me || curl -s icanhazip.com)
echo "IP pubblico rilevato: $VPS_IP"

# 3. Crea cartella e docker-compose
mkdir -p /opt/evolution
cat > /opt/evolution/docker-compose.yml << COMPOSE
services:
  postgres:
    image: postgres:15
    environment:
      POSTGRES_DB: evolution
      POSTGRES_USER: evolution
      POSTGRES_PASSWORD: evo_ribelle_2026
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  evolution-api:
    image: atendai/evolution-api:latest
    ports:
      - "8080:8080"
    environment:
      SERVER_URL: "http://${VPS_IP}:8080"
      AUTHENTICATION_TYPE: apikey
      AUTHENTICATION_API_KEY: ribelle-evo-2026
      DATABASE_ENABLED: "true"
      DATABASE_PROVIDER: postgresql
      DATABASE_CONNECTION_URI: "postgresql://evolution:evo_ribelle_2026@postgres:5432/evolution?schema=public"
      CACHE_REDIS_ENABLED: "false"
      CACHE_LOCAL_ENABLED: "true"
      CONFIG_SESSION_PHONE_CLIENT: Chrome
      CONFIG_SESSION_PHONE_NAME: Chrome
      QRCODE_LIMIT: "10"
    depends_on:
      - postgres
    restart: unless-stopped

volumes:
  postgres_data:
COMPOSE

# 4. Apri porta 8080 nel firewall
ufw allow 8080/tcp 2>/dev/null || true

# 5. Avvia
cd /opt/evolution
docker compose up -d

echo ""
echo "=== FATTO! ==="
echo "URL Evolution API: http://${VPS_IP}:8080"
echo "API Key: ribelle-evo-2026"
echo ""
echo "Attendi 30 secondi poi testa con:"
echo "curl http://${VPS_IP}:8080/"
