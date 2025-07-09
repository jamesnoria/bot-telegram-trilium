const TelegramBot = require("node-telegram-bot-api");
const winston = require("winston");
const axios = require("axios");
require("dotenv").config();

// Configurar winston para logging
const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: "telegram-bot" },
  transports: [
    new winston.transports.File({ filename: "error.log", level: "error" }),
    new winston.transports.File({ filename: "combined.log" }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.timestamp(),
        winston.format.printf(({ timestamp, level, message, ...meta }) => {
          return `${timestamp} [${level}]: ${message} ${
            Object.keys(meta).length ? JSON.stringify(meta, null, 2) : ""
          }`;
        })
      ),
    }),
  ],
});

// Función para registrar interacciones de usuario
function logUserInteraction(msg, action, details = {}) {
  const logData = {
    userId: msg.from.id,
    username: msg.from.username || "unknown",
    firstName: msg.from.first_name || "unknown",
    chatId: msg.chat.id,
    chatType: msg.chat.type,
    action: action,
    timestamp: new Date().toISOString(),
    messageId: msg.message_id,
    ...details,
  };

  logger.info(`User interaction: ${action}`, logData);
}

// Token del bot desde el archivo .env
const token = process.env.TELEGRAM_BOT_TOKEN;

// Configuración de la API de Trilium
const TRILIUM_API_URL = process.env.TRILIUM_API_URL;
const TRILIUM_API_TOKEN = process.env.TRILIUM_API_TOKEN;

// Crear instancia del bot
const bot = new TelegramBot(token, { polling: true });

// Almacenar las tareas en memoria (en producción usar una base de datos)
const userTasks = {};

// Función para obtener las tareas de un usuario
function getUserTasks(userId) {
  if (!userTasks[userId]) {
    userTasks[userId] = [];
    
    // Si es la primera vez que este usuario interactúa y hay tareas cargadas desde Trilium,
    // transferirlas a este usuario
    if (userTasks['startup_tasks'] && userTasks['startup_tasks'].length > 0) {
      userTasks[userId] = [...userTasks['startup_tasks']];
      delete userTasks['startup_tasks']; // Limpiar las tareas temporales
      
      logger.info("Transferred startup tasks to user", {
        userId,
        transferredTaskCount: userTasks[userId].length
      });
    }
  }
  return userTasks[userId];
}

// Función para formatear la lista de tareas
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

// Función para formatear las tareas en HTML con checkboxes simples
function formatTasksAsHTML(tasks, userId, username) {
  // Filtrar solo las tareas pendientes (no completadas)
  const pendingTasks = tasks.filter(task => !task.completed);
  
  if (pendingTasks.length === 0) {
    return '<p>✅ No hay tareas pendientes</p>';
  }

  let html = '<ul class="todo-list">';
  
  pendingTasks.forEach((task) => {
    html += `<li><label class="todo-list__label"><input type="checkbox" disabled="disabled"><span class="todo-list__label__description">&nbsp;${task.text}&nbsp;</span></label></li>`;
  });
  
  html += '</ul>';

  return html;
}

// Función para enviar las tareas a Trilium
async function sendTasksToTrilium(tasks, userId, username) {
  try {
    // Generar el HTML de las tareas pendientes actuales
    const newTasksHTML = formatTasksAsHTML(tasks, userId, username);
    const pendingTasks = tasks.filter(task => !task.completed);
    
    // Log del contenido que se va a enviar
    logger.info("Sending current tasks HTML content to Trilium", {
      userId,
      username,
      totalTasks: tasks.length,
      pendingTasks: pendingTasks.length,
      completedTasks: tasks.length - pendingTasks.length,
      contentLength: newTasksHTML.length,
      contentPreview: newTasksHTML.substring(0, 300) + '...',
      apiUrl: TRILIUM_API_URL
    });

    const response = await axios.put(TRILIUM_API_URL, newTasksHTML, {
      headers: {
        accept: "*/*",
        "Content-Type": "text/plain",
        Authorization: TRILIUM_API_TOKEN,
      },
    });

    logger.info("Current tasks sent to Trilium successfully", {
      userId,
      username,
      taskCount: tasks.length,
      responseStatus: response.status,
      responseData: response.data
    });

    return { success: true, status: response.status };
  } catch (error) {
    logger.error("Failed to send current tasks to Trilium", {
      userId,
      username,
      error: error.message,
      responseData: error.response?.data,
      responseStatus: error.response?.status,
      apiUrl: TRILIUM_API_URL
    });

    return { success: false, error: error.message };
  }
}

// Función para recuperar el contenido existente de Trilium
async function getExistingContentFromTrilium() {
  try {
    const response = await axios.get(TRILIUM_API_URL, {
      headers: {
        accept: "text/html",
        Authorization: TRILIUM_API_TOKEN,
      },
    });

    logger.info("Existing content retrieved from Trilium", {
      contentLength: response.data ? response.data.length : 0,
      responseStatus: response.status
    });

    return { success: true, content: response.data || "" };
  } catch (error) {
    logger.error("Failed to retrieve existing content from Trilium", {
      error: error.message,
      responseData: error.response?.data,
      responseStatus: error.response?.status,
      apiUrl: TRILIUM_API_URL
    });

    return { success: false, error: error.message, content: "" };
  }
}

// Función para extraer tareas del HTML de Trilium
function extractTasksFromHTML(htmlContent) {
  const tasks = [];
  
  if (!htmlContent || htmlContent.trim() === "") {
    return tasks;
  }

  // Buscar todas las tareas en el HTML usando regex
  const taskRegex = /<span class="todo-list__label__description">&nbsp;(.+?)&nbsp;<\/span>/g;
  let match;
  
  while ((match = taskRegex.exec(htmlContent)) !== null) {
    const taskText = match[1];
    tasks.push({
      text: taskText,
      completed: false, // Las tareas en Trilium son siempre pendientes
      createdAt: new Date()
    });
  }

  logger.info("Extracted tasks from Trilium HTML", {
    extractedTaskCount: tasks.length,
    tasks: tasks.map(t => t.text)
  });

  return tasks;
}

// Función para cargar tareas desde Trilium al inicio
async function loadTasksFromTrilium() {
  try {
    logger.info("Loading existing tasks from Trilium on startup...");
    
    const existingContentResult = await getExistingContentFromTrilium();
    
    if (existingContentResult.success) {
      const tasks = extractTasksFromHTML(existingContentResult.content);
      
      if (tasks.length > 0) {
        // Como no sabemos de qué usuario son las tareas, las asignamos a un usuario por defecto
        // o las mantenemos en un almacén global hasta que alguien interactúe
        const defaultUserId = 'startup_tasks';
        userTasks[defaultUserId] = tasks;
        
        logger.info("Tasks loaded successfully from Trilium", {
          loadedTaskCount: tasks.length,
          userId: defaultUserId
        });
      }
    } else {
      logger.warn("Could not load tasks from Trilium on startup", {
        error: existingContentResult.error
      });
    }
  } catch (error) {
    logger.error("Failed to load tasks from Trilium on startup", {
      error: error.message
    });
  }
}

// Comando /start
bot.onText(/\/start/, (msg) => {
  const chatId = msg.chat.id;

  // Log de la interacción
  logUserInteraction(msg, "START_COMMAND", {
    isNewUser: !userTasks[msg.from.id],
  });

  const welcomeMessage = `
¡Hola! 👋 Soy tu bot de tareas pendientes.

Comandos disponibles:
📝 /todo - Ver todas tus tareas
➕ /add <tarea> - Agregar nueva tarea
✅ /complete <número> - Marcar tarea como completada
❌ /delete <número> - Eliminar tarea
🗑️ /clear - Limpiar todas las tareas
🔄 /sync - Sincronizar tareas con Trilium
ℹ️ /help - Ver esta ayuda

¡Empecemos a organizar tus tareas!
  `;

  bot
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

// Comando /todo - Mostrar todas las tareas
bot.onText(/\/todo/, (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const tasks = getUserTasks(userId);
  const message = formatTaskList(tasks);

  // Log de la interacción
  logUserInteraction(msg, "VIEW_TASKS", {
    taskCount: tasks.length,
    completedTasks: tasks.filter((task) => task.completed).length,
    pendingTasks: tasks.filter((task) => !task.completed).length,
  });

  bot
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

// Comando /add - Agregar nueva tarea
bot.onText(/\/add (.+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || msg.from.first_name || "Usuario";
  const taskText = match[1];

  const tasks = getUserTasks(userId);
  const newTask = {
    text: taskText,
    completed: false,
    createdAt: new Date(),
  };

  tasks.push(newTask);

  // Log de la interacción
  logUserInteraction(msg, "ADD_TASK", {
    taskText: taskText,
    taskLength: taskText.length,
    totalTasks: tasks.length,
  });

  try {
    // Enviar tarea agregada
    await bot.sendMessage(chatId, `✅ Tarea agregada: "${taskText}"`);

    // Sincronizar automáticamente con Trilium
    const syncResult = await sendTasksToTrilium(tasks, userId, username);

    if (syncResult.success) {
      await bot.sendMessage(
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
      await bot.sendMessage(
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

    await bot.sendMessage(
      chatId,
      "❌ Error al agregar la tarea. Intenta nuevamente."
    );
  }
});

// Comando /complete - Marcar tarea como completada
bot.onText(/\/complete (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || msg.from.first_name || "Usuario";
  const taskIndex = parseInt(match[1]) - 1;

  const tasks = getUserTasks(userId);

  if (taskIndex >= 0 && taskIndex < tasks.length) {
    const task = tasks[taskIndex];
    const wasAlreadyCompleted = task.completed;
    task.completed = true;

    // Log de la interacción
    logUserInteraction(msg, "COMPLETE_TASK", {
      taskIndex: taskIndex + 1,
      taskText: task.text,
      wasAlreadyCompleted,
      totalTasks: tasks.length,
      completedTasks: tasks.filter((t) => t.completed).length,
    });

    const message = wasAlreadyCompleted
      ? `ℹ️ La tarea "${task.text}" ya estaba completada.`
      : `✅ Tarea "${task.text}" marcada como completada!`;

    try {
      await bot.sendMessage(chatId, message);

      // Sincronizar automáticamente con Trilium solo si la tarea no estaba ya completada
      if (!wasAlreadyCompleted) {
        const syncResult = await sendTasksToTrilium(tasks, userId, username);

        if (syncResult.success) {
          await bot.sendMessage(
            chatId,
            "🔄 Sincronizado con Trilium automáticamente"
          );
          logger.info("Task completed and synced successfully", {
            chatId,
            userId,
            taskIndex: taskIndex + 1,
            taskText: task.text,
          });
        } else {
          await bot.sendMessage(
            chatId,
            "⚠️ Tarea completada pero falló la sincronización automática. Usa /sync para intentar nuevamente."
          );
          logger.warn("Task completed but sync failed", {
            chatId,
            userId,
            taskText: task.text,
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
    // Log de error de índice inválido
    logUserInteraction(msg, "COMPLETE_TASK_ERROR", {
      invalidTaskIndex: taskIndex + 1,
      totalTasks: tasks.length,
      errorType: "INVALID_INDEX",
    });

    bot
      .sendMessage(
        chatId,
        "❌ Número de tarea inválido. Usa /todo para ver tus tareas."
      )
      .then(() => {
        logger.warn("Invalid task index for completion", {
          chatId,
          userId,
          requestedIndex: taskIndex + 1,
          totalTasks: tasks.length,
        });
      });
  }
});

// Comando /delete - Eliminar tarea
bot.onText(/\/delete (\d+)/, async (msg, match) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || msg.from.first_name || "Usuario";
  const taskIndex = parseInt(match[1]) - 1;

  const tasks = getUserTasks(userId);

  if (taskIndex >= 0 && taskIndex < tasks.length) {
    const deletedTask = tasks.splice(taskIndex, 1)[0];

    // Log de la interacción
    logUserInteraction(msg, "DELETE_TASK", {
      taskIndex: taskIndex + 1,
      taskText: deletedTask.text,
      wasCompleted: deletedTask.completed,
      remainingTasks: tasks.length,
    });

    try {
      await bot.sendMessage(
        chatId,
        `🗑️ Tarea eliminada: "${deletedTask.text}"`
      );

      // Sincronizar automáticamente con Trilium
      const syncResult = await sendTasksToTrilium(tasks, userId, username);

      if (syncResult.success) {
        await bot.sendMessage(
          chatId,
          "🔄 Sincronizado con Trilium automáticamente"
        );
        logger.info("Task deleted and synced successfully", {
          chatId,
          userId,
          deletedTaskText: deletedTask.text,
          remainingTasks: tasks.length,
        });
      } else {
        await bot.sendMessage(
          chatId,
          "⚠️ Tarea eliminada pero falló la sincronización automática. Usa /sync para intentar nuevamente."
        );
        logger.warn("Task deleted but sync failed", {
          chatId,
          userId,
          deletedTaskText: deletedTask.text,
          syncError: syncResult.error,
        });
      }
    } catch (error) {
      logger.error("Failed to delete task or sync", {
        chatId,
        userId,
        taskText: deletedTask.text,
        error: error.message,
      });
    }
  } else {
    // Log de error de índice inválido
    logUserInteraction(msg, "DELETE_TASK_ERROR", {
      invalidTaskIndex: taskIndex + 1,
      totalTasks: tasks.length,
      errorType: "INVALID_INDEX",
    });

    bot
      .sendMessage(
        chatId,
        "❌ Número de tarea inválido. Usa /todo para ver tus tareas."
      )
      .then(() => {
        logger.warn("Invalid task index for deletion", {
          chatId,
          userId,
          requestedIndex: taskIndex + 1,
          totalTasks: tasks.length,
        });
      });
  }
});

// Comando /clear - Limpiar todas las tareas
bot.onText(/\/clear/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || msg.from.first_name || "Usuario";

  const tasks = getUserTasks(userId);
  const taskCount = tasks.length;
  const completedCount = tasks.filter((task) => task.completed).length;

  userTasks[userId] = [];

  // Log de la interacción
  logUserInteraction(msg, "CLEAR_ALL_TASKS", {
    clearedTaskCount: taskCount,
    completedTasksCleared: completedCount,
    pendingTasksCleared: taskCount - completedCount,
  });

  try {
    await bot.sendMessage(
      chatId,
      `🗑️ Todas las tareas han sido eliminadas. (${taskCount} tareas eliminadas)`
    );

    // Sincronizar automáticamente con Trilium (lista vacía)
    const syncResult = await sendTasksToTrilium([], userId, username);

    if (syncResult.success) {
      await bot.sendMessage(
        chatId,
        "🔄 Lista vacía sincronizada con Trilium automáticamente"
      );
      logger.info("All tasks cleared and synced successfully", {
        chatId,
        userId,
        clearedTaskCount: taskCount,
      });
    } else {
      await bot.sendMessage(
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

// Comando /help - Mostrar ayuda
bot.onText(/\/help/, (msg) => {
  const chatId = msg.chat.id;

  // Log de la interacción
  logUserInteraction(msg, "HELP_COMMAND");

  const helpMessage = `
📋 *Comandos del Bot de Tareas:*

📝 /todo - Ver todas tus tareas
➕ /add <tarea> - Agregar nueva tarea
✅ /complete <número> - Marcar tarea como completada
❌ /delete <número> - Eliminar tarea
🗑️ /clear - Limpiar todas las tareas
🔄 /sync - Sincronizar tareas con Trilium
ℹ️ /help - Ver esta ayuda

*Ejemplos:*
• /add Comprar leche
• /complete 1
• /delete 2
• /sync
  `;

  bot
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

// Comando /sync - Sincronizar tareas con Trilium
bot.onText(/\/sync/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const username = msg.from.username || msg.from.first_name || "Usuario";

  const tasks = getUserTasks(userId);

  // Log de la interacción
  logUserInteraction(msg, "SYNC_TASKS", {
    taskCount: tasks.length,
    completedTasks: tasks.filter((task) => task.completed).length,
    pendingTasks: tasks.filter((task) => !task.completed).length,
  });

  // Enviar mensaje de "procesando"
  const processingMessage = await bot.sendMessage(
    chatId,
    "🔄 Sincronizando tareas con Trilium..."
  );

  try {
    const result = await sendTasksToTrilium(tasks, userId, username);

    if (result.success) {
      await bot.editMessageText(
        `✅ *Tareas sincronizadas exitosamente con Trilium!*\n\n📊 Resumen:\n• Total de tareas: ${
          tasks.length
        }\n• Completadas: ${
          tasks.filter((task) => task.completed).length
        }\n• Pendientes: ${
          tasks.filter((task) => !task.completed).length
        }\n\n🔗 Las tareas han sido enviadas en formato HTML con checkboxes.`,
        {
          chat_id: chatId,
          message_id: processingMessage.message_id,
          parse_mode: "Markdown",
        }
      );

      logger.info("Sync successful message sent", {
        chatId,
        userId,
        taskCount: tasks.length,
      });
    } else {
      await bot.editMessageText(
        `❌ Error al sincronizar con Trilium.\n\nIntenta nuevamente en unos momentos. Si el problema persiste, contacta al administrador.`,
        {
          chat_id: chatId,
          message_id: processingMessage.message_id,
        }
      );

      logger.error("Sync failed message sent", {
        chatId,
        userId,
        error: result.error,
      });
    }
  } catch (error) {
    await bot.editMessageText(
      `❌ Error inesperado al sincronizar.\n\nPor favor, intenta nuevamente.`,
      {
        chat_id: chatId,
        message_id: processingMessage.message_id,
      }
    );

    logger.error("Unexpected sync error", {
      chatId,
      userId,
      error: error.message,
    });
  }
});

// Manejar mensajes que no son comandos
bot.on("message", (msg) => {
  const chatId = msg.chat.id;
  const text = msg.text;

  // Si el mensaje no es un comando, sugerir usar /help
  if (!text.startsWith("/")) {
    // Log de mensaje no reconocido
    logUserInteraction(msg, "UNRECOGNIZED_MESSAGE", {
      messageText: text,
      messageLength: text.length,
    });

    bot
      .sendMessage(
        chatId,
        "Usa /help para ver los comandos disponibles o /todo para ver tus tareas."
      )
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

// Manejar errores
bot.on("polling_error", (error) => {
  logger.error("Polling error occurred", {
    errorMessage: error.message,
    errorCode: error.code,
    errorStack: error.stack,
  });
});

// Manejar errores generales del bot
bot.on("error", (error) => {
  logger.error("Bot error occurred", {
    errorMessage: error.message,
    errorCode: error.code,
    errorStack: error.stack,
  });
});

// Log de inicio del bot
logger.info("🤖 Bot de tareas iniciado correctamente!");
console.log("🤖 Bot de tareas iniciado correctamente!");
console.log("📝 Los logs se guardan en: error.log y combined.log");
console.log("Para detener el bot, presiona Ctrl+C");

// Cargar tareas existentes desde Trilium al inicio
loadTasksFromTrilium();

// Estadísticas periódicas (cada 30 minutos)
setInterval(() => {
  const totalUsers = Object.keys(userTasks).length;
  const totalTasks = Object.values(userTasks).reduce(
    (acc, tasks) => acc + tasks.length,
    0
  );
  const completedTasks = Object.values(userTasks).reduce(
    (acc, tasks) => acc + tasks.filter((task) => task.completed).length,
    0
  );

  logger.info("Bot statistics", {
    totalUsers,
    totalTasks,
    completedTasks,
    pendingTasks: totalTasks - completedTasks,
    uptime: process.uptime(),
  });
}, 30 * 60 * 1000); // 30 minutos

// Cargar tareas desde Trilium al iniciar
loadTasksFromTrilium();
