# pi-explorer
Web File Explorer UI for Linux servers

## Install
Install dependencies after installing Node.js:
```
npm install
```

## Usage

### Command Line Options
Start the server with CLI arguments:
```
node index.js -r {root_directory} [--port {port}] [--host {host}]
```

Options:
- `-r, --root-directory` (required): Root directory to explore
- `--port`: Server port (default: 8003)
- `--host`: Server host (default: 0.0.0.0)

### Environment Variables
Alternatively, use a `.env` file or environment variables:
```
PORT=8003
HOST=0.0.0.0
ROOT_DIRECTORY=/path/to/your/files
LOG_LEVEL=info
```

Then run:
```
node index.js
```

Visit `http://{your_ip_of_server}:8003` in your browser.

### Configuration Options
Create a `.env` file with optional settings:

**Media Conversion:**
- `VIDEO_CODEC`: Default `libx264`
- `AUDIO_CODEC`: Default `libfaac`
- `QUALITY`: 0-51, default `0`
- `PRESET`: Default `fast`
- `THREADS`: 1-16, default `3`

**Feature Flags:**
- `ENABLE_WEBSOCKETS`: Enable real-time notifications (default: true)
- `ENABLE_MEDIA_CONVERSION`: Enable video conversion (default: true)

**File Handling:**
- `MAX_FILE_SIZE_FOR_HIGHLIGHT`: Max file size for syntax highlighting in bytes (default: 500000)

## Features
- Basic file exploration and navigation
- Responsive design supporting any screen size
- Search functionality under current location
- Syntax highlighting for code files (bash, java, css, js, and more)
- Markdown preview support
- Video format conversion to mp4 (requires ffmpeg installation)
- Video.js player for video playback
- Real-time notifications via WebSocket
- Configurable media conversion settings

## Preview
![alt tag](https://github.com/dista/pi-explorer/blob/master/pi-explorer-gif4.gif?raw=true)
