const express = require("express");
const path = require("path");
const fs = require("fs").promises;
const mime = require("mime");
const _ = require("lodash");
const querystring = require("querystring");
const findit = require("findit");
const markdown = require("markdown").markdown;
const app = express();
const expressWs = require("express-ws")(app);
const argv = require("minimist")(process.argv);
const media = require("./media.js");
const notify = require("./notify.js");

app.set("views", "./views");
app.set("view engine", "pug");

if (!argv["r"]) {
  console.log("usage: node index.js -r {root_of_dir}");
  return;
}

argv["r"] = _.trimEnd(argv["r"], path.sep);

var root = argv["r"];

app.ws("/messaging", function (ws, req) {
  console.log("new req");
  notify.addWs(ws);
  ws.on("message", function (msg) {
    console.log("websocket message");
    console.log(msg);
  });

  ws.on("close", function (evt) {
    console.log("close websocket");
    notify.removeWs(ws);
  });
});

app.get("/__*", function (req, res) {
  var file_path = querystring.unescape(req.path.substring(3));

  var content_type = mime.lookup(file_path);
  var options = {
    root: path.join(__dirname, "asserts"),
    dotfiles: "deny",
    headers: {
      "Content-Type": content_type,
    },
  };

  res.sendFile(file_path, options);

  /*
  var ret = res.sendFile(file_path, options, function(result){
    if(result != null){
      res.status(400).end();
    }
  });
  */
});

async function get_cls_by_state(state) {
  if (state.isDirectory()) {
    return "folder outline";
  } else if (state.isFile()) {
    return "file outline";
  }

  return "";
}

async function get_symbolic_cls(leaf) {
  const link = await fs.readlink(leaf);
  const state = await fs.lstat(link);

  if (state.isDirectory()) {
    return "folder";
  } else if (state.isFile()) {
    return "file";
  }

  return "";
}

async function get_cls_by_state_withp(state, leaf) {
  if (state.isSymbolicLink()) {
    return await get_symbolic_cls(leaf);
  } else {
    return await get_cls_by_state(state);
  }
}

async function do_action(file_path, leaf, req, res) {
  const value = req.param("action");

  if (value == "ffmpeg") {
    await media.toHtml5Supported(leaf);
  }

  res.end();
}

async function search_file(file_path, leaf, req, res) {
  const finder = findit(leaf);
  const sk = querystring.unescape(req.param("key")).toLowerCase();
  const diritems = [];

  finder.on("path", async (p, stat) => {
    const bpath = p.substring(leaf.length);
    if (path.basename(bpath).toLowerCase().indexOf(sk) != -1) {
      const item = {
        name: path.basename(p),
        url: p.substring(root.length),
        file_type_cls: await get_cls_by_state_withp(stat, p),
      };
      diritems.push(item);
    }
  });

  finder.on("end", () => {
    res.render("list_dir", {
      title: file_path,
      diritems: diritems,
      bread: create_bread(file_path),
    });
    res.end();
  });
}

function create_bread(file_path) {
  var bread_items = _.trimEnd(file_path, "/").split(path.sep);
  var cur_url = "/";
  var bread = bread_items.map(function (v, i) {
    cur_url = path.join(cur_url, v);
    if (v == "") {
      v = "Raspberry Pi";
    }
    return { name: v, url: cur_url, is_last: i == bread_items.length - 1 };
  });

  return bread;
}

function get_language(bm, ext) {
  if (bm == "Makefile") {
    return "makefile";
  } else if (bm == "Gemfile" || bm == "Rakefile") {
    return "ruby";
  }

  if (ext == ".html") {
    return "markup";
  } else if (ext == ".md") {
    return "markdown";
  } else if (ext == ".mk") {
    return "makefile";
  } else if (ext == ".css") {
    return "css";
  } else if (ext == ".js") {
    return "js";
  } else if (ext == ".sh") {
    return "bash";
  } else if (ext == ".c") {
    return "c";
  } else if (ext == ".h") {
    return "cpp";
  } else if (ext == ".cpp" || ext == ".cc") {
    return "cpp";
  } else if (ext == ".rb") {
    return "ruby";
  } else if (ext == ".erl" || ext == ".hrl") {
    return "erlang";
  } else if (ext == ".go") {
    return "go";
  } else if (ext == ".java") {
    return "java";
  } else if (ext == ".lua") {
    return "lua";
  } else if (ext == ".mm") {
    return "objectivec";
  } else if (ext == ".pl" || ext == ".perl") {
    return "perl";
  } else if (ext == ".php") {
    return "php";
  } else if (ext == ".py") {
    return "python";
  } else if (ext == ".swift") {
    return "swift";
  } else if (ext == ".s") {
    return "nasm";
  } else if (ext == ".pug") {
    return "pug";
  }

  return null;
}

app.get("*", async (req, res) => {
  const file_path = querystring.unescape(req.path);
  const is_raw = !!req.param("raw");
  const leaf = path.join(root, file_path);

  try {
    let state = await fs.lstat(leaf);

    if (state.isSymbolicLink()) {
      const link = await fs.readlink(leaf);
      state = await fs.lstat(link);
    }

    if (state.isDirectory()) {
      if (req.param("key")) {
        await search_file(file_path, leaf, req, res);
      } else if (req.param("action")) {
        await do_action(file_path, leaf, req, res);
      } else {
        const dirs = await fs.readdir(leaf);
        const bread = create_bread(file_path);
        const items = await Promise.all(
          dirs.map(async (v) => {
            const tmp = path.join(file_path, v);
            const fullPath = path.join(root, tmp);
            const fstat = await fs.lstat(fullPath);
            const ftc = await get_cls_by_state_withp(fstat, fullPath);

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
      const codename = get_language(bm, extname);

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
    res.status(400).end();
  }
});

media.init();
app.listen(8003);
