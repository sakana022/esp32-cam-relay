const express = require('express');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const port = process.env.PORT || 3000;

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>ESP32-CAM 盲人拐杖監控</title>
            <style>
                body { background-color: #121212; color: #ffffff; font-family: 'Arial', sans-serif; text-align: center; margin: 0; padding: 20px; }
                h2 { margin-bottom: 10px; }
                
                /* 影像區塊 */
                #cam-container { 
                    position: relative; display: inline-block; margin-top: 10px; 
                    border: 3px solid #444; border-radius: 10px; overflow: hidden; 
                }
                img { width: 100%; max-width: 640px; height: auto; display: block; }

                /* 數據儀表板區塊 */
                .dashboard { 
                    display: flex; justify-content: center; gap: 15px; margin-top: 20px; flex-wrap: wrap;
                }
                .card {
                    background: #333; padding: 15px; border-radius: 10px; min-width: 100px;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                }
                .card h3 { margin: 0 0 5px 0; font-size: 14px; color: #aaa; }
                .card span { font-size: 24px; font-weight: bold; }
                
                .highlight { color: #00ff00; } /* 正常顏色 */
                .warning { color: #ffcc00; }   /* 警告顏色 */
                .danger { color: #ff0000; }    /* 危險顏色 */

            </style>
        </head>
        <body>
            <h2>拐杖即時監控與導航</h2>
            
            <div id="cam-container">
                <img id="stream" src="" alt="等待影像連線..." />
            </div>

            <div class="dashboard">
                <div class="card">
                    <h3>🔋 電池電量</h3>
                    <span id="bat-val" class="highlight">--</span> %
                </div>

                <div class="card">
                    <h3>⬆️ 前方距離</h3>
                    <span id="d1-val">--</span> cm
                </div>

                <div class="card">
                    <h3>⬇️ 下方距離</h3>
                    <span id="d2-val">--</span> cm
                </div>
            </div>

            <script>
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsUrl = protocol + '//' + window.location.host;
                let ws;

                function updateColor(elementId, value, safeDist, dangerDist) {
                    const el = document.getElementById(elementId);
                    el.innerText = value;
                    
                    if (value < 0) { // 偵測錯誤
                        el.className = ''; 
                        el.innerText = "超出範圍";
                    } else if (value <= dangerDist) {
                        el.className = 'danger';
                    } else if (value <= safeDist) {
                        el.className = 'warning';
                    } else {
                        el.className = 'highlight';
                    }
                }

                function connect() {
                    ws = new WebSocket(wsUrl);
                    ws.binaryType = 'arraybuffer'; 

                    ws.onopen = () => { console.log('已連線'); };
                    
                    ws.onmessage = (event) => {
                        if (typeof event.data === 'string') {
                            try {
                                const data = JSON.parse(event.data);
                                
                                // 更新電量
                                if(data.bat !== undefined) {
                                    const batEl = document.getElementById('bat-val');
                                    batEl.innerText = data.bat;
                                    batEl.className = data.bat < 20 ? 'danger' : 'highlight';
                                }

                                // 更新前方距離 (假設小於 50cm 為危險)
                                if(data.d1 !== undefined) {
                                    updateColor('d1-val', data.d1, 100, 50);
                                }

                                // 更新下方距離 (假設小於 30cm 為危險)
                                if(data.d2 !== undefined) {
                                    updateColor('d2-val', data.d2, 60, 30);
                                }

                            } catch (e) { console.error(e); }
                        } else {
                            const blob = new Blob([event.data], {type: 'image/jpeg'});
                            const url = URL.createObjectURL(blob);
                            const img = document.getElementById('stream');
                            if (img.src) URL.revokeObjectURL(img.src);
                            img.src = url;
                        }
                    };

                    ws.onclose = () => { setTimeout(connect, 3000); };
                }

                connect();
            </script>
        </body>
        </html>
    `);
});

wss.on('connection', (ws) => {
    ws.on('message', (message, isBinary) => {
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message, { binary: isBinary });
            }
        });
    });
});

server.listen(port, () => {
    console.log(`Server started on port ${port}`);
});
