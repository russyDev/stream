const express = require("express");

const app = express();
const PORT = 3000;

// RTMP Stream URL
const WEBRTC_URL = "webrtc://185.69.152.124:1935/live/stream";

// Serve a simple HTML player
app.get("/", (req, res) => {
    res.send(`
       <!DOCTYPE html>
<html>
<head>
    <title>WebRTC Stream</title>
    <script src="./assets/srs.sdk.js"></script>
</head>
<body>
    <h1>WebRTC Stream</h1>
    <video id="webrtcVideo" autoplay controls style="width: 100%;"></video>
    <script>
        const player = new SrsRtcPlayerAsync();
        player.play({
            url: WEBRTC_URL, // URL вашого WebRTC потоку
        }).then(() => {
            console.log("Playing WebRTC stream!");
        }).catch(console.error);
    </script>
</body>
</html>

    `);
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
