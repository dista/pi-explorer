// Core dependencies
import express from "express";
import path from "path";
import { promises as fs } from "fs";
import mime from "mime";
import querystring from "querystring";

// Third-party dependencies
import _ from "lodash";
import findit from "findit";
import { markdown } from "markdown";
import expressWs from "express-ws";
import minimist from "minimist";

// Local dependencies
import media from "./media.js";
import notify from "./notify.js";

// Configure Winston logger
import winston from "winston";

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.colorize(),
    winston.format.printf(({ timestamp, level, message }) => {
      return `[${timestamp}] ${level}: ${message}`;
    }),
  ),
  transports: [new winston.transports.Console()],
});

// Initialize Express app
const app = express();
expressWs(app);

// Configure Express
app.set("views", "./views");
app.set("view engine", "pug");

// Validate root directory argument
const rootArgIndex = process.argv.indexOf("-r");
if (rootArgIndex === -1 || !process.argv[rootArgIndex + 1]) {
  console.error("Error: Root directory not specified.");
  console.log("Usage: node index.js -r {root_of_dir}");
  process.exit(1);
}
const root = _.trimEnd(process.argv[rootArgIndex + 1], path.sep);

// WebSocket endpoint for messaging
app.ws("/messaging", (ws, req) => {
  const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress;
  logger.info(`New WebSocket connection from ${clientIp}`);

  notify.addWs(ws);

  ws.on("message", (msg) => {
    logger.info(`WebSocket message from ${clientIp}: ${msg}`);
    logger.info(`WebSocket Message length: ${msg.length} bytes`);
  });

  ws.on("close", (evt) => {
    logger.warn(`WebSocket closed by ${clientIp}`);
    logger.warn(
      `WebSocket Close event code: ${evt.code}, reason: ${evt.reason || "none"}`,
    );
    notify.removeWs(ws);
  });
});

app.get("/__*", function (req, res) {
  var file_path = querystring.unescape(req.path.substring(3));

  var content_type = mime.lookup(file_path);
  const dirname = path.dirname(new URL(import.meta.url).pathname);
  var options = {
    root: path.join(dirname, "asserts"),
    dotfiles: "deny",
    headers: {
      "Content-Type": content_type,
    },
  };

  res.sendFile(file_path, options);

  /*
  var ret = res.sendFile(file_path, options, function(result){
    if(result != null){
          console.error(`Error processing request for ${file_path}: ${err.message}`);
      res.status(400).end();
    }
  });
  */
});

/**
 * Determines the icon class for a file or directory based on its state.
 * @param {fs.Stats} state - File stats object.
 * @returns {string} Icon class name.
 */
async function getIconClassByState(state) {
  if (state.isDirectory()) {
    return "folder outline";
  } else if (state.isFile()) {
    return "file outline";
  }
  return "";
}

/**
 * Determines the icon class for a symbolic link.
 * @param {string} leaf - Path to the symbolic link.
 * @returns {string} Icon class name.
 */
async function getSymbolicLinkIconClass(leaf) {
  const link = await fs.readlink(leaf);
  const state = await fs.lstat(link);

  if (state.isDirectory()) {
    return "folder";
  } else if (state.isFile()) {
    return "file";
  }
  return "";
}

/**
 * Determines the icon class for a file or directory, handling symbolic links.
 * @param {fs.Stats} state - File stats object.
 * @param {string} leaf - Path to the file or directory.
 * @returns {string} Icon class name.
 */
async function getIconClass(state, leaf) {
  try {
    if (state.isSymbolicLink()) {
      return await getSymbolicLinkIconClass(leaf);
    } else {
      return await getIconClassByState(state);
    }
  } catch (err) {
    logger.error(`Error determining file type for ${leaf}: ${err.message}`);
    return "file outline"; // Fallback icon
  }
}

async function handleAction(file_path, leaf, req, res) {
  const value = req.query.action;

  if (value == "ffmpeg") {
    logger.info(`Converting media file to HTML5-supported format: ${leaf}`);
    logger.info(`Conversion started at: ${new Date().toISOString()}`);
    await media.toHtml5Supported(leaf);
    logger.info(`Media conversion completed for: ${leaf}`);
    logger.info(`Conversion ended at: ${new Date().toISOString()}`);
  }

  res.end();
}

async function handleSearch(file_path, leaf, req, res) {
  logger.info(
    `Searching for files matching "${querystring.unescape(req.query.key)}" in directory: ${leaf}`,
  );
  const finder = findit(leaf);
  const sk = querystring.unescape(req.query.key).toLowerCase();
  const diritems = [];

  finder.on("path", async (p, stat) => {
    const bpath = p.substring(leaf.length);
    if (path.basename(bpath).toLowerCase().indexOf(sk) != -1) {
      const item = {
        name: path.basename(p),
        url: p.substring(root.length),
        file_type_cls: await getIconClass(stat, p),
      };
      diritems.push(item);
    }
  });

  finder.on("end", () => {
    logger.info(
      `Search completed. Found ${diritems.length} items matching the query.`,
    );
    res.render("list_dir", {
      title: file_path,
      diritems: diritems,
      bread: createBreadcrumbs(file_path),
    });
    res.end();
  });
}

/**
 * Creates breadcrumb navigation items for a given file path.
 * @param {string} filePath - The file path to create breadcrumbs for.
 * @returns {Array} Array of breadcrumb items.
 */
function createBreadcrumbs(filePath) {
  const breadItems = _.trimEnd(filePath, "/").split(path.sep);
  let currentUrl = "/";

  return breadItems.map((item, index) => {
    currentUrl = path.join(currentUrl, item);
    const name = item === "" ? "Raspberry Pi" : item;
    return {
      name,
      url: currentUrl,
      isLast: index === breadItems.length - 1,
    };
  });
}

/**
 * Determines the programming language for syntax highlighting based on filename and extension.
 * @param {string} basename - The basename of the file.
 * @param {string} extension - The file extension.
 * @returns {string|null} The language identifier or null if unknown.
 */
function getSyntaxHighlightingLanguage(basename, extension) {
  // Check for special filenames
  if (basename === "Makefile") {
    return "makefile";
  } else if (basename === "Gemfile" || basename === "Rakefile") {
    return "ruby";
  }

  // Check file extensions
  const languageMap = {
    ".html": "markup",
    ".md": "markdown",
    ".mk": "makefile",
    ".css": "css",
    ".js": "javascript",
    ".sh": "bash",
    ".c": "c",
    ".h": "cpp",
    ".cpp": "cpp",
    ".cc": "cpp",
    ".rb": "ruby",
    ".erl": "erlang",
    ".hrl": "erlang",
    ".go": "go",
    ".java": "java",
    ".lua": "lua",
    ".mm": "objectivec",
    ".pl": "perl",
    ".perl": "perl",
    ".php": "php",
    ".py": "python",
    ".swift": "swift",
    ".s": "nasm",
    ".pug": "pug",
  };

  return languageMap[extension] || null;
}

app.get("*", async (req, res) => {
  const file_path = querystring.unescape(req.path);
  const is_raw = !!req.query.raw;
  const leaf = path.join(root, file_path);

  try {
    logger.info(`Accessing file/directory: ${leaf}`);
    let state;
    try {
      state = await fs.lstat(leaf);
    } catch (err) {
      if (err.code === "ENOENT") {
        logger.error(`File/directory not found: ${leaf}`);
        return res.status(404).send("File/directory not found");
      }
      throw err;
    }

    if (state.isSymbolicLink()) {
      logger.info(`Resolving symbolic link: ${leaf}`);
      const link = await fs.readlink(leaf);
      state = await fs.lstat(link);
      logger.info(`Symbolic link resolved to: ${link}`);
    }

    if (state.isDirectory()) {
      if (req.query.key) {
        await handleSearch(file_path, leaf, req, res);
      } else if (req.query.action) {
        await handleAction(file_path, leaf, req, res);
      } else {
        const dirs = await fs.readdir(leaf);
        const bread = createBreadcrumbs(file_path);
        const items = await Promise.all(
          dirs.map(async (v) => {
            const tmp = path.join(file_path, v);
            const fullPath = path.join(root, tmp);
            const fstat = await fs.lstat(fullPath);
            const ftc = await getIconClass(fstat, fullPath);

            const ret = { name: v, url: tmp, file_type_cls: ftc, fstat };
            if (_.startsWith(ftc, "folder")) {
              ret.name += "/";
            }
            return ret;
          }),
        );

        items.sort(
          (a, b) => -(a.fstat.mtime.getTime() - b.fstat.mtime.getTime()),
        );

        const shouldConv = media.hasHtml5UnsupportedMedia(items);
        const hasActionBar = shouldConv;

        res.render("list_dir", {
          title: file_path,
          diritems: items,
          bread,
          shouldConv,
          hasActionBar,
        });
        res.end();
      }
      return;
    } else if (state.isFile()) {
      const extname = path.extname(leaf);
      const bm = path.basename(leaf);
      const codename = getSyntaxHighlightingLanguage(bm, extname);

      if (!is_raw && extname === ".mp4") {
        res.render("video", { title: file_path, src: file_path + "?raw=1" });
        res.end();
      } else {
        const stats = await fs.stat(leaf);
        const file_size = stats.size;

        if (codename === null || is_raw || file_size > 500000) {
          const content_type = mime.lookup(leaf);
          const options = {
            root: root,
            dotfiles: "deny",
            headers: {
              "Content-Type": content_type,
            },
          };

          res.sendFile(file_path, options);
        } else if (codename === "markdown") {
          const content = await fs.readFile(leaf, "utf8");
          res.render("markdown", {
            title: file_path,
            markdown: markdown.toHTML(content),
          });
          res.end();
        } else {
          const content = await fs.readFile(leaf);
          res.render("code", {
            title: file_path,
            lang: codename,
            code: content,
          });
          res.end();
        }
      }
      return;
    }

    res.end("not implemented");
  } catch (err) {
    logger.error(`Error processing request for ${leaf}: ${err.message}`);
    logger.error(`Stack trace: ${err.stack}`);
    res.status(400).end();
  }
});

media.init();
app.listen(8003, () => {
  logger.info(`Server is running on port 8003`);
});
