#!/bin/bash

# Script rápido de deployment para servidor
echo "🚀 Desplegando Bot de Telegram..."

# Crear directorio de logs
mkdir -p ./logs

# Detener contenedor existente
echo "⏹️  Deteniendo contenedor existente..."
docker compose -f docker-compose.server.yml down 2>/dev/null || true

# Actualizar imagen
echo "📦 Descargando última imagen..."
docker pull ghcr.io/jamesnoria/bot-telegram-trilium:latest

# Iniciar servicio
echo "🚀 Iniciando bot..."
docker compose -f docker-compose.server.yml up -d

# Verificar estado
sleep 3
echo "📊 Estado del contenedor:"
docker compose -f docker-compose.server.yml ps

echo ""
echo "✅ ¡Deployment completado!"
echo "📋 Ver logs: docker compose -f docker-compose.server.yml logs -f"
echo "🛑 Detener: docker compose -f docker-compose.server.yml down"
