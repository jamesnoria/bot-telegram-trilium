const axios = require("axios");
const { logger } = require('../config/logger');

/**
 * Servicio para interactuar con la API de Trilium
 */
class TriliumService {
  constructor(apiUrl, apiToken) {
    this.apiUrl = apiUrl;
    this.apiToken = apiToken;
  }

  /**
   * Formatear las tareas en HTML con checkboxes para Trilium
   * @param {Array} tasks - Array de tareas
   * @param {string} userId - ID del usuario
   * @param {string} username - Nombre del usuario
   * @returns {string} HTML formateado con las tareas pendientes
   */
  formatTasksAsHTML(tasks, userId, username) {
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

  /**
   * Enviar las tareas actuales a Trilium
   * @param {Array} tasks - Array de tareas
   * @param {string} userId - ID del usuario
   * @param {string} username - Nombre del usuario
   * @returns {Object} Resultado de la operación con success y status/error
   */
  async sendTasksToTrilium(tasks, userId, username) {
    try {
      // Generar el HTML de las tareas pendientes actuales
      const newTasksHTML = this.formatTasksAsHTML(tasks, userId, username);
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
        apiUrl: this.apiUrl
      });

      const response = await axios.put(this.apiUrl, newTasksHTML, {
        headers: {
          accept: "*/*",
          "Content-Type": "text/plain",
          Authorization: this.apiToken,
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
        apiUrl: this.apiUrl
      });

      return { success: false, error: error.message };
    }
  }

  /**
   * Recuperar el contenido existente de Trilium
   * @returns {Object} Resultado con success, content y error (opcional)
   */
  async getExistingContentFromTrilium() {
    try {
      const response = await axios.get(this.apiUrl, {
        headers: {
          accept: "text/html",
          Authorization: this.apiToken,
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
        apiUrl: this.apiUrl
      });

      return { success: false, error: error.message, content: "" };
    }
  }

  /**
   * Extraer tareas del HTML de Trilium
   * @param {string} htmlContent - Contenido HTML de Trilium
   * @returns {Array} Array de tareas extraídas
   */
  extractTasksFromHTML(htmlContent) {
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

  /**
   * Cargar tareas desde Trilium
   * @returns {Array} Array de tareas cargadas desde Trilium
   */
  async loadTasksFromTrilium() {
    try {
      logger.info("Loading existing tasks from Trilium...");
      
      const existingContentResult = await this.getExistingContentFromTrilium();
      
      if (existingContentResult.success) {
        const tasks = this.extractTasksFromHTML(existingContentResult.content);
        
        logger.info("Tasks loaded successfully from Trilium", {
          loadedTaskCount: tasks.length
        });

        return tasks;
      } else {
        logger.warn("Could not load tasks from Trilium", {
          error: existingContentResult.error
        });

        return [];
      }
    } catch (error) {
      logger.error("Failed to load tasks from Trilium", {
        error: error.message
      });

      return [];
    }
  }

  /**
   * Verificar la conexión con Trilium
   * @returns {Object} Resultado de la verificación de conexión
   */
  async testConnection() {
    try {
      const response = await axios.get(this.apiUrl, {
        headers: {
          accept: "text/html",
          Authorization: this.apiToken,
        },
      });

      logger.info("Trilium connection test successful", {
        responseStatus: response.status
      });

      return { 
        success: true, 
        status: response.status 
      };
    } catch (error) {
      logger.error("Trilium connection test failed", {
        error: error.message,
        responseStatus: error.response?.status
      });

      return { 
        success: false, 
        error: error.message,
        status: error.response?.status 
      };
    }
  }
}

module.exports = TriliumService;
