#!/bin/bash

# Script de deployment para servidor de producción
# Bot de Telegram con Trilium

set -e

echo "🚀 Iniciando deployment del Bot de Telegram..."

# Colores para output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Función para logging
log() {
    echo -e "${GREEN}[$(date +'%Y-%m-%d %H:%M:%S')] $1${NC}"
}

warn() {
    echo -e "${YELLOW}[WARNING] $1${NC}"
}

error() {
    echo -e "${RED}[ERROR] $1${NC}"
    exit 1
}

# Verificar que Docker esté instalado
if ! command -v docker &> /dev/null; then
    error "Docker no está instalado. Por favor instálalo primero."
fi

# Verificar que Docker Compose esté disponible
if ! docker compose version &> /dev/null; then
    error "Docker Compose no está disponible. Por favor instálalo primero."
fi

# Crear directorio de logs si no existe
log "Creando directorio de logs..."
mkdir -p ./logs
chmod 755 ./logs

# Verificar archivo de configuración
if [ ! -f .env ]; then
    warn "Archivo .env no encontrado. Copiando desde .env.example..."
    cp .env.example .env
    warn "Por favor edita .env con tu configuración antes de continuar."
    read -p "¿Has configurado .env? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        error "Por favor configura .env y ejecuta el script nuevamente."
    fi
fi

# Parar contenedor existente si está corriendo
log "Deteniendo contenedor existente (si existe)..."
docker compose -f docker-compose.server.yml down --remove-orphans || true

# Actualizar imagen
log "Descargando última imagen del bot..."
docker pull ghcr.io/jamesnoria/bot-telegram-trilium:latest

# Limpiar imágenes no utilizadas
log "Limpiando imágenes Docker no utilizadas..."
docker image prune -f || true

# Iniciar servicio
log "Iniciando bot de Telegram..."
docker compose -f docker-compose.server.yml up -d

# Verificar que el contenedor esté corriendo
sleep 5
if docker compose -f docker-compose.server.yml ps | grep -q "Up"; then
    log "✅ Bot desplegado exitosamente!"
    log "📊 Estado del contenedor:"
    docker compose -f docker-compose.server.yml ps
    log ""
    log "📋 Para ver logs en tiempo real:"
    echo -e "${BLUE}docker compose -f docker-compose.server.yml logs -f${NC}"
    log ""
    log "🛑 Para detener el bot:"
    echo -e "${BLUE}docker compose -f docker-compose.server.yml down${NC}"
else
    error "❌ Error al desplegar el bot. Verifica los logs:"
    docker compose -f docker-compose.server.yml logs
fi

log "🎉 Deployment completado!"
