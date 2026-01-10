/**
 * WebSocket Service for real-time notifications
 */
export class WebSocketService {
  /**
   * @param {Object} logger - Logger instance
   */
  constructor(logger) {
    this.logger = logger;
    this.clients = new Set();
  }

  /**
   * Add a WebSocket client
   * @param {WebSocket} ws - WebSocket connection
   * @param {Object} req - HTTP request object
   */
  addClient(ws, req) {
    const clientIp = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
    this.clients.add(ws);
    this.logger.info(`New WebSocket connection from ${clientIp}`);

    // Set up event handlers
    ws.on('message', (msg) => {
      this.logger.info(`WebSocket message from ${clientIp}: ${msg}`);
      this.logger.info(`WebSocket Message length: ${msg.length} bytes`);
    });

    ws.on('close', (evt) => {
      this.logger.warn(`WebSocket closed by ${clientIp}`);
      this.logger.warn(
        `WebSocket Close event code: ${evt.code}, reason: ${evt.reason || 'none'}`
      );
      this.removeClient(ws);
    });

    ws.on('error', (err) => {
      this.logger.error(`WebSocket error from ${clientIp}: ${err.message}`);
      this.removeClient(ws);
    });
  }

  /**
   * Remove a WebSocket client
   * @param {WebSocket} ws - WebSocket connection
   */
  removeClient(ws) {
    if (this.clients.has(ws)) {
      this.clients.delete(ws);
    }
  }

  /**
   * Broadcast a message to all connected clients
   * @param {any} message - Message to broadcast (will be JSON stringified)
   */
  broadcast(message) {
    const messageStr = typeof message === 'string' ? message : JSON.stringify(message);
    
    this.clients.forEach((client) => {
      try {
        if (client.readyState === 1) { // WebSocket.OPEN
          client.send(messageStr);
        }
      } catch (err) {
        this.logger.error(`Failed to send WebSocket message: ${err.message}`);
        this.removeClient(client);
      }
    });
  }

  /**
   * Notify clients about media conversion progress
   * @param {string} file - File being converted
   * @param {Object} progress - FFmpeg progress object
   */
  notifyProgress(file, progress) {
    this.broadcast({
      type: 'conversion_progress',
      file,
      progress,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Notify clients about a generic event
   * @param {string} type - Event type
   * @param {any} data - Event data
   */
  notifyEvent(type, data) {
    this.broadcast({
      type,
      data,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Get number of connected clients
   * @returns {number} Client count
   */
  getClientCount() {
    return this.clients.size;
  }
}

export default WebSocketService;