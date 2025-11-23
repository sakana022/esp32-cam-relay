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
            <title>拐杖導航系統</title>
            <style>
                body { background-color: #121212; color: #ffffff; font-family: 'Arial', sans-serif; text-align: center; margin: 0; padding: 10px; }
                
                /* 影像區塊 */
                #cam-container { 
                    position: relative; display: inline-block; margin-top: 10px; 
                    border: 2px solid #555; border-radius: 8px; overflow: hidden; 
                }
                img { width: 100%; max-width: 600px; height: auto; display: block; }

                /* 狀態大字報 */
                #status-box {
                    font-size: 24px; font-weight: bold; margin: 15px 0; padding: 10px;
                    border-radius: 5px; background: #222; color: #aaa;
                }

                /* 數據儀表板 */
                .dashboard { 
                    display: flex; justify-content: center; gap: 10px; flex-wrap: wrap;
                }
                .card {
                    background: #333; padding: 10px; border-radius: 8px; min-width: 90px; flex: 1;
                    box-shadow: 0 4px 6px rgba(0,0,0,0.3);
                }
                .card h3 { margin: 0 0 5px 0; font-size: 14px; color: #ccc; }
                .card span { font-size: 22px; font-weight: bold; }
                
                .safe { color: #00ff00; }     /* 綠 */
                .warning { color: #ffcc00; }  /* 黃 */
                .danger { color: #ff0000; }   /* 紅 */
                .bg-danger { background-color: #550000; color: #ffaaaa; } /* 危險背景 */

            </style>
        </head>
        <body>
            <div id="status-box">安全通行</div>

            <div id="cam-container">
                <img id="stream" src="" alt="連線中..." />
            </div>

            <div class="dashboard">
                <div class="card">
                    <h3>↖️ 左前距離</h3>
                    <span id="L-val">--</span> cm
                </div>

                <div class="card">
                    <h3>🔋 電量</h3>
                    <span id="bat-val" class="safe">--</span> %
                </div>

                <div class="card">
                    <h3>↗️ 右前距離</h3>
                    <span id="R-val">--</span> cm
                </div>
            </div>

            <script>
                const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
                const wsUrl = protocol + '//' + window.location.host;
                let ws;

                function updateColor(elementId, value) {
                    const el = document.getElementById(elementId);
                    el.innerText = value;
                    if (value < 0) {
                         el.innerText = "Err"; el.className = '';
                    } else if (value <= 50) {
                        el.className = 'danger';
                    } else if (value <= 100) {
                        el.className = 'warning';
                    } else {
                        el.className = 'safe';
                    }
                }

                function updateStatus(distL, distR) {
                    const box = document.getElementById('status-box');
                    // 過濾無效數值 (-1)
                    let L = (distL < 0) ? 999 : distL;
                    let R = (distR < 0) ? 999 : distR;

                    if (L < 50 && R < 50) {
                        box.innerText = "🛑 前方障礙！請停止";
                        box.className = "bg-danger";
                    } else if (L < 60) {
                        box.innerText = "⚠️ 左側靠太近 (向右走)";
                        box.className = "";
                        box.style.color = "#ffcc00";
                    } else if (R < 60) {
                        box.innerText = "⚠️ 右側靠太近 (向左走)";
                        box.className = "";
                        box.style.color = "#ffcc00";
                    } else {
                        box.innerText = "✅ 安全通行";
                        box.className = "";
                        box.style.color = "#00ff00";
                    }
                }

                function connect() {
                    ws = new WebSocket(wsUrl);
                    ws.binaryType = 'arraybuffer'; 

                    ws.onmessage = (event) => {
                        if (typeof event.data === 'string') {
                            try {
                                const data = JSON.parse(event.data);
                                
                                // 電量
                                if(data.bat !== undefined) {
                                    document.getElementById('bat-val').innerText = data.bat;
                                }
                                // 左右距離
                                if(data.L !== undefined && data.R !== undefined) {
                                    updateColor('L-val', data.L);
                                    updateColor('R-val', data.R);
                                    updateStatus(data.L, data.R);
                                }

                            } catch (e) { }
                        } else {
                            const blob = new Blob([event.data], {type: 'image/jpeg'});
                            const url = URL.createObjectURL(blob);
                            const img = document.getElementById('stream');
                            if (img.src) URL.revokeObjectURL(img.src);
                            img.src = url;
                        }
                    };
                    ws.onclose = () => { setTimeout(connect, 2000); };
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
