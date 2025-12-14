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

        /* 頂部狀態列 */
        .status-bar {
            background-color: #1f1f1f;
            padding: 15px;
            border-radius: 10px;
            margin-bottom: 20px;
            font-size: 1.2rem;
            font-weight: bold;
            border: 1px solid #333;
        }
        .status-safe { color: #2ecc71; }
        .status-danger { color: #e74c3c; }

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

        /* 儀表板卡片區 */
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
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 5px;
        }

        .card-value {
            font-size: 1.5rem;
            font-weight: bold;
        }

        /* 個別顏色設定 */
        .val-blue { color: #3498db; }
        .val-yellow { color: #f1c40f; }
        
        /* 模式文字顏色 */
        .mode-normal { color: #2ecc71; } /* 綠 */
        .mode-crowd { color: #e67e22; }  /* 橘 */
        .mode-muted { color: #e74c3c; }  /* 紅 */

        /* 簡單的圖示代替 SVG */
        .icon { font-style: normal; }

    </style>
</head>
<body>

    <div id="status-bar" class="status-bar status-safe">
        ✅ 等待連線...
    </div>

    <div id="stream-container">
        <img id="camera-stream" src="" alt="Camera Stream" style="min-height: 240px; min-width: 320px;">
    </div>

    <div class="dashboard">
        <div class="card">
            <div class="card-title"><span class="icon">↖️</span> 左前距離</div>
            <div id="distL" class="card-value val-blue">--- cm</div>
        </div>

        <div class="card">
            <div class="card-title"><span class="icon">⚙️</span> 目前模式</div>
            <div id="sysMode" class="card-value mode-normal">連線中</div>
        </div>

        <div class="card">
            <div class="card-title"><span class="icon">↗️</span> 右前距離</div>
            <div id="distR" class="card-value val-yellow">--- cm</div>
        </div>
    </div>

    <script>
        // 設定您的 WebSocket 網址 (請確認與 ESP32 設定一致)
        // 如果是在 render 上跑，通常是 wss://your-app.onrender.com
        // 這裡自動抓取當前網址
        var wsProtocol = (window.location.protocol === 'https:') ? 'wss://' : 'ws://';
        var wsUrl = wsProtocol + window.location.host; 
        
        // 如果您是直接開 HTML 檔案測試，請手動填入網址，例如：
        // var wsUrl = "wss://my-cane-cam.onrender.com"; 

        var ws = new WebSocket(wsUrl);
        var img = document.getElementById('camera-stream');
        
        // UI 元素
        var elDistL = document.getElementById('distL');
        var elDistR = document.getElementById('distR');
        var elMode = document.getElementById('sysMode');
        var elStatus = document.getElementById('status-bar');

        ws.onopen = function() {
            console.log("Connected to WebSocket");
            elStatus.innerText = "✅ 已連線 - 系統正常";
        };

        ws.onmessage = function(event) {
            // 判斷接收到的是影像(Blob) 還是 數據(Text)
            if (event.data instanceof Blob) {
                var url = URL.createObjectURL(event.data);
                img.src = url;
                img.onload = function() {
                    URL.revokeObjectURL(url);
                }
            } else {
                try {
                    // 解析 JSON 數據: {"L": 120, "R": 130, "Mode": "NORMAL"}
                    var data = JSON.parse(event.data);

                    // 1. 更新距離
                    elDistL.innerText = (data.L === 999) ? "> 300 cm" : data.L + " cm";
                    elDistR.innerText = (data.R === 999) ? "> 300 cm" : data.R + " cm";

                    // 2. 更新模式 (翻譯成中文)
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

                    // 3. 更新頂部警示狀態 (簡單邏輯：靜音不警告，否則看距離)
                    if (data.Mode === "MUTED") {
                        elStatus.innerText = "🔇 系統靜音中";
                        elStatus.className = "status-bar";
                        elStatus.style.color = "#aaa";
                    } else {
                        // 如果距離小於 50cm 視為危險
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
                    console.log("JSON Parse Error", e);
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
