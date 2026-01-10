import path from 'path';
import { promises as fs } from 'fs';
import _ from 'lodash';
import findit from 'findit';
import mime from 'mime';
import querystring from 'querystring';

/**
 * File System Service for handling file and directory operations
 */
export class FileSystemService {
  /**
   * @param {Object} config - Application configuration
   * @param {Object} logger - Logger instance
   */
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.root = config.server.rootDirectory;
  }

  /**
   * Get icon class based on file stats
   * @param {fs.Stats} state - File stats object
   * @returns {Promise<string>} Icon class name
   */
  async getIconClassByState(state) {
    if (state.isDirectory()) {
      return 'folder outline';
    } else if (state.isFile()) {
      return 'file outline';
    }
    return '';
  }

  /**
   * Get icon class for a symbolic link
   * @param {string} leaf - Path to the symbolic link
   * @returns {Promise<string>} Icon class name
   */
  async getSymbolicLinkIconClass(leaf) {
    try {
      const link = await fs.readlink(leaf);
      const state = await fs.lstat(link);

      if (state.isDirectory()) {
        return 'folder';
      } else if (state.isFile()) {
        return 'file';
      }
      return '';
    } catch (err) {
      this.logger.error(`Error reading symbolic link ${leaf}: ${err.message}`);
      return 'file outline';
    }
  }

  /**
   * Get icon class for a file or directory, handling symbolic links
   * @param {fs.Stats} state - File stats object
   * @param {string} leaf - Path to the file or directory
   * @returns {Promise<string>} Icon class name
   */
  async getIconClass(state, leaf) {
    try {
      if (state.isSymbolicLink()) {
        return await this.getSymbolicLinkIconClass(leaf);
      } else {
        return await this.getIconClassByState(state);
      }
    } catch (err) {
      this.logger.error(`Error determining file type for ${leaf}: ${err.message}`);
      return 'file outline';
    }
  }

  /**
   * Create breadcrumb navigation items for a given file path
   * @param {string} filePath - The file path to create breadcrumbs for
   * @returns {Array} Array of breadcrumb items
   */
  createBreadcrumbs(filePath) {
    const breadItems = _.trimEnd(filePath, '/').split(path.sep);
    let currentUrl = '/';

    return breadItems.map((item, index) => {
      currentUrl = path.join(currentUrl, item);
      const name = item === '' ? 'Raspberry Pi' : item;
      return {
        name,
        url: currentUrl,
        isLast: index === breadItems.length - 1,
      };
    });
  }

  /**
   * Determine programming language for syntax highlighting
   * @param {string} basename - The basename of the file
   * @param {string} extension - The file extension
   * @returns {string|null} The language identifier or null if unknown
   */
  getSyntaxHighlightingLanguage(basename, extension) {
    // Check for special filenames
    if (basename === 'Makefile') {
      return 'makefile';
    } else if (basename === 'Gemfile' || basename === 'Rakefile') {
      return 'ruby';
    }

    // Check file extensions
    const languageMap = {
      '.html': 'markup',
      '.md': 'markdown',
      '.mk': 'makefile',
      '.css': 'css',
      '.js': 'javascript',
      '.sh': 'bash',
      '.c': 'c',
      '.h': 'cpp',
      '.cpp': 'cpp',
      '.cc': 'cpp',
      '.rb': 'ruby',
      '.erl': 'erlang',
      '.hrl': 'erlang',
      '.go': 'go',
      '.java': 'java',
      '.lua': 'lua',
      '.mm': 'objectivec',
      '.pl': 'perl',
      '.perl': 'perl',
      '.php': 'php',
      '.py': 'python',
      '.swift': 'swift',
      '.s': 'nasm',
      '.pug': 'pug',
    };

    return languageMap[extension] || null;
  }

  /**
   * Get file stats with symbolic link resolution
   * @param {string} fullPath - Full path to the file/directory
   * @returns {Promise<fs.Stats>} File stats
   */
  async getFileStats(fullPath) {
    try {
      let state = await fs.lstat(fullPath);

      if (state.isSymbolicLink()) {
        this.logger.info(`Resolving symbolic link: ${fullPath}`);
        const link = await fs.readlink(fullPath);
        state = await fs.lstat(link);
        this.logger.info(`Symbolic link resolved to: ${link}`);
      }

      return state;
    } catch (err) {
      if (err.code === 'ENOENT') {
        throw new Error(`File/directory not found: ${fullPath}`);
      }
      throw err;
    }
  }

  /**
   * List directory contents
   * @param {string} currentPath - Relative path from root
   * @returns {Promise<Object>} Directory listing with items and breadcrumbs
   */
  async listDirectory(currentPath) {
    const leaf = path.join(this.root, currentPath);
    this.logger.info(`Listing directory: ${leaf}`);

    const state = await this.getFileStats(leaf);

    if (!state.isDirectory()) {
      throw new Error(`Path is not a directory: ${leaf}`);
    }

    const dirs = await fs.readdir(leaf);
    const bread = this.createBreadcrumbs(currentPath);

    const items = await Promise.all(
      dirs.map(async (v) => {
        const tmp = path.join(currentPath, v);
        const fullPath = path.join(this.root, tmp);
        const fstat = await fs.lstat(fullPath);
        const ftc = await this.getIconClass(fstat, fullPath);

        const ret = { name: v, url: tmp, file_type_cls: ftc, fstat };
        if (_.startsWith(ftc, 'folder')) {
          ret.name += '/';
        }
        return ret;
      }),
    );

    // Sort by modification time (newest first)
    items.sort((a, b) => -(a.fstat.mtime.getTime() - b.fstat.mtime.getTime()));

    return {
      title: currentPath,
      items,
      bread,
    };
  }

  /**
   * Search for files within a directory
   * @param {string} currentPath - Relative path from root
   * @param {string} searchTerm - Search term
   * @returns {Promise<Array>} Array of matching file items
   */
  async searchDirectory(currentPath, searchTerm) {
    const leaf = path.join(this.root, currentPath);
    this.logger.info(`Searching for files matching "${searchTerm}" in directory: ${leaf}`);

    const state = await this.getFileStats(leaf);
    if (!state.isDirectory()) {
      throw new Error(`Path is not a directory: ${leaf}`);
    }

    return new Promise((resolve, reject) => {
      const finder = findit(leaf);
      const sk = searchTerm.toLowerCase();
      const diritems = [];

      finder.on('path', async (p, stat) => {
        const bpath = p.substring(leaf.length);
        if (path.basename(bpath).toLowerCase().indexOf(sk) !== -1) {
          const item = {
            name: path.basename(p),
            url: p.substring(this.root.length),
            file_type_cls: await this.getIconClass(stat, p),
          };
          diritems.push(item);
        }
      });

      finder.on('end', () => {
        this.logger.info(`Search completed. Found ${diritems.length} items matching the query.`);
        resolve(diritems);
      });

      finder.on('error', (err) => {
        this.logger.error(`Search error: ${err.message}`);
        reject(err);
      });
    });
  }

  /**
   * Check if a file should be converted (HTML5 unsupported media)
   * @param {Array} items - Directory items
   * @returns {boolean} True if any items need conversion
   */
  hasHtml5UnsupportedMedia(items) {
    // This method will be integrated with MediaService later
    // For now, return false as media conversion logic is separate
    return false;
  }

  /**
   * Get file content with appropriate handling
   * @param {string} currentPath - Relative path from root
   * @param {boolean} isRaw - Whether to return raw file
   * @returns {Promise<Object>} File content and metadata
   */
  async getFileContent(currentPath, isRaw = false) {
    const leaf = path.join(this.root, currentPath);
    this.logger.info(`Accessing file: ${leaf}`);

    const state = await this.getFileStats(leaf);

    if (!state.isFile()) {
      throw new Error(`Path is not a file: ${leaf}`);
    }

    const extname = path.extname(leaf);
    const basename = path.basename(leaf);
    const codename = this.getSyntaxHighlightingLanguage(basename, extname);
    const stats = await fs.stat(leaf);
    const fileSize = stats.size;

    return {
      path: currentPath,
      fullPath: leaf,
      extname,
      basename,
      codename,
      fileSize,
      isRaw,
      mimeType: mime.lookup(leaf),
      state,
    };
  }
}

export default FileSystemService;