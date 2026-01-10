/**
 * Error handling middleware
 * @param {Object} logger - Logger instance
 * @returns {Function} Express error handling middleware
 */
export function createErrorHandler(logger) {
  return function errorHandler(err, req, res, next) {
    logger.error(`Unhandled error for ${req.path}: ${err.message}`);
    logger.error(`Stack trace: ${err.stack}`);

    // Don't leak error details in production
    if (process.env.NODE_ENV === 'production') {
      return res.status(500).send('Internal Server Error');
    }

    res.status(500).json({
      error: err.message,
      stack: err.stack,
      path: req.path,
    });
  };
}

export default createErrorHandler;