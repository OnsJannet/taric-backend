/**
 * Middleware for logging API requests
 */
const logger = require('../utils/loggerUtil');

/**
 * Logs details about incoming requests
 */
const requestLogger = (req, res, next) => {
  // Get the start time
  const start = Date.now();
  
  // Log the request
  logger.info('Request received', {
    method: req.method,
    url: req.originalUrl,
    ip: req.ip,
    userAgent: req.headers['user-agent']
  });
  
  // Once the response is finished, log the response details
  res.on('finish', () => {
    const duration = Date.now() - start;
    const logLevel = res.statusCode >= 400 ? 'warn' : 'info';
    
    logger[logLevel]('Request completed', {
      method: req.method,
      url: req.originalUrl,
      statusCode: res.statusCode,
      duration: `${duration}ms`
    });
  });
  
  next();
};

module.exports = requestLogger;
