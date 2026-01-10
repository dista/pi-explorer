/**
 * Directory Controller for handling directory listing requests
 */
export class DirectoryController {
  /**
   * @param {Object} fileSystemService - File system service instance
   * @param {Object} mediaService - Media service instance
   * @param {Object} config - Application configuration
   * @param {Object} logger - Logger instance
   */
  constructor(fileSystemService, mediaService, config, logger) {
    this.fileSystemService = fileSystemService;
    this.mediaService = mediaService;
    this.config = config;
    this.logger = logger;
  }

  /**
   * List directory contents
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async listDirectory(req, res) {
    const file_path = req.file_path;
    const leaf = req.leaf;

    try {
      const { title, items, bread } = await this.fileSystemService.listDirectory(file_path);
      const shouldConv = this.mediaService.hasHtml5UnsupportedMedia(items);
      const hasActionBar = shouldConv;

      this.logger.info(`Rendering directory listing for: ${leaf}`);
      res.render("list_dir", {
        title,
        diritems: items,
        bread,
        shouldConv,
        hasActionBar,
      });
      res.end();
    } catch (error) {
      this.logger.error(`Error listing directory ${leaf}: ${error.message}`);
      this.logger.error(`Stack trace: ${error.stack}`);
      res.status(400).end();
    }
  }

  /**
   * Handle directory requests (with optional query parameters)
   * This is a convenience method that routes to search or action if query params present
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async handleDirectory(req, res, next) {
    const { key, action } = req.query;

    if (key) {
      // Delegate to search controller
      return next();
    } else if (action) {
      // Delegate to action controller
      return next();
    } else {
      // Handle directory listing
      return await this.listDirectory(req, res);
    }
  }
}

export default DirectoryController;