import express from 'express';
import expressWs from 'express-ws';
import path from 'path';
import mime from 'mime';
import querystring from 'querystring';

import { createRouter } from '../routes/index.js';
import { createRequestLogger, createErrorHandler } from './middleware/index.js';
import {
  DirectoryController,
  FileController,
  SearchController,
  ActionController,
} from '../controllers/index.js';

/**
 * Create and configure the Express application
 * @param {Object} config - Application configuration
 * @param {Object} logger - Logger instance
 * @param {Object} fileSystemService - File system service instance
 * @param {Object} mediaService - Media service instance
 * @param {Object} webSocketService - WebSocket service instance
 * @returns {Object} Configured Express application
 */
export function createApp(config, logger, fileSystemService, mediaService, webSocketService) {
  const app = express();
  expressWs(app);

  // Configure Express
  app.set('views', config.paths.viewsAbsolute);
  app.set('view engine', 'pug');

  // Request logging middleware
  app.use(createRequestLogger(logger));

  // Static file serving for public assets (/__* routes)
  app.get('/__*', (req, res) => {
    const file_path = querystring.unescape(req.path.substring(3));
    const content_type = mime.lookup(file_path);
    const options = {
      root: config.paths.publicAbsolute,
      dotfiles: 'deny',
      headers: {
        'Content-Type': content_type,
      },
    };

    res.sendFile(file_path, options);
  });

  // WebSocket endpoint for messaging
  app.ws('/messaging', (ws, req) => {
    webSocketService.addClient(ws, req);
  });

  // Initialize controllers
  const directoryController = new DirectoryController(fileSystemService, mediaService, config, logger);
  const fileController = new FileController(fileSystemService, config, logger);
  const searchController = new SearchController(fileSystemService, logger);
  const actionController = new ActionController(mediaService, logger);

  // Create and mount main router
  const router = createRouter({
    config,
    logger,
    fileSystemService,
    mediaService,
    webSocketService,
    directoryController,
    fileController,
    searchController,
    actionController,
  });

  app.use(router);

  // Error handling middleware (should be last)
  app.use(createErrorHandler(logger));

  return app;
}

export default createApp;