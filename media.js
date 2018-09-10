var path = require('path');
var fs = require('fs');
var conv = require('./conv.js');
var notify = require('./notify.js');
//var async = require('async');

var unsupportedMediaExts = ['mov', 'mkv', 'rmvb'];
var workingDirs = [];

function inArray(a, c){
  for (var i = 0; i < c.length; i++) {
    if (c[i] == a) {
      return true;
    }
  }

  return false;
}

function shouldConv(name){
  var extname = path.extname(name).toLowerCase();

  if (extname.length > 0 && extname[0] == '.') {
    extname = extname.substring(1);
  }

  if (inArray(extname, unsupportedMediaExts)) {
    return true;
  }

  return false;
}

function hasHtml5UnsupportedMedia(items){
  for (var i = 0; i < items.length; i++) {
    var item = items[i];

    if (shouldConv(item.name)) {
      return true;
    }
  }

  return false;
}

module.exports.hasHtml5UnsupportedMedia = hasHtml5UnsupportedMedia;

function toHtml5Supported(dir){
  console.log('push to');
  console.log(dir);
  if (inArray(dir, workingDirs)) {
    console.log('in array');
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

    var convFiles = files.filter(function(v){
      return shouldConv(v);
    }).map(function(v){
      return path.join(job, v);
    });

    conv(convFiles, true, function(err, goods, bads){
      console.log('convert result:');
      console.log(err);
      console.log(goods);

      doneCb();

      /*
      async.eachLimit(goods, 4, function(item, cb){
        fs.unlink(item, cb);
      }, function(){
        doneCb();
      });
      */
    }, function(file, progress){
      //console.log(file);
      //console.log(progress);
      notify.notify(JSON.stringify({file: file, type: 'notify', progress: progress}));
    });
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
