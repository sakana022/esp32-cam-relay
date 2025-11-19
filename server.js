const express = require('express');
const WebSocket = require('ws');
const http = require('http');

const app = express();
// Render 會自動提供 PORT 環境變數，如果沒有就用 3000
const port = process.env.PORT || 3000;

// 建立 HTTP 伺服器
const server = http.createServer(app);

// 建立 WebSocket 伺服器
const wss = new WebSocket.Server({ server });

// 當你用瀏覽器打開網址時，顯示這個網頁
app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>ESP32-CAM 盲人拐杖監控</title>
            <style>
                body { background-color: #121212; color: #ffffff; font-family: Arial, sans-serif; text-align: center; margin: 0; padding: 20px; }
                h2 { margin-bottom: 10px; }
                #cam-container { position: relative; display: inline-block; margin-top: 20px; border: 3px solid #444; border-radius: 10px; overflow: hidden; }
                img { width: 100%; max-width: 640px; height: auto; display: block; }
                .status { margin-top: 15px; font-size: 1.2em; padding: 10px; background: #333; border-radius: 5px; display: inline-block; }
                .highlight { color: #00ff00; font-weight: bold; }
            </style>
        </head>
        <body>
            <h2>拐杖視角即時監控</h2>
            <div id="cam-container">
                <img id="stream" src="" alt="等待連線中..." />
            </div>
            <br>
            <div class="status">
                🔋 電量: <span id="bat" class="highlight">等待數據...</span>
            </div>

            <script>
                // 自動判斷是 ws:// 還是 wss:// (加密)
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsUrl = protocol + '//' + window.location.host;
                let ws;

                function connect() {
                    ws = new WebSocket(wsUrl);
                    ws.binaryType = 'arraybuffer'; // 接收二進位圖片數據

                    ws.onopen = () => { console.log('已連線至伺服器'); };
                    
                    ws.onmessage = (event) => {
                        // 如果收到的是文字 (電量 JSON)
                        if (typeof event.data === 'string') {
                            try {
                                const data = JSON.parse(event.data);
                                if(data.bat !== undefined) {
                                    document.getElementById('bat').innerText = data.bat + "%";
                                    // 低電量警示
                                    document.getElementById('bat').style.color = data.bat < 20 ? '#ff0000' : '#00ff00';
                                }
                            } catch (e) { console.error(e); }
                        } 
                        // 如果收到的是二進位資料 (圖片)
                        else {
                            const blob = new Blob([event.data], {type: 'image/jpeg'});
                            const url = URL.createObjectURL(blob);
                            const img = document.getElementById('stream');
                            
                            // 釋放舊的記憶體，避免瀏覽器卡頓
                            if (img.src) URL.revokeObjectURL(img.src);
                            img.src = url;
                        }
                    };

                    ws.onclose = () => {
                        console.log('連線中斷，3秒後重連...');
                        setTimeout(connect, 3000);
                    };
                }

                connect();
            </script>
        </body>
        </html>
    `);
});

// WebSocket 連線處理
wss.on('connection', (ws) => {
    console.log('Client connected');

    ws.on('message', (message, isBinary) => {
        // 廣播機制：收到任何訊息（無論是圖片還是電量），都轉發給其他所有人
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message, { binary: isBinary });
            }
        });
    });

    ws.on('close', () => console.log('Client disconnected'));
});

server.listen(port, () => {
    console.log(`Server started on port ${port}`);
});
