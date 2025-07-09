# Bot de Tareas Pendientes para Telegram

Un bot de Telegram escalable y modular para gestionar tareas pendientes (todos) que se sincroniza automáticamente con Trilium Notes vía API.

## 🚀 Características

- ✅ Gestión completa de tareas (agregar, completar, eliminar, limpiar)
- 🔄 Sincronización automática con Trilium Notes
- 📊 Logging detallado con Winston
- 🏗️ Arquitectura modular y escalable
- 💾 Persistencia de datos (recupera tareas al reiniciar)
- 📱 Interfaz intuitiva vía comandos de Telegram

## 📁 Estructura del Proyecto

```
bot-pendientes/
├── index.js                     # Aplicación principal
├── index_backup.js             # Respaldo de la versión anterior
├── package.json                # Dependencias del proyecto
├── .env                        # Variables de entorno
├── .gitignore                  # Archivos ignorados por Git
├── README.md                   # Este archivo
├── combined.log                # Logs combinados
├── error.log                   # Logs de errores
└── src/
    ├── config/
    │   └── logger.js           # Configuración de logging
    ├── services/
    │   ├── taskManager.js      # Gestión de tareas
    │   └── triliumService.js   # Integración con Trilium
    ├── commands/
    │   └── botCommands.js      # Comandos del bot
    └── utils/
        └── messageFormatter.js # Utilidades de formateo
```

## 🏗️ Arquitectura Modular

### 📦 Módulos Principales

#### `TaskManager` (`src/services/taskManager.js`)
- Gestión completa del ciclo de vida de las tareas
- Manejo de usuarios y persistencia en memoria
- Transferencia automática de tareas al iniciar
- Estadísticas de uso

#### `TriliumService` (`src/services/triliumService.js`)
- Integración completa con la API de Trilium
- Formateo de tareas en HTML con checkboxes
- Extracción de tareas desde HTML existente
- Pruebas de conexión y manejo de errores

#### `BotCommands` (`src/commands/botCommands.js`)
- Todos los comandos del bot de Telegram
- Manejo de eventos y errores
- Sincronización automática tras cambios
- Logging detallado de interacciones

#### `MessageFormatter` (`src/utils/messageFormatter.js`)
- Utilidades para formatear mensajes
- Plantillas de respuestas estándar
- Formateo de estadísticas y resumenes

#### `Logger` (`src/config/logger.js`)
- Configuración centralizada de Winston
- Logging de interacciones de usuario
- Logs estructurados en JSON

## 🛠️ Comandos Disponibles

| Comando | Descripción | Ejemplo |
|---------|-------------|---------|
| `/start` | Iniciar el bot y mostrar bienvenida | `/start` |
| `/todo` | Ver todas las tareas | `/todo` |
| `/add <tarea>` | Agregar nueva tarea | `/add Comprar leche` |
| `/complete <número>` | Marcar tarea como completada | `/complete 1` |
| `/delete <número>` | Eliminar tarea | `/delete 2` |
| `/clear` | Limpiar todas las tareas | `/clear` |
| `/sync` | Sincronizar manualmente con Trilium | `/sync` |
| `/help` | Mostrar ayuda | `/help` |

## ⚙️ Configuración

### Variables de Entorno

Crear un archivo `.env` con:

```env
TELEGRAM_BOT_TOKEN=tu_token_del_bot_de_telegram
TRILIUM_API_URL=https://tu-trilium.com/api/notes/ID_DE_LA_NOTA/content
TRILIUM_API_TOKEN=tu_token_de_api_de_trilium
```

### Instalación

1. **Clonar o descargar el proyecto**
2. **Instalar dependencias:**
   ```bash
   npm install
   ```
3. **Configurar variables de entorno** (crear archivo `.env`)
4. **Ejecutar el bot:**
   ```bash
   npm start
   # o directamente
   node index.js
   ```

## 📦 Dependencias

```json
{
  "node-telegram-bot-api": "^0.66.0",
  "winston": "^3.11.0",
  "axios": "^1.6.2",
  "dotenv": "^16.3.1"
}
```

## 🔄 Flujo de Sincronización

1. **Al iniciar:** El bot carga automáticamente las tareas existentes desde Trilium
2. **Tras cada cambio:** Sincronización automática con Trilium
3. **Formato en Trilium:** Lista HTML con checkboxes deshabilitados
4. **Persistencia:** Las tareas se transfieren al primer usuario que interactúe tras el arranque

## 📊 Logging y Monitoreo

- **Logs estructurados** en formato JSON
- **Interacciones de usuario** completamente registradas
- **Estadísticas periódicas** cada 30 minutos
- **Archivos de log:**
  - `combined.log`: Todos los logs
  - `error.log`: Solo errores

## 🚀 Desarrollo y Escalabilidad

### Ventajas de la Arquitectura Modular

1. **Separación de responsabilidades:** Cada módulo tiene una función específica
2. **Fácil mantenimiento:** Cambios aislados sin afectar otros componentes
3. **Testeable:** Cada módulo puede probarse independientemente
4. **Extensible:** Fácil agregar nuevas funcionalidades
5. **Reutilizable:** Los servicios pueden usarse en otras aplicaciones

### Extensiones Futuras

- **Base de datos real:** Reemplazar almacenamiento en memoria
- **Multiusuario:** Gestión avanzada de usuarios múltiples
- **API REST:** Exposer funcionalidades vía API
- **Notificaciones:** Recordatorios automáticos
- **Categorías:** Organización de tareas por categorías
- **Fechas límite:** Gestión de deadlines

## 🐛 Solución de Problemas

### Problemas Comunes

1. **Error de conexión con Trilium:**
   - Verificar URL de la API
   - Comprobar token de autorización
   - Revisar logs en `error.log`

2. **Bot no responde:**
   - Verificar token de Telegram
   - Comprobar conexión a internet
   - Revisar logs para errores

3. **Tareas no se sincronizan:**
   - Usar comando `/sync` manual
   - Verificar permisos en Trilium
   - Revisar formato de la nota

### Logs y Debugging

```bash
# Ver logs en tiempo real
tail -f combined.log

# Ver solo errores
tail -f error.log

# Ver logs estructurados
cat combined.log | jq '.'
```

## 📄 Licencia

Este proyecto es de uso libre para fines educativos y personales.

## 🤝 Contribuciones

Las contribuciones son bienvenidas. Por favor:

1. Fork del proyecto
2. Crear rama para la funcionalidad
3. Commit con mensajes descriptivos
4. Pull request con descripción detallada

---

**Desarrollado con ❤️ usando Node.js, Telegram Bot API y Trilium Notes**
