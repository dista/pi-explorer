import dotenv from 'dotenv';
import minimist from 'minimist';
import path from 'path';
import { fileURLToPath } from 'url';
import Joi from 'joi';
import {
  DEFAULT_PORT,
  DEFAULT_ROOT_DIRECTORY,
  UNSUPPORTED_MEDIA_EXTENSIONS,
  DEFAULT_VIDEO_CODEC,
  DEFAULT_AUDIO_CODEC,
  DEFAULT_QUALITY,
  DEFAULT_PRESET,
  DEFAULT_THREADS,
  MAX_FILE_SIZE_FOR_HIGHLIGHT,
  DEFAULT_VIEWS_PATH,
  DEFAULT_PUBLIC_PATH,
  ENABLE_WEBSOCKETS,
  ENABLE_MEDIA_CONVERSION,
  DEFAULT_LOG_LEVEL
} from './constants.js';

// Load environment variables from .env file
dotenv.config();

// Get current directory (ES module compatible)
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Parse CLI arguments
const argv = minimist(process.argv.slice(2));

// Define configuration schema with Joi
const configSchema = Joi.object({
  server: Joi.object({
    port: Joi.number().port().default(DEFAULT_PORT),
    rootDirectory: Joi.string().required(),
    host: Joi.string().hostname().default('0.0.0.0'),
  }).required(),
  media: Joi.object({
    unsupportedExtensions: Joi.array().items(Joi.string()).default(UNSUPPORTED_MEDIA_EXTENSIONS),
    conversion: Joi.object({
      videoCodec: Joi.string().default(DEFAULT_VIDEO_CODEC),
      audioCodec: Joi.string().default(DEFAULT_AUDIO_CODEC),
      quality: Joi.number().min(0).max(51).default(DEFAULT_QUALITY),
      preset: Joi.string().default(DEFAULT_PRESET),
      threads: Joi.number().min(1).max(16).default(DEFAULT_THREADS),
    }).default(),
  }).default(),
  paths: Joi.object({
    views: Joi.string().default(DEFAULT_VIEWS_PATH),
    public: Joi.string().default(DEFAULT_PUBLIC_PATH),
    // Resolve relative paths to absolute paths
    viewsAbsolute: Joi.string(),
    publicAbsolute: Joi.string(),
  }).default(),
  features: Joi.object({
    enableWebSockets: Joi.boolean().default(ENABLE_WEBSOCKETS),
    enableMediaConversion: Joi.boolean().default(ENABLE_MEDIA_CONVERSION),
    maxFileSizeForHighlight: Joi.number().positive().default(MAX_FILE_SIZE_FOR_HIGHLIGHT),
  }).default(),
  logging: Joi.object({
    level: Joi.string().valid('error', 'warn', 'info', 'debug').default(DEFAULT_LOG_LEVEL),
  }).default(),
});

// Build configuration object from multiple sources
// Priority: CLI args > Environment variables > Defaults
const rawConfig = {
  server: {
    port: parseInt(argv.port || process.env.PORT || DEFAULT_PORT, 10),
    rootDirectory: argv.r || process.env.ROOT_DIRECTORY || DEFAULT_ROOT_DIRECTORY,
    host: argv.host || process.env.HOST || '0.0.0.0',
  },
  media: {
    unsupportedExtensions: UNSUPPORTED_MEDIA_EXTENSIONS,
    conversion: {
      videoCodec: DEFAULT_VIDEO_CODEC,
      audioCodec: DEFAULT_AUDIO_CODEC,
      quality: DEFAULT_QUALITY,
      preset: DEFAULT_PRESET,
      threads: DEFAULT_THREADS,
    },
  },
  paths: {
    views: DEFAULT_VIEWS_PATH,
    public: DEFAULT_PUBLIC_PATH,
  },
  features: {
    enableWebSockets: ENABLE_WEBSOCKETS,
    enableMediaConversion: ENABLE_MEDIA_CONVERSION,
    maxFileSizeForHighlight: MAX_FILE_SIZE_FOR_HIGHLIGHT,
  },
  logging: {
    level: process.env.LOG_LEVEL || DEFAULT_LOG_LEVEL,
  },
};

// Resolve absolute paths
const resolvePath = (relativePath) => {
  if (path.isAbsolute(relativePath)) {
    return relativePath;
  }
  return path.resolve(__dirname, '../..', relativePath);
};

rawConfig.paths.viewsAbsolute = resolvePath(rawConfig.paths.views);
rawConfig.paths.publicAbsolute = resolvePath(rawConfig.paths.public);

// Validate configuration
const { error, value: validatedConfig } = configSchema.validate(rawConfig, {
  abortEarly: false,
  allowUnknown: false,
  convert: true,
});

if (error) {
  const errorMessages = error.details.map(detail => detail.message).join(', ');
  throw new Error(`Configuration validation failed: ${errorMessages}`);
}

// Check required root directory
if (!validatedConfig.server.rootDirectory) {
  throw new Error('Root directory must be specified via -r CLI argument or ROOT_DIRECTORY environment variable');
}

// Ensure root directory is absolute and normalized
validatedConfig.server.rootDirectory = path.resolve(
  validatedConfig.server.rootDirectory.replace(/\/$/, '')
);

export default validatedConfig;