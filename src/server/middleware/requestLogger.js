/**
 * Request logging middleware
 * @param {Object} logger - Logger instance
 * @returns {Function} Express request logging middleware
 */
export function createRequestLogger(logger) {
  return function requestLogger(req, res, next) {
    const start = Date.now();

    // Log when response finishes
    res.on('finish', () => {
      const duration = Date.now() - start;
      logger.info(`${req.method} ${req.path} ${res.statusCode} - ${duration}ms`);
    });

    next();
  };
}

export default createRequestLogger;