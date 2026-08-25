import ffmpeg from 'fluent-ffmpeg';
import replaceExt from 'replace-ext';
import { promises as fs } from 'fs';
import path from 'path';

// Extend ffmpeg prototype (same as original conv.js)
ffmpeg.prototype.videoQuality = function (q) {
  this._currentOutput.video('-qscale:v', '' + q);
  return this;
};

ffmpeg.prototype.videoOptions = function () {
  this._currentOutput.video.apply(this, arguments);
  return this;
};

ffmpeg.prototype.audioOptions = function () {
  this._currentOutput.audio.apply(this, arguments);
  return this;
};

ffmpeg.prototype.audioQuality = function (q) {
  this._currentOutput.audio('-qscale:a', '' + q);
  return this;
};

/**
 * Media Converter for converting video files to HTML5-compatible formats
 */
export class MediaConverter {
  /**
   * @param {Object} config - Application configuration
   * @param {Object} logger - Logger instance
   */
  constructor(config, logger) {
    this.config = config;
    this.logger = logger;
    this.unsupportedExtensions = config.media.unsupportedExtensions || ['mov', 'mkv', 'rmvb'];
  }

  /**
   * Check if a file should be converted based on extension
   * @param {string} filename - File name
   * @returns {boolean} True if conversion is needed
   */
  shouldConvert(filename) {
    const ext = path.extname(filename).toLowerCase().slice(1);
    return this.unsupportedExtensions.includes(ext);
  }

  /**
   * Analyze a media file to determine codec information
   * @param {string} filePath - Path to media file
   * @returns {Promise<Object>} Analysis result with hasVideo, copyVideo, hasAudio, copyAudio
   */
  async analyzeFile(filePath) {
    return new Promise((resolve, reject) => {
      ffmpeg(filePath).ffprobe((err, meta) => {
        if (err) {
          reject(err);
          return;
        }

        let hasVideo = false,
          copyVideo = false,
          hasAudio = false,
          copyAudio = false;

        meta.streams.forEach((stream) => {
          if (stream.codec_type === 'video') {
            hasVideo = true;
            if (stream.codec_name === 'h264') copyVideo = true;
          } else if (stream.codec_type === 'audio') {
            hasAudio = true;
            if (stream.codec_name === 'aac') copyAudio = true;
          }
        });

        resolve({ hasVideo, copyVideo, hasAudio, copyAudio });
      });
    });
  }

  /**
   * Convert a single media file to MP4
   * @param {string} filePath - Path to media file
   * @param {boolean} removeOriginal - Whether to delete original file after conversion
   * @param {Function} onProgress - Progress callback (file, progress)
   * @returns {Promise<Object>} Conversion result {success, file, error}
   */
  async convertFile(filePath, removeOriginal = false, onProgress = null) {
    try {
      const { hasVideo, copyVideo, hasAudio, copyAudio } = await this.analyzeFile(filePath);
      if (!hasVideo && !hasAudio) throw new Error('No media streams found');

      const cmd = ffmpeg(filePath);

      if (hasVideo) {
        if (copyVideo) {
          cmd.videoCodec('copy');
        } else {
          cmd
            .withVideoCodec(this.config.media.conversion.videoCodec || 'libx264')
            .videoQuality(this.config.media.conversion.quality || 0)
            .videoOptions('-preset', this.config.media.conversion.preset || 'fast');
        }
      } else {
        cmd.noVideo();
      }

      if (hasAudio) {
        if (copyAudio) {
          cmd.audioCodec('copy');
        } else {
          cmd
            .withAudioCodec(this.config.media.conversion.audioCodec || 'aac')
            .audioQuality(this.config.media.conversion.quality || 0);
        }
      } else {
        cmd.noAudio();
      }

      if (onProgress) {
        cmd.on('progress', (progress) => onProgress(filePath, progress));
      }

      const output = replaceExt(filePath, '.mp4');
      await new Promise((resolve, reject) => {
        cmd
          .output(output)
          // -y overwrites an existing output file instead of failing
          .outputOptions('-y', `-threads ${this.config.media.conversion.threads || 3}`)
          .on('end', () => resolve())
          .on('error', (err) => reject(err))
          .run();
      });

      if (removeOriginal) {
        await fs.unlink(filePath);
      }

      return { success: true, file: filePath };
    } catch (err) {
      this.logger.error(`Conversion failed for ${filePath}: ${err.message}`);
      return { success: false, file: filePath, error: err };
    }
  }

  /**
   * Convert multiple files
   * @param {Array<string>} files - Array of file paths
   * @param {boolean} removeOriginal - Whether to delete original files
   * @param {Function} onProgress - Progress callback (file, progress)
   * @returns {Promise<Object>} Results with good and bad files
   */
  async convertFiles(files, removeOriginal = false, onProgress = null) {
    const goods = [];
    const bads = [];

    for (const file of files) {
      const result = await this.convertFile(file, removeOriginal, onProgress);
      result.success ? goods.push(result.file) : bads.push(result.file);
    }

    return { goods, bads };
  }
}

/**
 * Conversion Queue for managing media conversion jobs
 */
export class ConversionQueue {
  /**
   * @param {MediaConverter} converter - Media converter instance
   * @param {Object} notificationService - Notification service for progress updates
   * @param {Object} logger - Logger instance
   */
  constructor(converter, notificationService, logger) {
    this.converter = converter;
    this.notificationService = notificationService;
    this.logger = logger;
    this.queue = [];
    this.processing = false;
    this.initializeQueueProcessor();
  }

  /**
   * Initialize the queue processor
   */
  initializeQueueProcessor() {
    const processQueue = async () => {
      if (this.queue.length === 0) {
        this.processing = false;
        setTimeout(processQueue, 1000);
        return;
      }

      this.processing = true;
      const directory = this.queue.shift();
      await this.processDirectory(directory);
      setTimeout(processQueue, 1000);
    };

    setTimeout(processQueue, 1000);
  }

  /**
   * Process a directory by converting all unsupported media files
   * @param {string} directory - Directory path
   */
  async processDirectory(directory) {
    try {
      const files = await fs.readdir(directory);
      const convFiles = files
        .filter((file) => this.converter.shouldConvert(file))
        .map((file) => path.join(directory, file));

      if (convFiles.length === 0) {
        this.logger.info(`No files to convert in directory: ${directory}`);
        return;
      }

      this.logger.info(`Converting ${convFiles.length} files in directory: ${directory}`);

      await this.converter.convertFiles(
        convFiles,
        true, // remove original
        (file, progress) => {
          // Notify progress via WebSocket
          if (this.notificationService) {
            this.notificationService.notifyProgress(file, progress);
          }
        }
      );

      this.logger.info(`Conversion completed for directory: ${directory}`);
    } catch (err) {
      this.logger.error(`Job failed for directory ${directory}: ${err.message}`);
    }
  }

  /**
   * Add a directory to the conversion queue
   * @param {string} directory - Directory path
   */
  addDirectory(directory) {
    if (!this.queue.includes(directory)) {
      this.queue.push(directory);
      this.logger.info(`Added directory to conversion queue: ${directory}`);
    }
  }

  /**
   * Check if directory is in queue
   * @param {string} directory - Directory path
   * @returns {boolean} True if directory is in queue
   */
  isInQueue(directory) {
    return this.queue.includes(directory);
  }

  /**
   * Get queue length
   * @returns {number} Number of directories in queue
   */
  getQueueLength() {
    return this.queue.length;
  }
}

/**
 * Main Media Service combining converter and queue
 */
export class MediaService {
  /**
   * @param {Object} config - Application configuration
   * @param {Object} logger - Logger instance
   * @param {Object} notificationService - Notification service instance
   */
  constructor(config, logger, notificationService) {
    this.config = config;
    this.logger = logger;
    this.notificationService = notificationService;

    this.converter = new MediaConverter(config, logger);
    this.queue = new ConversionQueue(this.converter, notificationService, logger);
  }

  /**
   * Check if any items in directory need conversion
   * @param {Array} items - Directory items
   * @returns {boolean} True if conversion is needed
   */
  hasHtml5UnsupportedMedia(items) {
    return items.some((item) => this.converter.shouldConvert(item.name));
  }

  /**
   * Request conversion of a directory
   * @param {string} directory - Directory path
   */
  toHtml5Supported(directory) {
    this.queue.addDirectory(directory);
  }

  /**
   * Initialize media service (for backward compatibility)
   */
  init() {
    // Queue processor already initialized in ConversionQueue constructor
    this.logger.info('Media service initialized');
  }
}

export default MediaService;