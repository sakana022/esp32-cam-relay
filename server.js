const http = require('http');
const WebSocket = require('ws');

// ==============================================
// 1. 定義網頁內容 (HTML/CSS/JS)
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
            font-size: 1.5rem;
            font-weight: bold;
        }
        
        .val-blue { color: #3498db; }
        .val-yellow { color: #f1c40f; }
        .val-green { color: #2ecc71; } 
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
            <div class="card-title">🔋 電量</div>
            <div id="batLevel" class="card-value val-green">-- %</div>
        </div>

        <div class="card">
            <div class="card-title">↗️ 右前距離</div>
            <div id="distR" class="card-value val-yellow">--- cm</div>
        </div>
    </div>

    <script>
        var wsProtocol = (window.location.protocol === 'https:') ? 'wss://' : 'ws://';
        var wsUrl = wsProtocol + window.location.host; 
        var ws = new WebSocket(wsUrl);

        var img = document.getElementById('camera-stream');
        var elDistL = document.getElementById('distL');
        var elDistR = document.getElementById('distR');
        var elBat = document.getElementById('batLevel'); 
        var elStatus = document.getElementById('status-bar');

        ws.onopen = function() {
            elStatus.innerText = "✅ 伺服器已連線";
        };

        ws.onmessage = function(event) {
            if (event.data instanceof Blob) {
                var url = URL.createObjectURL(event.data);
                img.src = url;
                img.onload = function() { URL.revokeObjectURL(url); }
            } 
            else {
                try {
                    var data = JSON.parse(event.data);

                    elDistL.innerText = (data.L === 999) ? "> 3m" : data.L + " cm";
                    elDistR.innerText = (data.R === 999) ? "> 3m" : data.R + " cm";
                    
                    if (data.Bat !== undefined) {
                        elBat.innerText = data.Bat + " %";
                    } else {
                        elBat.innerText = "-- %";
                    }

                    var minDist = Math.min(data.L, data.R);
                    if (minDist < 50) {
                        elStatus.innerText = "⚠️ 注意前方障礙物！";
                        elStatus.className = "status-bar status-danger";
                    } else {
                        elStatus.innerText = "✅ 安全通行";
                        elStatus.className = "status-bar status-safe";
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
// 2. 啟動伺服器
// ==============================================
const server = http.createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(htmlContent);
});

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws) => {
    ws.on('message', (message) => {
        wss.clients.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
                client.send(message);
            }
        });
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server started on port ${PORT}`);
});
