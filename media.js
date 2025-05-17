const path = require('path');
const fs = require('fs').promises;
const conv = require('./conv.js');
const notify = require('./notify.js');

const unsupportedMediaExts = ['mov', 'mkv', 'rmvb'];
const workingDirs = [];

function shouldConv(name) {
  const ext = path.extname(name).toLowerCase().slice(1);
  return unsupportedMediaExts.includes(ext);
}

function hasHtml5UnsupportedMedia(items) {
  return items.some(item => shouldConv(item.name));
}

async function doJobInternal(job) {
  try {
    const files = await fs.readdir(job);
    const convFiles = files.filter(shouldConv).map(f => path.join(job, f));
    await new Promise((resolve, reject) => {
      conv(convFiles, true, (err) => err ? reject(err) : resolve(), (file, progress) => {
        notify.notify(JSON.stringify({ file, type: 'notify', progress }));
      });
    });
  } catch (err) {
    console.error('Job failed:', err);
  }
}

async function doJob() {
  if (workingDirs.length === 0) {
    setTimeout(doJob, 1000);
    return;
  }
  await doJobInternal(workingDirs.shift());
  setTimeout(doJob, 1000);
}

module.exports = {
  hasHtml5UnsupportedMedia,
  toHtml5Supported: (dir) => {
    if (!workingDirs.includes(dir)) workingDirs.push(dir);
  },
  init: () => setTimeout(doJob, 1000)
};
