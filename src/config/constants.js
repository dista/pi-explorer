// Default configuration constants

export const DEFAULT_PORT = 8003;
export const DEFAULT_ROOT_DIRECTORY = null; // Must be provided via CLI or env

// Media conversion
export const UNSUPPORTED_MEDIA_EXTENSIONS = ['mov', 'mkv', 'rmvb'];
export const DEFAULT_VIDEO_CODEC = 'libx264';
export const DEFAULT_AUDIO_CODEC = 'libfaac';
export const DEFAULT_QUALITY = 0;
export const DEFAULT_PRESET = 'fast';
export const DEFAULT_THREADS = 3;

// File handling
export const MAX_FILE_SIZE_FOR_HIGHLIGHT = 500000; // 500KB in bytes

// Paths
export const DEFAULT_VIEWS_PATH = './views';
export const DEFAULT_PUBLIC_PATH = './public';

// Feature flags
export const ENABLE_WEBSOCKETS = true;
export const ENABLE_MEDIA_CONVERSION = true;

// Logging
export const DEFAULT_LOG_LEVEL = 'info';