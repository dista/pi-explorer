import winston from 'winston';

/**
 * Creates a configured Winston logger instance
 * @param {Object} config - Configuration object
 * @param {Object} config.logging - Logging configuration
 * @param {string} config.logging.level - Log level (error, warn, info, debug)
 * @returns {winston.Logger} Configured logger instance
 */
export const createLogger = (config) => {
  const { level = 'info' } = config.logging || {};
  
  return winston.createLogger({
    level,
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.colorize(),
      winston.format.printf(({ timestamp, level, message, ...meta }) => {
        const metaString = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
        return `[${timestamp}] ${level}: ${message}${metaString}`;
      })
    ),
    transports: [
      new winston.transports.Console({
        stderrLevels: ['error', 'warn'],
      }),
    ],
    // Handle uncaught exceptions
    exceptionHandlers: [
      new winston.transports.Console({
        stderrLevels: ['error'],
      }),
    ],
    // Handle unhandled rejections
    rejectionHandlers: [
      new winston.transports.Console({
        stderrLevels: ['error'],
      }),
    ],
  });
};

/**
 * Default logger instance (for backward compatibility)
 * Note: This requires config to be loaded first
 */
let defaultLogger = null;

/**
 * Initialize the default logger with configuration
 * @param {Object} config - Configuration object
 */
export const initializeDefaultLogger = (config) => {
  if (!defaultLogger) {
    defaultLogger = createLogger(config);
  }
  return defaultLogger;
};

/**
 * Get the default logger instance
 * @returns {winston.Logger} Default logger instance
 * @throws {Error} If logger not initialized
 */
export const getDefaultLogger = () => {
  if (!defaultLogger) {
    throw new Error('Default logger not initialized. Call initializeDefaultLogger first.');
  }
  return defaultLogger;
};

export default {
  createLogger,
  initializeDefaultLogger,
  getDefaultLogger,
};