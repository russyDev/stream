const express = require("express");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegInstaller = require("@ffmpeg-installer/ffmpeg");
const path = require("path");
const fs = require("fs");

const app = express();
const PORT = 3000;

// Set the path for FFmpeg
ffmpeg.setFfmpegPath(ffmpegInstaller.path);

// Directory to store HLS files
const HLS_DIR = path.join(__dirname, "hls");
if (!fs.existsSync(HLS_DIR)) {
    fs.mkdirSync(HLS_DIR, { recursive: true });
}

// RTMP Stream URL
const RTMP_URL = "rtmp://185.69.152.124:1935/live/stream";

// Start FFmpeg to transcode RTMP to HLS
function startTranscoding() {
    console.log("Starting transcoding...");

    ffmpeg(RTMP_URL)
        .addOptions([
            "-preset ultrafast", // Швидке кодування
            "-g 50", // Частота ключових кадрів
            "-hls_time 1", // Зменшена тривалість сегмента
            "-hls_list_size 2", // Менший розмір плейлиста
            "-hls_flags delete_segments+split_by_time", // Видалення старих сегментів
            "-threads auto", // Використання потоків CPU
        ])
        .output(path.join(HLS_DIR, "stream.m3u8"))
        .on("start", () => console.log("FFmpeg process started"))
        .on("stderr", (stderrLine) => console.log("FFmpeg stderr:", stderrLine))
        .on("error", (err) => console.error("FFmpeg error:", err))
        .on("end", () => console.log("FFmpeg process ended"))
        .run();
}

// Serve HLS files
app.use("/hls", express.static(HLS_DIR));

// Serve a simple HTML player
app.get("/", (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>RTMP Stream</title>
            <script src="https://cdn.jsdelivr.net/npm/hls.js@latest"></script>
        </head>
        <body>
            <video id="video" controls autoplay style="width: 100%; height: auto;"></video>
            <script>
                const video = document.getElementById('video');
                const videoSrc = '/hls/stream.m3u8';

                if (Hls.isSupported()) {
                    const hls = new Hls({
                        debug: false,
                        liveSyncDuration: 1,
                        liveMaxLatencyDuration: 3,
                        enableWorker: true,
                    });
                    hls.loadSource(videoSrc);
                    hls.attachMedia(video);
                    hls.on(Hls.Events.MANIFEST_PARSED, () => {
                        video.play();
                    });
                } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                    // Для Safari (нативна підтримка HLS)
                    video.src = videoSrc;
                    video.addEventListener('loadedmetadata', () => {
                        video.play();
                    });
                } else {
                    alert('Ваш браузер не підтримує відтворення HLS.');
                }
            </script>
        </body>
        </html>
    `);
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    startTranscoding();
});
