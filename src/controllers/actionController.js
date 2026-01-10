/**
 * Action Controller for handling file actions (e.g., media conversion)
 */
export class ActionController {
  /**
   * @param {Object} mediaService - Media service instance
   * @param {Object} logger - Logger instance
   */
  constructor(mediaService, logger) {
    this.mediaService = mediaService;
    this.logger = logger;
  }

  /**
   * Handle file actions
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async handleAction(req, res) {
    const leaf = req.leaf;
    const value = req.query.action;

    if (value == 'ffmpeg') {
      this.logger.info(`Converting media file to HTML5-supported format: ${leaf}`);
      this.logger.info(`Conversion started at: ${new Date().toISOString()}`);
      await this.mediaService.toHtml5Supported(leaf);
      this.logger.info(`Media conversion completed for: ${leaf}`);
      this.logger.info(`Conversion ended at: ${new Date().toISOString()}`);
    }

    res.end();
  }
}

export default ActionController;