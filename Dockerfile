# Usar Node.js LTS como imagen base
FROM node:18-alpine

# Información del mantenedor
LABEL maintainer="Bot de Tareas Pendientes"
LABEL description="Bot de Telegram escalable para gestión de tareas con sincronización a Trilium"
LABEL version="2.0.0"

# Crear directorio de la aplicación
WORKDIR /app

# Crear usuario no-root para seguridad
RUN addgroup -g 1001 -S nodejs && \
    adduser -S botuser -u 1001

# Copiar archivos de dependencias
COPY package*.json ./

# Instalar dependencias de producción
RUN npm ci --only=production && \
    npm cache clean --force

# Copiar código fuente
COPY . .

# Crear directorio para logs y cambiar permisos
RUN mkdir -p /app/logs && \
    chown -R botuser:nodejs /app

# Cambiar a usuario no-root
USER botuser

# Exponer puerto (opcional, para futuras extensiones web)
EXPOSE 3000

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV LOG_LEVEL=info

# Comando de health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node -e "console.log('Bot health check')" || exit 1

# Comando para ejecutar la aplicación
CMD ["node", "index.js"]
