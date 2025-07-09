const winston = require("winston");

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

module.exports = {
  logger,
  logUserInteraction
};
