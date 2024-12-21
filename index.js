const express = require("express");
const WebSocket = require("ws");
const { spawn } = require("child_process");

const app = express();
const PORT = 3000;

// Serve a basic HTML page for testing
app.get("/", (req, res) => {
    res.send(`
    <html>
      <body>
        <h1>Stream to OBS</h1>
        <video id="video" autoplay muted></video>
        <script>
          navigator.mediaDevices.getUserMedia({ video: true, audio: true })
            .then(stream => {
              const video = document.getElementById('video');
              video.srcObject = stream;

              const ws = new WebSocket('ws://localhost:3000'); // Hardcoded port for WebSocket connection
              const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });

              mediaRecorder.ondataavailable = event => {
                if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
                  ws.send(event.data);
                }
              };

              mediaRecorder.onerror = (error) => {
                console.error("MediaRecorder error:", error);
              };

              mediaRecorder.start(1000); // Send data every 1 second
            })
            .catch(error => {
              console.error("Error accessing media devices:", error);
            });
        </script>
      </body>
    </html>
  `);
});

// Set up WebSocket server
const wss = new WebSocket.Server({ server: app.listen(PORT, () => console.log(`Server running on http://localhost:${PORT}`)) });

wss.on("connection", (ws) => {
    console.log("WebSocket connection established.");

    const ffmpeg = spawn("ffmpeg", [
        "-re",                  // Read input at real-time speed
        "-i", "-",              // Input from stdin
        "-c:v", "libx264",      // Encode video as H.264
        "-preset", "fast",      // Set encoding preset
        "-tune", "zerolatency", // Optimize for low latency
        "-b:v", "3000k",        // Video bitrate
        "-f", "flv",            // Output format
        "rtmp://localhost:1935/live/stream" // Updated to include stream key
    ]);

    ffmpeg.stderr.on("data", (data) => {
        console.error(`FFmpeg Error: ${data}`);
    });

    ffmpeg.on("error", (err) => {
        console.error(`Failed to start FFmpeg: ${err.message}`);
    });

    ffmpeg.on("close", (code) => {
        console.log(`FFmpeg process exited with code ${code}`);
    });

    ws.on("message", (message) => {
        if (ffmpeg.stdin.writable) {
            ffmpeg.stdin.write(message);
        }
    });

    ws.on("close", () => {
        console.log("WebSocket connection closed.");
        if (ffmpeg.stdin.writable) {
            ffmpeg.stdin.end();
        }
        ffmpeg.kill("SIGINT");
    });
});
