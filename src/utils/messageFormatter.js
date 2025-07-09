/**
 * Utilidades para formatear mensajes y datos
 */

/**
 * Formatear la lista de tareas para mostrar en Telegram
 * @param {Array} tasks - Array de tareas
 * @returns {string} Mensaje formateado para Telegram
 */
function formatTaskList(tasks) {
  if (tasks.length === 0) {
    return "📝 No tienes tareas pendientes. ¡Perfecto!";
  }

  let message = "📋 *Tus tareas pendientes:*\n\n";
  tasks.forEach((task, index) => {
    const status = task.completed ? "✅" : "⏳";
    message += `${status} ${index + 1}. ${task.text}\n`;
  });

  return message;
}

/**
 * Formatear estadísticas de tareas
 * @param {Object} stats - Objeto con estadísticas
 * @returns {string} Mensaje formateado con estadísticas
 */
function formatTaskStats(stats) {
  return `📊 *Estadísticas de Tareas:*\n\n` +
         `👥 Usuarios activos: ${stats.totalUsers}\n` +
         `📝 Total de tareas: ${stats.totalTasks}\n` +
         `✅ Completadas: ${stats.completedTasks}\n` +
         `⏳ Pendientes: ${stats.pendingTasks}`;
}

/**
 * Formatear mensaje de resumen de sincronización
 * @param {Array} tasks - Array de tareas
 * @returns {string} Mensaje formateado del resumen
 */
function formatSyncSummary(tasks) {
  const completedTasks = tasks.filter((task) => task.completed).length;
  const pendingTasks = tasks.filter((task) => !task.completed).length;

  return `✅ *Tareas sincronizadas exitosamente con Trilium!*\n\n` +
         `📊 Resumen:\n` +
         `• Total de tareas: ${tasks.length}\n` +
         `• Completadas: ${completedTasks}\n` +
         `• Pendientes: ${pendingTasks}\n\n` +
         `🔗 Las tareas han sido enviadas en formato HTML con checkboxes.`;
}

/**
 * Obtener el nombre de usuario desde el objeto de mensaje de Telegram
 * @param {Object} msg - Mensaje de Telegram
 * @returns {string} Nombre de usuario formateado
 */
function getUserName(msg) {
  return msg.from.username || msg.from.first_name || "Usuario";
}

/**
 * Formatear mensaje de bienvenida
 * @returns {string} Mensaje de bienvenida formateado
 */
function getWelcomeMessage() {
  return `
¡Hola! 👋 Soy tu bot de tareas pendientes.

Comandos disponibles:
📝 /todo - Ver todas tus tareas
➕ /add <tarea> - Agregar nueva tarea
✅ /complete <número> - Marcar tarea como completada
❌ /delete <número> - Eliminar tarea
🗑️ /clear - Limpiar todas las tareas
🔄 /sync - Sincronizar tareas con Trilium
🔃 /reload - Recargar tareas desde Trilium
ℹ️ /help - Ver esta ayuda

¡Empecemos a organizar tus tareas!
  `;
}

/**
 * Formatear mensaje de ayuda
 * @returns {string} Mensaje de ayuda formateado
 */
function getHelpMessage() {
  return `
📋 *Comandos del Bot de Tareas:*

📝 /todo - Ver todas tus tareas
➕ /add <tarea> - Agregar nueva tarea
✅ /complete <número> - Marcar tarea como completada
❌ /delete <número> - Eliminar tarea
🗑️ /clear - Limpiar todas las tareas
🔄 /sync - Sincronizar tareas con Trilium
🔃 /reload - Recargar tareas desde Trilium
ℹ️ /help - Ver esta ayuda

*Ejemplos:*
• /add Comprar leche
• /complete 1
• /delete 2
• /sync
• /reload
  `;
}

/**
 * Formatear mensaje de error común
 * @param {string} errorType - Tipo de error
 * @returns {string} Mensaje de error formateado
 */
function getErrorMessage(errorType) {
  const errorMessages = {
    INVALID_INDEX: "❌ Número de tarea inválido. Usa /todo para ver tus tareas.",
    SYNC_FAILED: "❌ Error al sincronizar con Trilium.\n\nIntenta nuevamente en unos momentos. Si el problema persiste, contacta al administrador.",
    UNEXPECTED_ERROR: "❌ Error inesperado al procesar la solicitud.\n\nPor favor, intenta nuevamente.",
    UNRECOGNIZED_COMMAND: "Usa /help para ver los comandos disponibles o /todo para ver tus tareas."
  };

  return errorMessages[errorType] || errorMessages.UNEXPECTED_ERROR;
}

module.exports = {
  formatTaskList,
  formatTaskStats,
  formatSyncSummary,
  getUserName,
  getWelcomeMessage,
  getHelpMessage,
  getErrorMessage
};
