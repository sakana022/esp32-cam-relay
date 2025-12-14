const http = require('http');
const WebSocket = require('ws');

// ==============================================
// 1. 定義網頁內容 (HTML/CSS/JS)
//    這裡把網頁包裝成一個長字串，讓 Node.js 送給瀏覽器
// ==============================================
const htmlContent = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Smart Cane Monitor</title>
    <style>
        body {
            font-family: 'Microsoft JhengHei', Arial, sans-serif;
            background-color: #121212;
            color: white;
            margin: 0;
            padding: 20px;
            text-align: center;
        }

        /* 狀態列 */
        .status-bar {
            background-color: #1f1f1f;
            padding: 15px;
            border-radius: 10px;
            margin-bottom: 20px;
            font-size: 1.2rem;
            font-weight: bold;
            border: 1px solid #333;
        }
        .status-safe { color: #2ecc71; border-color: #2ecc71; }
        .status-danger { color: #e74c3c; border-color: #e74c3c; }
        .status-muted { color: #95a5a6; border-color: #95a5a6; }

        /* 影像區塊 */
        #stream-container {
            margin-bottom: 20px;
            border: 2px solid #333;
            border-radius: 8px;
            display: inline-block;
            overflow: hidden;
            background: #000;
        }
        img {
            max-width: 100%;
            height: auto;
            display: block;
        }

        /* 儀表板 */
        .dashboard {
            display: flex;
            justify-content: space-between;
            gap: 10px;
        }
        .card {
            background-color: #1f1f1f;
            flex: 1;
            padding: 15px 5px;
            border-radius: 10px;
            border: 1px solid #333;
        }
        .card-title {
            font-size: 0.9rem;
            color: #aaa;
            margin-bottom: 5px;
        }
        .card-value {
            font-size: 1.2rem; /* 字體稍微調小以防手機換行 */
            font-weight: bold;
        }
        
        /* 數值顏色 */
        .val-blue { color: #3498db; }
        .val-yellow { color: #f1c40f; }

        /* 模式顏色 */
        .mode-normal { color: #2ecc71; } /* 綠 */
        .mode-crowd { color: #e67e22; }  /* 橘 */
        .mode-muted { color: #e74c3c; text-decoration: line-through; } /* 紅+刪除線 */

    </style>
</head>
<body>

    <div id="status-bar" class="status-bar status-safe">
        ✅ 等待連線...
    </div>

    <div id="stream-container">
        <img id="camera-stream" src="" alt="等待影像..." style="min-height: 240px; min-width: 320px;">
    </div>

    <div class="dashboard">
        <div class="card">
            <div class="card-title">↖️ 左前距離</div>
            <div id="distL" class="card-value val-blue">--- cm</div>
        </div>

        <div class="card">
            <div class="card-title">⚙️ 目前模式</div>
            <div id="sysMode" class="card-value mode-normal">連線中</div>
        </div>

        <div class="card">
            <div class="card-title">↗️ 右前距離</div>
            <div id="distR" class="card-value val-yellow">--- cm</div>
        </div>
    </div>

    <script>
        // 自動判斷 WebSocket 網址
        var wsProtocol = (window.location.protocol === 'https:') ? 'wss://' : 'ws://';
        var wsUrl = wsProtocol + window.location.host; 
        var ws = new WebSocket(wsUrl);

        var img = document.getElementById('camera-stream');
        var elDistL = document.getElementById('distL');
        var elDistR = document.getElementById('distR');
        var elMode = document.getElementById('sysMode');
        var elStatus = document.getElementById('status-bar');

        ws.onopen = function() {
            console.log("Connected to WebSocket");
            elStatus.innerText = "✅ 伺服器已連線";
        };

        ws.onmessage = function(event) {
            // 1. 如果收到的是影像資料 (Blob)
            if (event.data instanceof Blob) {
                var url = URL.createObjectURL(event.data);
                img.src = url;
                img.onload = function() { URL.revokeObjectURL(url); }
            } 
            // 2. 如果收到的是文字數據 (JSON)
            else {
                try {
                    var data = JSON.parse(event.data);

                    // 更新距離顯示
                    elDistL.innerText = (data.L === 999) ? "> 3m" : data.L + " cm";
                    elDistR.innerText = (data.R === 999) ? "> 3m" : data.R + " cm";

                    // 更新模式顯示與翻譯
                    var modeText = "未知";
                    var modeClass = "mode-normal";
                    
                    if (data.Mode === "NORMAL") { 
                        modeText = "🟢 一般模式"; 
                        modeClass = "mode-normal"; 
                    } else if (data.Mode === "CROWD") { 
                        modeText = "🟠 人潮擁擠"; 
                        modeClass = "mode-crowd"; 
                    } else if (data.Mode === "MUTED") { 
                        modeText = "🔴 靜音中"; 
                        modeClass = "mode-muted"; 
                    }
                    
                    elMode.innerText = modeText;
                    elMode.className = "card-value " + modeClass;

                    // 更新頂部狀態列警示
                    if (data.Mode === "MUTED") {
                        elStatus.innerText = "🔇 系統靜音中";
                        elStatus.className = "status-bar status-muted";
                    } else {
                        var minDist = Math.min(data.L, data.R);
                        if (minDist < 50) {
                            elStatus.innerText = "⚠️ 注意前方障礙物！";
                            elStatus.className = "status-bar status-danger";
                        } else {
                            elStatus.innerText = "✅ 安全通行";
                            elStatus.className = "status-bar status-safe";
                        }
                    }

                } catch (e) {
                    console.log("JSON Error", e);
                }
            }
        };

        ws.onclose = function() {
            elStatus.innerText = "❌ 連線中斷";
            elStatus.className = "status-bar status-danger";
        };
    </script>
</body>
</html>
`;

// ==============================================
// 2. 建立 HTTP 伺服器
// ==============================================
const server = http.createServer((req, res) => {
    // 當使用者開啟網頁時，回傳上面的 HTML 內容
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(htmlContent);
});

// ==============================================
// 3. 建立 WebSocket 伺服器 (綁定到 HTTP Server)
// ==============================================
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    console.log('Client connected');
    
    // 當收到 ESP32 傳來的資料
    ws.on('message', (message) => {
        // 廣播給所有連線的人 (也就是您的手機網頁)
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });

    ws.on('close', () => console.log('Client disconnected'));
});

// ==============================================
// 4. 啟動伺服器
// ==============================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is listening on port ${PORT}`);
});
