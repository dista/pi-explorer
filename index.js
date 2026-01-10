// Main application entry point
import config from './src/config/index.js';
import logging from './src/logging/index.js';
import { FileSystemService } from './src/services/fileSystem/index.js';
import { MediaService } from './src/services/media/index.js';
import { WebSocketService } from './src/services/notification/webSocketService.js';
import { createApp } from './src/server/index.js';

// Initialize logger with configuration
const logger = logging.initializeDefaultLogger(config);

// Initialize services
const fileSystemService = new FileSystemService(config, logger);
const webSocketService = new WebSocketService(logger);
const mediaService = new MediaService(config, logger, webSocketService);

// Create Express application
const app = createApp(config, logger, fileSystemService, mediaService, webSocketService);

// Initialize media service and start server
mediaService.init();
app.listen(config.server.port, config.server.host, () => {
  logger.info(`Server is running on port ${config.server.port} on ${config.server.host}`);
});