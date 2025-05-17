const ffmpeg = require("fluent-ffmpeg");
const replaceExt = require("replace-ext");
const fs = require("fs").promises;

// Extend ffmpeg prototype
ffmpeg.prototype.videoQuality = function (q) {
  this._currentOutput.video("-qscale:v", "" + q);
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
  this._currentOutput.audio("-qscale:a", "" + q);
  return this;
};

async function analyzeFile(file) {
  return new Promise((resolve, reject) => {
    ffmpeg(file).ffprobe((err, meta) => {
      if (err) reject(err);
      else {
        let hasVideo = false,
          copyVideo = false,
          hasAudio = false,
          copyAudio = false;
        meta.streams.forEach((stream) => {
          if (stream.codec_type === "video") {
            hasVideo = true;
            if (stream.codec_name === "h264") copyVideo = true;
          } else if (stream.codec_type === "audio") {
            hasAudio = true;
            if (stream.codec_name === "aac") copyAudio = true;
          }
        });
        resolve({ hasVideo, copyVideo, hasAudio, copyAudio });
      }
    });
  });
}

async function convertFile(file, rm, onProgress) {
  try {
    const { hasVideo, copyVideo, hasAudio, copyAudio } =
      await analyzeFile(file);
    if (!hasVideo && !hasAudio) throw new Error("No media streams found");

    const cmd = ffmpeg(file);
    if (hasVideo) {
      if (copyVideo) cmd.videoCodec("copy");
      else
        cmd
          .withVideoCodec("libx264")
          .videoQuality(0)
          .videoOptions("-preset", "fast");
    } else cmd.noVideo();

    if (hasAudio) {
      if (copyAudio) cmd.audioCodec("copy");
      else cmd.withAudioCodec("libfaac").audioQuality(0);
    } else cmd.noAudio();

    if (onProgress)
      cmd.on("progress", (progress) => onProgress(file, progress));

    const output = replaceExt(file, ".mp4");
    await new Promise((resolve, reject) => {
      cmd
        .output(output)
        .outputOptions("-threads 3")
        .on("end", () => resolve())
        .on("error", (err) => reject(err))
        .run();
    });

    if (rm) await fs.unlink(file);
    return { success: true, file };
  } catch (err) {
    return { success: false, file, error: err };
  }
}

async function conv(files, rm, callback, onProgress) {
  const goods = [],
    bads = [];
  for (const file of files) {
    const result = await convertFile(file, rm, onProgress);
    result.success ? goods.push(result.file) : bads.push(result.file);
  }
  callback(null, goods, bads);
}

module.exports = conv;
