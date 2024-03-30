// videoFormat.js
const hbjs = require("handbrake-js");

const convertVideo = (inputPath, outputPath, format, callback) => {
  hbjs
    .spawn({
      input: inputPath,
      output: outputPath,
      preset: "Very Fast 1080p30",
      format,
    })
    .on("error", (err) => callback(err))
    .on("progress", (progress) => {
      console.log(
        "Percent complete: %s, ETA: %s",
        progress.percentComplete,
        progress.eta
      );
    })
    .on("end", () => callback(null, outputPath));
};

module.exports = convertVideo;
