# 🚀 GitHub Actions & Container Registry

Esta guía explica cómo usar GitHub Actions para construir y publicar automáticamente el bot en GitHub Container Registry (GHCR).

## 🔧 Configuración Inicial

### 1. Habilitar GitHub Container Registry

1. Ve a tu repositorio en GitHub
2. Ve a **Settings** → **Actions** → **General**
3. En **Workflow permissions**, selecciona **Read and write permissions**
4. Marca **Allow GitHub Actions to create and approve pull requests**

### 2. Configurar Visibilidad del Package

Por defecto, los packages son privados. Para hacerlos públicos:

1. Ve a tu perfil de GitHub → **Packages**
2. Selecciona el package `bot-pendientes`
3. **Package settings** → **Change visibility** → **Public**

## 🔄 Workflow Automático

El archivo `.github/workflows/docker-publish.yml` se ejecuta automáticamente cuando:

- ✅ Haces push a `main` o `master`
- ✅ Creas un tag con formato `v*.*.*` (ej: `v2.0.0`)
- ✅ Abres/actualizas un Pull Request

### Tags Generados Automáticamente

| Trigger | Tags Generados |
|---------|----------------|
| Push a `main` | `ghcr.io/usuario/bot-pendientes:latest` |
| Tag `v2.1.0` | `ghcr.io/usuario/bot-pendientes:v2.1.0`, `ghcr.io/usuario/bot-pendientes:2.1`, `ghcr.io/usuario/bot-pendientes:2` |
| Pull Request | `ghcr.io/usuario/bot-pendientes:pr-123` |

## 📦 Scripts Disponibles

### GitHub Container Registry

```bash
# Login manual a GHCR (necesitas GITHUB_TOKEN)
export GITHUB_TOKEN=tu_personal_access_token
npm run ghcr:login

# Construir y subir imagen manualmente
npm run ghcr:build-push

# Ejecutar desde GHCR
npm run docker:run-ghcr
```

### Comandos Docker GHCR

```bash
# Descargar imagen desde GHCR
docker pull ghcr.io/tu-usuario/bot-pendientes:latest

# Ejecutar contenedor desde GHCR
docker run -d --name telegram-bot --env-file .env ghcr.io/tu-usuario/bot-pendientes:latest

# Ver imágenes disponibles
docker images | grep ghcr.io
```

## 🏷️ Versionado con Tags

### Crear Release con Tag

```bash
# Crear y push tag de versión
git tag v2.1.0
git push origin v2.1.0

# O crear release desde GitHub
# Esto automáticamente creará el tag y ejecutará el workflow
```

### Formato de Tags Semánticos

- `v1.0.0` - Release principal
- `v1.1.0` - Nuevas características
- `v1.1.1` - Bug fixes
- `v2.0.0-beta.1` - Pre-release

## 📊 Monitoreo del Build

### Ver Status del Workflow

1. Ve a tu repositorio → **Actions**
2. Selecciona el workflow **"Build and Push Docker Image"**
3. Ve los logs en tiempo real

### Verificar Imagen Publicada

```bash
# Verificar que la imagen se subió correctamente
curl -H "Authorization: Bearer $GITHUB_TOKEN" \
  https://ghcr.io/v2/tu-usuario/bot-pendientes/tags/list
```

## 🔒 Seguridad y Permisos

### Permisos Requeridos

El workflow usa `GITHUB_TOKEN` automático con permisos para:
- ✅ Leer contenido del repositorio
- ✅ Escribir packages en GHCR
- ✅ Crear attestations de seguridad

### Personal Access Token (Opcional)

Para uso manual, crea un PAT con scopes:
- `write:packages`
- `read:packages`
- `delete:packages` (opcional)

## 🚨 Solución de Problemas

### Error: "Permission denied"

```bash
# Verificar permisos del repositorio
# Settings → Actions → General → Workflow permissions
```

### Error: "Package not found"

```bash
# Verificar que el package existe y es público
# Profile → Packages → bot-pendientes → Package settings
```

### Build Fallido

```bash
# Ver logs detallados en Actions tab
# Verificar que el Dockerfile está en la raíz
# Confirmar que .dockerignore está configurado
```

## 📈 Optimizaciones Avanzadas

### Multi-Platform Builds

El workflow construye para:
- `linux/amd64` (x86_64)
- `linux/arm64` (Apple Silicon, ARM servers)

### Cache de Layers

- Usa GitHub Actions cache para acelerar builds
- Reutiliza layers entre builds
- Reduce tiempo de construcción ~50%

### Attestations de Seguridad

- Genera provenance automáticamente
- Verificable con `cosign` o `slsa-verifier`
- Cumple con SLSA Level 3

---

💡 **Tip**: Usa tags semánticos para releases automáticos y `latest` para desarrollo continuo.

## 🔄 Workflow de Desarrollo Recomendado

1. **Desarrollo**: Push a branches → Solo build, no push
2. **Testing**: PR → Build y test, no push  
3. **Release**: Merge a main → Push `latest`
4. **Version**: Tag → Push versión específica

```bash
# Ejemplo de release completo
git checkout main
git pull origin main
git tag v2.1.0
git push origin v2.1.0
# ✅ Automáticamente construye y publica v2.1.0, 2.1, 2, latest
```
