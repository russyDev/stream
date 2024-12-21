const express = require("express");
const WebSocket = require("ws");
const { spawn } = require("child_process");

const app = express();
const PORT = 3003;

// Serve a basic HTML page for testing
app.get("/", (req, res) => {
    res.send(`<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Stream to OBS</title>
</head>
<body>
    <h1>Stream to OBS</h1>
    <video id="video" autoplay muted></video>
    <script>
        // Check if getUserMedia is supported
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            console.error("Error: getUserMedia is not supported in this browser.");
            alert("Your browser does not support media device access. Please use the latest version of Chrome, Firefox, Edge, or Safari.");
        } else {
            // Try accessing media devices
            navigator.mediaDevices.getUserMedia({ video: true, audio: true })
                .then((stream) => {
                    console.log("Media devices accessed successfully.");
                    const video = document.getElementById('video');
                    video.srcObject = stream; // Display local video stream
                    video.onloadedmetadata = () => {
                        console.log("Video metadata loaded. Playing video...");
                        video.play();
                    };

                    // Establish WebSocket connection
                    const ws = new WebSocket('ws://localhost:3000');
                    ws.onopen = () => console.log("WebSocket connection opened.");
                    ws.onclose = () => console.log("WebSocket connection closed.");
                    ws.onerror = (error) => console.error("WebSocket error:", error);

                    // Stream video data to WebSocket server
                    const mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm; codecs=vp9' });
                    mediaRecorder.ondataavailable = (event) => {
                        console.log("MediaRecorder data available. Chunk size:", event.data.size);
                        if (event.data.size > 0 && ws.readyState === WebSocket.OPEN) {
                            console.log("Sending chunk to WebSocket server...");
                            ws.send(event.data);
                        }
                    };
                    mediaRecorder.onerror = (error) => console.error("MediaRecorder error:", error);
                    mediaRecorder.start(1000); // Send data every second
                    console.log("MediaRecorder started.");
                })
                .catch((error) => {
                    console.error("Error accessing media devices:", error);
                    alert("Could not access your camera or microphone. Please check your permissions and try again.");
                });
        }
    </script>
</body>
</html>

  `);
});

// Start WebSocket server
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
        "rtmp://185.69.152.124:1935/live/stream" // Replace with your RTMP server URL
    ]);

    console.log("FFmpeg process started.");

    ffmpeg.stderr.on("data", (data) => {
        console.error(`FFmpeg Error: ${data.toString()}`);
    });

    ffmpeg.on("error", (err) => {
        console.error(`Failed to start FFmpeg: ${err.message}`);
    });

    ffmpeg.on("close", (code) => {
        console.log(`FFmpeg process exited with code ${code}`);
    });

    ws.on("message", (message) => {
        console.log("Received message from client. Chunk size:", message.length, "bytes");
        if (ffmpeg.stdin.writable) {
            console.log("Writing chunk to FFmpeg...");
            ffmpeg.stdin.write(message); // Pipe WebSocket data to FFmpeg
        } else {
            console.error("FFmpeg stdin is not writable.");
        }
    });

    ws.on("close", () => {
        console.log("WebSocket connection closed.");
        if (ffmpeg.stdin.writable) {
            console.log("Closing FFmpeg stdin...");
            ffmpeg.stdin.end();
        }
        console.log("Killing FFmpeg process...");
        ffmpeg.kill("SIGINT"); // Clean up FFmpeg process
    });

    ws.on("error", (error) => {
        console.error("WebSocket error:", error);
    });
});
