import express from 'express';
import querystring from 'querystring';
import path from 'path';

/**
 * Create and configure the main application router
 * @param {Object} options - Router options including services and controllers
 * @returns {express.Router} Configured Express router
 */
export function createRouter(options) {
  const {
    config,
    logger,
    fileSystemService,
    mediaService,
    webSocketService,
    directoryController,
    fileController,
    searchController,
    actionController,
  } = options;

  const router = express.Router();
  const root = config.server.rootDirectory;

  /**
   * Main catch-all route handler
   * Handles all GET requests and routes to appropriate controller
   */
  router.get('*', async (req, res) => {
    try {
      // Parse file path from request
      const file_path = querystring.unescape(req.path);
      const is_raw = !!req.query.raw;
      const leaf = path.join(root, file_path);

      // Attach to request for controllers to use
      req.file_path = file_path;
      req.is_raw = is_raw;
      req.leaf = leaf;

      logger.info(`Processing request: ${req.path} -> ${leaf}`);

      // Get file stats to determine if directory or file
      let state;
      try {
        state = await fileSystemService.getFileStats(leaf);
      } catch (err) {
        if (err.message.includes('not found')) {
          logger.error(`File/directory not found: ${leaf}`);
          return res.status(404).send('File/directory not found');
        }
        throw err;
      }

      // Route based on file type and query parameters
      const { key, action } = req.query;

      if (state.isDirectory()) {
        if (key) {
          // Search request
          await searchController.searchDirectory(req, res);
        } else if (action) {
          // Action request
          await actionController.handleAction(req, res);
        } else {
          // Directory listing
          await directoryController.listDirectory(req, res);
        }
      } else if (state.isFile()) {
        // File serving
        await fileController.serveFile(req, res);
      } else {
        res.end('not implemented');
      }
    } catch (err) {
      logger.error(`Error processing request for ${req.path}: ${err.message}`);
      logger.error(`Stack trace: ${err.stack}`);
      res.status(400).end();
    }
  });

  return router;
}

export default createRouter;