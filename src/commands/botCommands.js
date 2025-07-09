const { logger, logUserInteraction } = require('../config/logger');
const { 
  formatTaskList, 
  formatSyncSummary, 
  getUserName, 
  getWelcomeMessage, 
  getHelpMessage, 
  getErrorMessage 
} = require('../utils/messageFormatter');

/**
 * Clase para manejar los comandos del bot de Telegram
 */
class BotCommands {
  constructor(bot, taskManager, triliumService) {
    this.bot = bot;
    this.taskManager = taskManager;
    this.triliumService = triliumService;
    
    this.setupCommands();
    this.setupEventHandlers();
  }

  /**
   * Configurar todos los comandos del bot
   */
  setupCommands() {
    this.setupStartCommand();
    this.setupTodoCommand();
    this.setupAddCommand();
    this.setupCompleteCommand();
    this.setupDeleteCommand();
    this.setupClearCommand();
    this.setupHelpCommand();
    this.setupSyncCommand();
    this.setupReloadCommand();
  }

  /**
   * Configurar manejadores de eventos del bot
   */
  setupEventHandlers() {
    this.setupMessageHandler();
    this.setupErrorHandlers();
  }

  /**
   * Comando /start
   */
  setupStartCommand() {
    this.bot.onText(/\/start/, (msg) => {
      const chatId = msg.chat.id;

      // Log de la interacción
      logUserInteraction(msg, "START_COMMAND", {
        isNewUser: !this.taskManager.userTasks[msg.from.id],
      });

      const welcomeMessage = getWelcomeMessage();

      this.bot
        .sendMessage(chatId, welcomeMessage)
        .then(() => {
          logger.info("Welcome message sent successfully", {
            chatId,
            userId: msg.from.id,
          });
        })
        .catch((error) => {
          logger.error("Failed to send welcome message", {
            chatId,
            userId: msg.from.id,
            error: error.message,
          });
        });
    });
  }

  /**
   * Comando /todo - Mostrar todas las tareas
   */
  setupTodoCommand() {
    this.bot.onText(/\/todo/, (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;

      const tasks = this.taskManager.getUserTasks(userId);
      const message = formatTaskList(tasks);

      // Log de la interacción
      logUserInteraction(msg, "VIEW_TASKS", {
        taskCount: tasks.length,
        completedTasks: tasks.filter((task) => task.completed).length,
        pendingTasks: tasks.filter((task) => !task.completed).length,
      });

      this.bot
        .sendMessage(chatId, message, { parse_mode: "Markdown" })
        .then(() => {
          logger.info("Task list sent successfully", {
            chatId,
            userId,
            taskCount: tasks.length,
          });
        })
        .catch((error) => {
          logger.error("Failed to send task list", {
            chatId,
            userId,
            error: error.message,
          });
        });
    });
  }

  /**
   * Comando /add - Agregar nueva tarea
   */
  setupAddCommand() {
    this.bot.onText(/\/add (.+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const username = getUserName(msg);
      const taskText = match[1];

      try {
        // 1. PRIMERO: Sincronizar desde Trilium para capturar cambios externos
        logger.info("Syncing from Trilium before adding new task", {
          chatId,
          userId,
          taskText
        });

        const triliumTasks = await this.triliumService.loadTasksFromTrilium();
        
        if (triliumTasks.length > 0) {
          // Sincronizar las tareas existentes con los datos de Trilium
          const syncResult = this.taskManager.syncTasksFromTrilium(userId, triliumTasks);
          
          if (syncResult.success && (syncResult.changes.updated.length > 0 || syncResult.changes.added.length > 0)) {
            // Si hubo cambios, notificar al usuario
            let syncMessage = "🔄 *Sincronizado con Trilium antes de agregar:*\n";
            if (syncResult.changes.updated.length > 0) {
              syncMessage += `✅ ${syncResult.changes.updated.length} tarea(s) actualizadas\n`;
            }
            if (syncResult.changes.added.length > 0) {
              syncMessage += `🆕 ${syncResult.changes.added.length} tarea(s) nuevas encontradas\n`;
            }
            
            await this.bot.sendMessage(chatId, syncMessage, { parse_mode: "Markdown" });
            
            logger.info("Pre-add sync completed with changes", {
              chatId,
              userId,
              changes: syncResult.changes
            });
          }
        }

        // 2. SEGUNDO: Agregar la nueva tarea
        this.taskManager.addTask(userId, taskText, msg);
        const tasks = this.taskManager.getUserTasks(userId);

        // Enviar mensaje de confirmación
        await this.bot.sendMessage(chatId, `✅ Tarea agregada: "${taskText}"`);

        // 3. TERCERO: Sincronizar TODO con Trilium (incluyendo la nueva tarea)
        const syncResult = await this.triliumService.sendTasksToTrilium(tasks, userId, username);

        if (syncResult.success) {
          await this.bot.sendMessage(
            chatId,
            "🔄 Sincronizado con Trilium automáticamente"
          );
          logger.info("Task added and synced successfully", {
            chatId,
            userId,
            taskText,
            totalTasks: tasks.length,
          });
        } else {
          await this.bot.sendMessage(
            chatId,
            "⚠️ Tarea agregada pero falló la sincronización automática. Usa /sync para intentar nuevamente."
          );
          logger.warn("Task added but sync failed", {
            chatId,
            userId,
            taskText,
            syncError: syncResult.error,
          });
        }
      } catch (error) {
        logger.error("Failed to add task or sync", {
          chatId,
          userId,
          taskText,
          error: error.message,
        });

        await this.bot.sendMessage(
          chatId,
          "❌ Error al agregar la tarea. Intenta nuevamente."
        );
      }
    });
  }

  /**
   * Comando /complete - Marcar tarea como completada
   */
  setupCompleteCommand() {
    this.bot.onText(/\/complete (\d+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const username = getUserName(msg);
      const taskIndex = parseInt(match[1]) - 1;

      const result = this.taskManager.completeTask(userId, taskIndex, msg);

      if (result.success) {
        const message = result.wasAlreadyCompleted
          ? `ℹ️ La tarea "${result.task.text}" ya estaba completada.`
          : `✅ Tarea "${result.task.text}" marcada como completada!`;

        try {
          await this.bot.sendMessage(chatId, message);

          // Sincronizar automáticamente con Trilium solo si la tarea no estaba ya completada
          if (!result.wasAlreadyCompleted) {
            const tasks = this.taskManager.getUserTasks(userId);
            const syncResult = await this.triliumService.sendTasksToTrilium(tasks, userId, username);

            if (syncResult.success) {
              await this.bot.sendMessage(
                chatId,
                "🔄 Sincronizado con Trilium automáticamente"
              );
              logger.info("Task completed and synced successfully", {
                chatId,
                userId,
                taskIndex: taskIndex + 1,
                taskText: result.task.text,
              });
            } else {
              await this.bot.sendMessage(
                chatId,
                "⚠️ Tarea completada pero falló la sincronización automática. Usa /sync para intentar nuevamente."
              );
              logger.warn("Task completed but sync failed", {
                chatId,
                userId,
                taskText: result.task.text,
                syncError: syncResult.error,
              });
            }
          }
        } catch (error) {
          logger.error("Failed to process task completion or sync", {
            chatId,
            userId,
            taskIndex: taskIndex + 1,
            error: error.message,
          });
        }
      } else {
        this.bot
          .sendMessage(chatId, getErrorMessage("INVALID_INDEX"))
          .then(() => {
            logger.warn("Invalid task index for completion", {
              chatId,
              userId,
              requestedIndex: taskIndex + 1,
              totalTasks: this.taskManager.getUserTasks(userId).length,
            });
          });
      }
    });
  }

  /**
   * Comando /delete - Eliminar tarea
   */
  setupDeleteCommand() {
    this.bot.onText(/\/delete (\d+)/, async (msg, match) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const username = getUserName(msg);
      const taskIndex = parseInt(match[1]) - 1;

      const result = this.taskManager.deleteTask(userId, taskIndex, msg);

      if (result.success) {
        try {
          await this.bot.sendMessage(
            chatId,
            `🗑️ Tarea eliminada: "${result.deletedTask.text}"`
          );

          // Sincronizar automáticamente con Trilium
          const tasks = this.taskManager.getUserTasks(userId);
          const syncResult = await this.triliumService.sendTasksToTrilium(tasks, userId, username);

          if (syncResult.success) {
            await this.bot.sendMessage(
              chatId,
              "🔄 Sincronizado con Trilium automáticamente"
            );
            logger.info("Task deleted and synced successfully", {
              chatId,
              userId,
              deletedTaskText: result.deletedTask.text,
              remainingTasks: tasks.length,
            });
          } else {
            await this.bot.sendMessage(
              chatId,
              "⚠️ Tarea eliminada pero falló la sincronización automática. Usa /sync para intentar nuevamente."
            );
            logger.warn("Task deleted but sync failed", {
              chatId,
              userId,
              deletedTaskText: result.deletedTask.text,
              syncError: syncResult.error,
            });
          }
        } catch (error) {
          logger.error("Failed to delete task or sync", {
            chatId,
            userId,
            taskText: result.deletedTask.text,
            error: error.message,
          });
        }
      } else {
        this.bot
          .sendMessage(chatId, getErrorMessage("INVALID_INDEX"))
          .then(() => {
            logger.warn("Invalid task index for deletion", {
              chatId,
              userId,
              requestedIndex: taskIndex + 1,
              totalTasks: this.taskManager.getUserTasks(userId).length,
            });
          });
      }
    });
  }

  /**
   * Comando /clear - Limpiar todas las tareas
   */
  setupClearCommand() {
    this.bot.onText(/\/clear/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const username = getUserName(msg);

      const taskCount = this.taskManager.clearAllTasks(userId, msg);

      try {
        await this.bot.sendMessage(
          chatId,
          `🗑️ Todas las tareas han sido eliminadas. (${taskCount} tareas eliminadas)`
        );

        // Sincronizar automáticamente con Trilium (lista vacía)
        const syncResult = await this.triliumService.sendTasksToTrilium([], userId, username);

        if (syncResult.success) {
          await this.bot.sendMessage(
            chatId,
            "🔄 Lista vacía sincronizada con Trilium automáticamente"
          );
          logger.info("All tasks cleared and synced successfully", {
            chatId,
            userId,
            clearedTaskCount: taskCount,
          });
        } else {
          await this.bot.sendMessage(
            chatId,
            "⚠️ Tareas eliminadas pero falló la sincronización automática. Usa /sync para intentar nuevamente."
          );
          logger.warn("Tasks cleared but sync failed", {
            chatId,
            userId,
            clearedTaskCount: taskCount,
            syncError: syncResult.error,
          });
        }
      } catch (error) {
        logger.error("Failed to clear tasks or sync", {
          chatId,
          userId,
          error: error.message,
        });
      }
    });
  }

  /**
   * Comando /help - Mostrar ayuda
   */
  setupHelpCommand() {
    this.bot.onText(/\/help/, (msg) => {
      const chatId = msg.chat.id;

      // Log de la interacción
      logUserInteraction(msg, "HELP_COMMAND");

      const helpMessage = getHelpMessage();

      this.bot
        .sendMessage(chatId, helpMessage, { parse_mode: "Markdown" })
        .then(() => {
          logger.info("Help message sent successfully", {
            chatId,
            userId: msg.from.id,
          });
        })
        .catch((error) => {
          logger.error("Failed to send help message", {
            chatId,
            userId: msg.from.id,
            error: error.message,
          });
        });
    });
  }

  /**
   * Comando /sync - Sincronizar tareas con Trilium
   */
  setupSyncCommand() {
    this.bot.onText(/\/sync/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const username = getUserName(msg);

      const tasks = this.taskManager.getUserTasks(userId);

      // Log de la interacción
      logUserInteraction(msg, "SYNC_TASKS", {
        taskCount: tasks.length,
        completedTasks: tasks.filter((task) => task.completed).length,
        pendingTasks: tasks.filter((task) => !task.completed).length,
      });

      // Enviar mensaje de "procesando"
      const processingMessage = await this.bot.sendMessage(
        chatId,
        "🔄 Sincronizando tareas con Trilium..."
      );

      try {
        const result = await this.triliumService.sendTasksToTrilium(tasks, userId, username);

        if (result.success) {
          const successMessage = formatSyncSummary(tasks);
          
          await this.bot.editMessageText(successMessage, {
            chat_id: chatId,
            message_id: processingMessage.message_id,
            parse_mode: "Markdown",
          });

          logger.info("Sync successful message sent", {
            chatId,
            userId,
            taskCount: tasks.length,
          });
        } else {
          await this.bot.editMessageText(getErrorMessage("SYNC_FAILED"), {
            chat_id: chatId,
            message_id: processingMessage.message_id,
          });

          logger.error("Sync failed message sent", {
            chatId,
            userId,
            error: result.error,
          });
        }
      } catch (error) {
        await this.bot.editMessageText(getErrorMessage("UNEXPECTED_ERROR"), {
          chat_id: chatId,
          message_id: processingMessage.message_id,
        });

        logger.error("Unexpected sync error", {
          chatId,
          userId,
          error: error.message,
        });
      }
    });
  }

  /**
   * Comando /reload - Recargar tareas desde Trilium
   */
  setupReloadCommand() {
    this.bot.onText(/\/reload/, async (msg) => {
      const chatId = msg.chat.id;
      const userId = msg.from.id;
      const username = getUserName(msg);

      // Log de la interacción
      logUserInteraction(msg, "RELOAD_FROM_TRILIUM", {});

      // Enviar mensaje de "procesando"
      const processingMessage = await this.bot.sendMessage(
        chatId,
        "🔄 Recargando tareas desde Trilium..."
      );

      try {
        // Cargar tareas desde Trilium
        const triliumTasks = await this.triliumService.loadTasksFromTrilium();

        if (triliumTasks.length === 0) {
          await this.bot.editMessageText(
            "📝 No se encontraron tareas en Trilium.",
            {
              chat_id: chatId,
              message_id: processingMessage.message_id,
            }
          );
          return;
        }

        // Sincronizar con las tareas actuales del usuario
        const syncResult = this.taskManager.syncTasksFromTrilium(userId, triliumTasks);

        if (syncResult.success) {
          const currentTasks = this.taskManager.getUserTasks(userId);
          
          let message = `✅ *Tareas recargadas desde Trilium*\n\n`;
          message += `📊 Resumen:\n`;
          message += `• Total de tareas: ${syncResult.tasks.length}\n`;
          message += `• Completadas: ${syncResult.tasks.filter(t => t.completed).length}\n`;
          message += `• Pendientes: ${syncResult.tasks.filter(t => !t.completed).length}\n\n`;
          
          if (syncResult.changes.added.length > 0) {
            message += `🆕 Tareas nuevas: ${syncResult.changes.added.length}\n`;
          }
          if (syncResult.changes.updated.length > 0) {
            message += `🔄 Tareas actualizadas: ${syncResult.changes.updated.length}\n`;
          }
          if (syncResult.changes.preserved.length > 0) {
            message += `✨ Tareas preservadas: ${syncResult.changes.preserved.length}\n`;
          }

          await this.bot.editMessageText(message, {
            chat_id: chatId,
            message_id: processingMessage.message_id,
            parse_mode: "Markdown",
          });

          // Mostrar la lista actualizada
          setTimeout(async () => {
            const taskListMessage = formatTaskList(currentTasks);
            await this.bot.sendMessage(chatId, taskListMessage, {
              parse_mode: "Markdown",
            });
          }, 1000);

          logger.info("Tasks reloaded from Trilium successfully", {
            chatId,
            userId,
            totalTasks: syncResult.tasks.length,
            changes: syncResult.changes,
          });
        } else {
          await this.bot.editMessageText(
            "❌ Error al sincronizar las tareas recargadas.",
            {
              chat_id: chatId,
              message_id: processingMessage.message_id,
            }
          );

          logger.error("Failed to sync reloaded tasks", {
            chatId,
            userId,
          });
        }
      } catch (error) {
        await this.bot.editMessageText(
          "❌ Error al recargar tareas desde Trilium.\n\nVerifica la conexión con Trilium.",
          {
            chat_id: chatId,
            message_id: processingMessage.message_id,
          }
        );

        logger.error("Failed to reload tasks from Trilium", {
          chatId,
          userId,
          error: error.message,
        });
      }
    });
  }

  /**
   * Manejar mensajes que no son comandos
   */
  setupMessageHandler() {
    this.bot.on("message", (msg) => {
      const chatId = msg.chat.id;
      const text = msg.text;

      // Si el mensaje no es un comando, sugerir usar /help
      if (!text.startsWith("/")) {
        // Log de mensaje no reconocido
        logUserInteraction(msg, "UNRECOGNIZED_MESSAGE", {
          messageText: text,
          messageLength: text.length,
        });

        this.bot
          .sendMessage(chatId, getErrorMessage("UNRECOGNIZED_COMMAND"))
          .then(() => {
            logger.info("Unrecognized message response sent", {
              chatId,
              userId: msg.from.id,
              originalMessage: text,
            });
          })
          .catch((error) => {
            logger.error("Failed to send unrecognized message response", {
              chatId,
              userId: msg.from.id,
              error: error.message,
            });
          });
      }
    });
  }

  /**
   * Configurar manejadores de errores
   */
  setupErrorHandlers() {
    // Manejar errores de polling
    this.bot.on("polling_error", (error) => {
      logger.error("Polling error occurred", {
        errorMessage: error.message,
        errorCode: error.code,
        errorStack: error.stack,
      });
    });

    // Manejar errores generales del bot
    this.bot.on("error", (error) => {
      logger.error("Bot error occurred", {
        errorMessage: error.message,
        errorCode: error.code,
        errorStack: error.stack,
      });
    });
  }
}

module.exports = BotCommands;
