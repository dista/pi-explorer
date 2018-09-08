var path = require('path');
var fs = require('fs');

var unsupportedMediaExts = ['mov', 'mkv', 'rmvb'];
var workingDirs = [];

function inArray(a, c){
  for (var i = 0; i < c.length; i++) {
    if (c[i] == a) {
      return true
    }
  }

  return false
}

function hasHtml5UnsupportedMedia(items){
  for (var i = 0; i < items.length; i++) {
    var item = items[i];
    var extname = path.extname(item.name).toLowerCase();

    if (extname.length > 0 && extname[0] == '.') {
      extname = extname.substring(1);
    }

    if (inArray(extname, unsupportedMediaExts)) {
      return true
    }
  }

  return false
}

module.exports.hasHtml5UnsupportedMedia = hasHtml5UnsupportedMedia;

function toHtml5Supported(dir){
  if (inArray(dir, workingDirs)) {
    return;
  }

  workingDirs.push(dir);
}

module.exports.toHtml5Supported = toHtml5Supported;

function doJobInternal(job, doneCb){
  fs.readdir(job, function(err, files){
    if (err) {
      doneCb(err);
      return;
    }
  });
}

function doJob(){
  if (workingDirs.length == 0) {
    setTimeout(doJob, 1000);
    return;
  }

  var job = workingDirs[0];
  doJobInternal(job, function(){
    workingDirs.shift();
    setTimeout(doJob, 1000);
  });
}

function init() {
  setTimeout(doJob, 1000);
}

module.exports.init = init;
