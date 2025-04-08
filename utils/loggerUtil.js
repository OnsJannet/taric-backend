/**
 * Utility for centralized logging
 */
const fs = require('fs');
const path = require('path');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Log file paths
const errorLogPath = path.join(logsDir, 'error.log');
const accessLogPath = path.join(logsDir, 'access.log');
const scraperLogPath = path.join(logsDir, 'scraper.log');

/**
 * Log levels
 */
const LogLevel = {
  ERROR: 'ERROR',
  WARN: 'WARN',
  INFO: 'INFO',
  DEBUG: 'DEBUG'
};

/**
 * Formats a log message
 * @param {string} level - Log level
 * @param {string} message - Log message
 * @param {Object} meta - Additional metadata
 * @returns {string} - Formatted log message
 */
const formatLogMessage = (level, message, meta = {}) => {
  const timestamp = new Date().toISOString();
  return `[${timestamp}] [${level}] ${message} ${meta ? JSON.stringify(meta) : ''}`;
};

/**
 * Writes a log message to a file
 * @param {string} filePath - Path to log file
 * @param {string} message - Formatted log message
 */
const writeToFile = (filePath, message) => {
  fs.appendFile(filePath, message + '\n', (err) => {
    if (err) {
      console.error(`Failed to write to log file ${filePath}:`, err);
    }
  });
};

/**
 * Logs an error message
 * @param {string} message - Error message
 * @param {Object} meta - Additional metadata
 */
const error = (message, meta = {}) => {
  const formattedMessage = formatLogMessage(LogLevel.ERROR, message, meta);
  console.error(formattedMessage);
  writeToFile(errorLogPath, formattedMessage);
};

/**
 * Logs a warning message
 * @param {string} message - Warning message
 * @param {Object} meta - Additional metadata
 */
const warn = (message, meta = {}) => {
  const formattedMessage = formatLogMessage(LogLevel.WARN, message, meta);
  console.warn(formattedMessage);
  writeToFile(errorLogPath, formattedMessage);
};

/**
 * Logs an info message
 * @param {string} message - Info message
 * @param {Object} meta - Additional metadata
 */
const info = (message, meta = {}) => {
  const formattedMessage = formatLogMessage(LogLevel.INFO, message, meta);
  console.log(formattedMessage);
  writeToFile(accessLogPath, formattedMessage);
};

/**
 * Logs a debug message (only in development)
 * @param {string} message - Debug message
 * @param {Object} meta - Additional metadata
 */
const debug = (message, meta = {}) => {
  if (process.env.NODE_ENV !== 'production') {
    const formattedMessage = formatLogMessage(LogLevel.DEBUG, message, meta);
    console.log(formattedMessage);
  }
};

/**
 * Logs a scraper-specific message
 * @param {string} message - Scraper message
 * @param {Object} meta - Additional metadata
 */
const scraper = (message, meta = {}) => {
  const formattedMessage = formatLogMessage(LogLevel.INFO, message, meta);
  console.log(formattedMessage);
  writeToFile(scraperLogPath, formattedMessage);
};

/**
 * Logs an API request
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
const logRequest = (req, res) => {
  const meta = {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.headers['user-agent'],
    userId: req.user ? req.user.id : 'anonymous'
  };
  
  info('API Request', meta);
};

module.exports = {
  error,
  warn,
  info,
  debug,
  scraper,
  logRequest
};
