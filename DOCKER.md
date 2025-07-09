# 🐳 Docker Deployment Guide

Esta guía explica cómo ejecutar el Bot de Tareas Pendientes usando Docker.

## 🚀 Inicio Rápido

### 1. Configurar Variables de Entorno

```bash
# Copiar el archivo de ejemplo
cp .env.example .env

# Editar las variables de entorno
nano .env
```

### 2. Ejecutar con Docker Compose (Recomendado)

```bash
# Construir y ejecutar el contenedor
npm run compose:up

# Ver logs en tiempo real
npm run compose:logs

# Detener el bot
npm run compose:down
```

### 3. Ejecutar con Docker CLI

```bash
# Construir la imagen
npm run docker:build

# Ejecutar el contenedor
npm run docker:run

# Ver logs
npm run docker:logs

# Detener y eliminar
npm run docker:stop
npm run docker:remove
```

## 📋 Scripts Disponibles

| Script | Descripción |
|--------|-------------|
| `npm run docker:build` | Construir imagen Docker |
| `npm run docker:run` | Ejecutar contenedor |
| `npm run docker:stop` | Detener contenedor |
| `npm run docker:remove` | Eliminar contenedor |
| `npm run docker:logs` | Ver logs del contenedor |
| `npm run compose:up` | Ejecutar con docker-compose |
| `npm run compose:down` | Detener docker-compose |
| `npm run compose:logs` | Ver logs de docker-compose |
| `npm run compose:build` | Construir con docker-compose |

## 🔧 Configuración Avanzada

### Variables de Entorno

| Variable | Descripción | Requerida |
|----------|-------------|-----------|
| `TELEGRAM_BOT_TOKEN` | Token del bot de Telegram | ✅ |
| `TRILIUM_API_URL` | URL de la API de Trilium | ✅ |
| `TRILIUM_API_TOKEN` | Token de autorización de Trilium | ✅ |
| `NODE_ENV` | Entorno de ejecución | ❌ |
| `LOG_LEVEL` | Nivel de logging | ❌ |
| `PORT` | Puerto para futuras extensiones | ❌ |

### Personalizar docker-compose.yml

```yaml
# Ejemplo de configuración personalizada
services:
  bot-pendientes:
    # ... configuración base ...
    
    # Recursos personalizados
    deploy:
      resources:
        limits:
          memory: 512M
          cpus: '1.0'
    
    # Variables de entorno adicionales
    environment:
      - LOG_LEVEL=debug
      - NODE_ENV=production
```

## 📊 Monitoreo y Logs

### Ver Logs

```bash
# Logs en tiempo real
docker-compose logs -f bot-pendientes

# Últimas 100 líneas
docker-compose logs --tail=100 bot-pendientes

# Logs específicos por timestamp
docker-compose logs --since="2024-01-01" bot-pendientes
```

### Health Check

El contenedor incluye un health check automático:

```bash
# Verificar estado del contenedor
docker ps

# Ver detalles del health check
docker inspect telegram-todo-bot | grep -A 10 Health
```

## 🔒 Seguridad

### Mejores Prácticas

1. **Usuario no-root**: El contenedor ejecuta como usuario `botuser`
2. **Variables seguras**: Nunca incluir tokens en el Dockerfile
3. **Permisos mínimos**: Solo permisos necesarios en directorios
4. **Imagen base segura**: Usar Alpine Linux minimalista

### Configuración de Seguridad

```bash
# Escanear vulnerabilidades (opcional)
docker scan bot-pendientes:latest

# Ejecutar como usuario específico
docker run --user 1001:1001 bot-pendientes:latest
```

## 🚨 Solución de Problemas

### Problemas Comunes

1. **Container no inicia**:
   ```bash
   # Verificar logs
   docker logs telegram-todo-bot
   
   # Verificar variables de entorno
   docker exec telegram-todo-bot env
   ```

2. **Error de permisos**:
   ```bash
   # Crear directorio de logs con permisos correctos
   mkdir -p logs
   chmod 755 logs
   ```

3. **Problemas de red**:
   ```bash
   # Verificar conectividad
   docker exec telegram-todo-bot ping google.com
   
   # Verificar puertos
   docker port telegram-todo-bot
   ```

### Debugging

```bash
# Ejecutar contenedor en modo interactivo
docker run -it --rm --env-file .env bot-pendientes:latest sh

# Acceder a contenedor en ejecución
docker exec -it telegram-todo-bot sh

# Verificar configuración
docker exec telegram-todo-bot node -e "console.log(process.env)"
```

## 📈 Escalabilidad

### Múltiples Instancias

```yaml
# docker-compose.yml para múltiples instancias
version: '3.8'
services:
  bot-pendientes:
    # ... configuración base ...
    deploy:
      replicas: 3
```

### Con Load Balancer

```yaml
# Ejemplo con nginx como proxy
services:
  nginx:
    image: nginx:alpine
    ports:
      - "80:80"
    depends_on:
      - bot-pendientes
  
  bot-pendientes:
    # ... configuración base ...
    deploy:
      replicas: 2
```

## 🔄 Actualizaciones

```bash
# Actualizar a nueva versión
git pull
npm run compose:down
npm run compose:build
npm run compose:up
```

---

💡 **Tip**: Usar `docker-compose` para desarrollo y `kubectl` para producción en Kubernetes.
