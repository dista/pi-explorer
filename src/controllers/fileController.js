import { promises as fs } from 'fs';
import { markdown } from 'markdown';
import path from 'path';

/**
 * File Controller for handling file serving and content display
 */
export class FileController {
  /**
   * @param {Object} fileSystemService - File system service instance
   * @param {Object} config - Application configuration
   * @param {Object} logger - Logger instance
   */
  constructor(fileSystemService, config, logger) {
    this.fileSystemService = fileSystemService;
    this.config = config;
    this.logger = logger;
    this.root = config.server.rootDirectory;
  }

  /**
   * Serve a file or display its content with syntax highlighting
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   */
  async serveFile(req, res) {
    const file_path = req.file_path;
    const is_raw = req.is_raw;
    const leaf = req.leaf;

    try {
      const fileInfo = await this.fileSystemService.getFileContent(file_path, is_raw);
      
      // Special handling for MP4 files
      if (!is_raw && fileInfo.extname === '.mp4') {
        this.logger.info(`Rendering video player for: ${leaf}`);
        res.render('video', { title: file_path, src: file_path + '?raw=1' });
        res.end();
        return;
      }

      // Raw mode, unknown language, or file too large for highlighting
      if (fileInfo.codename === null || is_raw || fileInfo.fileSize > this.config.features.maxFileSizeForHighlight) {
        this.logger.info(`Serving raw file: ${leaf}`);
        const options = {
          root: this.root,
          dotfiles: 'deny',
          headers: {
            'Content-Type': fileInfo.mimeType,
          },
        };
        res.sendFile(file_path, options);
      } else if (fileInfo.codename === 'markdown') {
        this.logger.info(`Rendering markdown file: ${leaf}`);
        const content = await fs.readFile(fileInfo.fullPath, 'utf8');
        res.render('markdown', {
          title: file_path,
          markdown: markdown.toHTML(content),
        });
        res.end();
      } else {
        this.logger.info(`Rendering code file with syntax highlighting: ${leaf}`);
        const content = await fs.readFile(fileInfo.fullPath);
        res.render('code', {
          title: file_path,
          lang: fileInfo.codename,
          code: content,
        });
        res.end();
      }
    } catch (error) {
      this.logger.error(`Error serving file ${leaf}: ${error.message}`);
      this.logger.error(`Stack trace: ${error.stack}`);
      res.status(400).end();
    }
  }
}

export default FileController;