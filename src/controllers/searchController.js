import querystring from 'querystring';

/**
 * Search Controller for handling file search requests
 */
export class SearchController {
  /**
   * @param {Object} fileSystemService - File system service instance
   * @param {Object} logger - Logger instance
   */
  constructor(fileSystemService, logger) {
    this.fileSystemService = fileSystemService;
    this.logger = logger;
  }

  /**
   * Search for files within a directory
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async searchDirectory(req, res) {
    const file_path = req.file_path;
    const leaf = req.leaf;
    const searchTerm = querystring.unescape(req.query.key);

    try {
      this.logger.info(`Searching for files matching "${searchTerm}" in directory: ${leaf}`);
      const diritems = await this.fileSystemService.searchDirectory(file_path, searchTerm);
      const bread = this.fileSystemService.createBreadcrumbs(file_path);
      
      this.logger.info(`Search completed. Found ${diritems.length} items matching the query.`);
      res.render('list_dir', {
        title: file_path,
        diritems: diritems,
        bread,
      });
    } catch (error) {
      this.logger.error(`Search error: ${error.message}`);
      res.status(error.status || 400).end();
    }
  }
}

export default SearchController;