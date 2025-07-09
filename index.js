const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config();

// Importar módulos personalizados
const { logger } = require('./src/config/logger');
const TaskManager = require('./src/services/taskManager');
const TriliumService = require('./src/services/triliumService');
const BotCommands = require('./src/commands/botCommands');

/**
 * Aplicación principal del Bot de Telegram para gestión de tareas
 */
class TodoBot {
  constructor() {
    this.validateConfig();
    this.initializeServices();
    this.setupBot();
  }

  /**
   * Validar la configuración requerida
   */
  validateConfig() {
    const requiredEnvVars = [
      'TELEGRAM_BOT_TOKEN',
      'TRILIUM_API_URL',
      'TRILIUM_API_TOKEN'
    ];

    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      const errorMsg = `Missing required environment variables: ${missingVars.join(', ')}`;
      logger.error("Configuration validation failed", { missingVars });
      throw new Error(errorMsg);
    }

    logger.info("Configuration validated successfully");
  }

  /**
   * Inicializar los servicios
   */
  initializeServices() {
    // Inicializar gestor de tareas
    this.taskManager = new TaskManager();
    
    // Inicializar servicio de Trilium
    this.triliumService = new TriliumService(
      process.env.TRILIUM_API_URL,
      process.env.TRILIUM_API_TOKEN
    );

    logger.info("Services initialized successfully");
  }

  /**
   * Configurar el bot de Telegram
   */
  setupBot() {
    // Crear instancia del bot
    this.bot = new TelegramBot(process.env.TELEGRAM_BOT_TOKEN, { polling: true });
    
    // Configurar comandos del bot
    this.botCommands = new BotCommands(this.bot, this.taskManager, this.triliumService);

    logger.info("Telegram bot initialized successfully");
  }

  /**
   * Iniciar el bot y cargar datos existentes
   */
  async start() {
    try {
      logger.info("🤖 Bot de tareas iniciado correctamente!");
      console.log("🤖 Bot de tareas iniciado correctamente!");
      console.log("📝 Los logs se guardan en: error.log y combined.log");
      console.log("Para detener el bot, presiona Ctrl+C");

      // Probar conexión con Trilium
      await this.testTriliumConnection();

      // Cargar tareas existentes desde Trilium
      await this.loadExistingTasks();

      // Iniciar estadísticas periódicas
      this.startPeriodicStats();

      logger.info("Bot startup completed successfully");

    } catch (error) {
      logger.error("Failed to start bot", { error: error.message });
      throw error;
    }
  }

  /**
   * Probar la conexión con Trilium
   */
  async testTriliumConnection() {
    logger.info("Testing Trilium connection...");
    
    const connectionResult = await this.triliumService.testConnection();
    
    if (connectionResult.success) {
      logger.info("Trilium connection successful", { 
        status: connectionResult.status 
      });
      console.log("✅ Conexión con Trilium establecida correctamente");
    } else {
      logger.warn("Trilium connection failed", { 
        error: connectionResult.error,
        status: connectionResult.status 
      });
      console.log("⚠️ Advertencia: No se pudo conectar con Trilium");
      console.log("   El bot funcionará, pero la sincronización no estará disponible");
    }
  }

  /**
   * Cargar tareas existentes desde Trilium al inicio
   */
  async loadExistingTasks() {
    try {
      logger.info("Loading existing tasks from Trilium on startup...");
      
      const tasks = await this.triliumService.loadTasksFromTrilium();
      
      if (tasks.length > 0) {
        this.taskManager.loadTasks(tasks);
        logger.info("Existing tasks loaded successfully", { 
          taskCount: tasks.length 
        });
        console.log(`📋 Se cargaron ${tasks.length} tareas existentes desde Trilium`);
      } else {
        logger.info("No existing tasks found in Trilium");
        console.log("📋 No se encontraron tareas existentes en Trilium");
      }
    } catch (error) {
      logger.error("Failed to load existing tasks", { 
        error: error.message 
      });
      console.log("⚠️ Advertencia: No se pudieron cargar las tareas existentes desde Trilium");
    }
  }

  /**
   * Iniciar estadísticas periódicas
   */
  startPeriodicStats() {
    // Estadísticas cada 30 minutos
    setInterval(() => {
      const stats = this.taskManager.getStatistics();
      
      logger.info("Bot statistics", {
        ...stats,
        uptime: process.uptime(),
      });
    }, 30 * 60 * 1000); // 30 minutos
  }

  /**
   * Detener el bot de forma elegante
   */
  async stop() {
    logger.info("Stopping bot...");
    
    if (this.bot) {
      await this.bot.stopPolling();
    }
    
    logger.info("Bot stopped successfully");
    console.log("🛑 Bot detenido correctamente");
  }
}

// Función principal
async function main() {
  try {
    const todoBot = new TodoBot();
    await todoBot.start();

    // Manejar señales de terminación
    process.on('SIGINT', async () => {
      console.log('\n🛑 Recibida señal de terminación...');
      await todoBot.stop();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      console.log('\n🛑 Recibida señal de terminación...');
      await todoBot.stop();
      process.exit(0);
    });

  } catch (error) {
    logger.error("Failed to start application", { 
      error: error.message,
      stack: error.stack 
    });
    console.error("❌ Error al iniciar la aplicación:", error.message);
    process.exit(1);
  }
}

// Manejar errores no capturados
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection', { 
    reason: reason,
    promise: promise 
  });
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception', { 
    error: error.message,
    stack: error.stack 
  });
  process.exit(1);
});

// Iniciar la aplicación
if (require.main === module) {
  main();
}

module.exports = TodoBot;
