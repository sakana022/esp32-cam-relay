const http = require('http');
const WebSocket = require('ws');

// ==============================================
// 1. 定義網頁內容 (HTML/CSS/JS)
//    這是之前的穩定版本，包含電量顯示
// ==============================================
const htmlContent = `
<!DOCTYPE html>
<html lang="zh-TW">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ESP32-CAM Monitor</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            background-color: #121212;
            color: #ffffff;
            margin: 0;
            padding: 20px;
            text-align: center;
        }
        h1 { margin-bottom: 20px; }
        
        /* 影像區塊 */
        #cam-container {
            margin: 0 auto 20px auto;
            border: 2px solid #333;
            background-color: #000;
            display: inline-block;
            max-width: 100%;
        }
        img {
            display: block;
            max-width: 100%;
            height: auto;
            min-height: 240px; 
            min-width: 320px;
        }

        /* 數據卡片區塊 */
        .dashboard {
            display: flex;
            justify-content: space-around;
            max-width: 600px;
            margin: 0 auto;
            gap: 10px;
        }
        .card {
            background-color: #1e1e1e;
            padding: 15px;
            border-radius: 10px;
            flex: 1;
            text-align: center;
            border: 1px solid #333;
        }
        .card-title {
            font-size: 0.9rem;
            color: #aaa;
            margin-bottom: 5px;
        }
        .card-value {
            font-size: 1.5rem;
            font-weight: bold;
        }
        
        /* 顏色定義 */
        .val-blue { color: #3498db; }
        .val-yellow { color: #f1c40f; }
        .val-green { color: #2ecc71; }
    </style>
</head>
<body>

    <h1>即時監控系統</h1>

    <div id="cam-container">
        <img id="camera-stream" src="" alt="等待影像連線...">
    </div>

    <div class="dashboard">
        <div class="card">
            <div class="card-title">左側距離</div>
            <div id="val-L" class="card-value val-blue">---</div>
        </div>

        <div class="card">
            <div class="card-title">電池電量</div>
            <div id="val-Bat" class="card-value val-green">---%</div>
        </div>

        <div class="card">
            <div class="card-title">右側距離</div>
            <div id="val-R" class="card-value val-yellow">---</div>
        </div>
    </div>

    <script>
        // 建立 WebSocket 連線
        const wsProtocol = (window.location.protocol === 'https:') ? 'wss://' : 'ws://';
        const wsUrl = wsProtocol + window.location.host;
        const ws = new WebSocket(wsUrl);

        const img = document.getElementById('camera-stream');
        const elL = document.getElementById('val-L');
        const elR = document.getElementById('val-R');
        const elBat = document.getElementById('val-Bat');

        ws.onopen = () => {
            console.log("已連線到伺服器");
        };

        ws.onmessage = (event) => {
            // 1. 處理影像 (Blob)
            if (event.data instanceof Blob) {
                const url = URL.createObjectURL(event.data);
                img.src = url;
                img.onload = () => URL.revokeObjectURL(url);
            } 
            // 2. 處理數據 (JSON字串)
            else {
                try {
                    const data = JSON.parse(event.data);
                    
                    // 更新距離
                    if (data.L !== undefined) elL.innerText = (data.L > 300) ? ">3m" : data.L + " cm";
                    if (data.R !== undefined) elR.innerText = (data.R > 300) ? ">3m" : data.R + " cm";
                    
                    // 更新電量 (相容性寫法)
                    if (data.Bat !== undefined) {
                        elBat.innerText = data.Bat + "%";
                    } else if (data.v !== undefined) { // 有些舊版本是用 v 代表電量
                         elBat.innerText = data.v + "%";
                    }
                } catch (e) {
                    console.error("數據解析錯誤", e);
                }
            }
        };
    </script>
</body>
</html>
`;

// ==============================================
// 2. 建立伺服器 (標準寫法)
// ==============================================
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(htmlContent);
});

// ==============================================
// 3. WebSocket 轉發邏輯
// ==============================================
const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        // 收到 ESP32 的資料，直接廣播給所有連線者 (網頁)
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });
});

// ==============================================
// 4. 啟動監聽
// ==============================================
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
