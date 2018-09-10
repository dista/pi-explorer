var ffmpeg = require('fluent-ffmpeg');
var async = require('async');
var replaceExt = require('replace-ext');
var fs = require('fs');

//var test_files = ['/mnt/westwood/test/a.rmvb', '/mnt/westwood/test/b.MOV'];
//var test_files = ['/mnt/westwood/test/b.MOV'];
//var test_files = ['/mnt/westwood/test/b.MOV', '/mnt/westwood/test/c.mkv'];
//var test_files = ['/mnt/westwood/test/a.rmvb'];

ffmpeg.prototype.videoQuality = function(q) {
  this._currentOutput.video('-qscale:v', '' + q);
  return this;
}

ffmpeg.prototype.videoOptions = function() {
  this._currentOutput.video.apply(this, arguments);
  return this;
}

ffmpeg.prototype.audioOptions = function() {
  this._currentOutput.audio.apply(this, arguments);
  return this;
}

ffmpeg.prototype.audioQuality = function(q) {
  this._currentOutput.audio('-qscale:a', '' + q);
  return this;
}

function conv(files, rm, callback, onProgress){
  var goods = [];
  var bads = [];
  async.eachOfSeries(files, function(file, index, main_cb){
    console.log(file);

    async.waterfall([
        function(cb){
          ffmpeg(file).ffprobe(function(err, meta){
            if (err) {
              return cb(err);
            }

            var copyVideo = false;
            var hasVideo = false;
            var copyAudio = false;
            var hasAudio = false;
            for (var i = 0; i < meta.streams.length; i++) {
              var stream = meta.streams[i];

              if (stream.codec_type == 'video') {
                hasVideo = true;
               
                if (stream.codec_name == 'h264') {
                  copyVideo = true;
                }
              } else if (stream.codec_type == 'audio') {
                hasAudio = true;

                if (stream.codec_name == 'aac') {
                  copyAudio = true;
                }
              }
            }

            cb(null, hasVideo, copyVideo, hasAudio, copyAudio);
          });
        },
        function(hasVideo, copyVideo, hasAudio, copyAudio, cb){
          console.log("analyze");
          console.log(hasVideo);
          console.log(copyVideo);
          console.log(hasAudio);
          console.log(copyAudio);

          if (!hasVideo && !hasAudio) {
            return cb("no media");
          }

          var cmd = ffmpeg(file);

          if (hasVideo){
            if (copyVideo) {
              cmd.videoCodec('copy');
            } else {
              cmd.withVideoCodec('libx264')
                .videoQuality(0)
                .videoOptions('-preset', 'fast');
            }
          } else {
            cmd.noVideo();
          }

          if (hasAudio){
            if (copyAudio) {
              cmd.audioCodec('copy');
            } else {
              cmd.withAudioCodec('libfaac')
                .audioQuality(0);
            }
          } else {
            cmd.noAudio();
          }

          if (onProgress){
            cmd.on('progress', function(progress){
              onProgress(file, progress);
            });
          }

          var output = replaceExt(file, '.mp4');
          cmd.output(output)
            .outputOptions('-threads 2')
            .on('end', function(stdout, stderr){
              console.log('end');
              goods.push(file);

              if (rm) {
                fs.unlink(file, function(){
                  cb(null);
                });
              } else {
                cb(null);
              }
            })
            .on('error', function(err, stdout, stderr){
              console.log(err);
              bads.push(file);
              cb(err);
            }).run();

        }
    ], function(err, result){
      main_cb(null);
    })
  }, function(err){
    callback(err, goods, bads);
  });
}

/*
conv(test_files, function(err){
  console.log('done');
});
*/

module.exports = conv;

/*
ffmpeg('/mnt/westwood/test/a.rmvb').ffprobe(function(err, data){
  console.log(err);
  console.log(data);
});
*/
