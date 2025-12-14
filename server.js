const http = require('http');
const WebSocket = require('ws');

const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>智慧導盲杖監控系統</title>
<link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css" rel="stylesheet">
<style>
  :root {
    --bg-color: #0f172a;
    --card-bg: #1e293b;
    --text-primary: #f1f5f9;
    --text-secondary: #94a3b8;
    --accent-green: #10b981;
    --accent-red: #ef4444;
    --accent-blue: #3b82f6;
    --accent-yellow: #f59e0b;
  }

  body {
    background-color: var(--bg-color);
    color: var(--text-primary);
    font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
    margin: 0;
    padding: 20px;
    display: flex;
    flex-direction: column;
    align-items: center;
    min-height: 100vh;
  }

  /* 標題區塊 */
  header {
    margin-bottom: 20px;
    text-align: center;
  }
  
  h1 {
    margin: 0;
    font-size: 1.8rem;
    letter-spacing: 1px;
    background: linear-gradient(90deg, #3b82f6, #10b981);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .connection-status {
    font-size: 0.9rem;
    margin-top: 5px;
    color: var(--text-secondary);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
  }

  .status-dot {
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background-color: var(--text-secondary);
    display: inline-block;
  }
  .status-dot.active { background-color: var(--accent-green); box-shadow: 0 0 8px var(--accent-green); }
  .status-dot.error { background-color: var(--accent-red); }

  /* 影像區塊 */
  .camera-container {
    position: relative;
    width: 100%;
    max-width: 640px;
    aspect-ratio: 4/3;
    background: #000;
    border-radius: 12px;
    overflow: hidden;
    box-shadow: 0 4px 20px rgba(0,0,0,0.5);
    border: 1px solid #334155;
    margin-bottom: 24px;
    display: flex;
    justify-content: center;
    align-items: center;
  }

  #img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .placeholder {
    position: absolute;
    color: var(--text-secondary);
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
  }

  /* 數據儀表板 */
  .dashboard {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 16px;
    width: 100%;
    max-width: 640px;
  }

  .card {
    background: var(--card-bg);
    padding: 16px;
    border-radius: 12px;
    text-align: center;
    border: 1px solid #334155;
    transition: transform 0.2s, box-shadow 0.2s;
  }

  .card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(0,0,0,0.2);
  }

  .card-icon {
    font-size: 1.5rem;
    margin-bottom: 8px;
    color: var(--accent-blue);
  }

  .card-label {
    font-size: 0.8rem;
    color: var(--text-secondary);
    text-transform: uppercase;
    letter-spacing: 0.5px;
  }

  .card-value {
    font-size: 1.5rem;
    font-weight: bold;
    margin-top: 4px;
    font-family: 'Courier New', monospace;
  }

  /* 狀態顏色類別 */
  .text-danger { color: var(--accent-red); }
  .text-safe { color: var(--accent-green); }
  .text-warn { color: var(--accent-yellow); }
  .bg-danger { border-color: var(--accent-red); box-shadow: inset 0 0 10px rgba(239, 68, 68, 0.1); }

  /* 手機版調整 */
  @media (max-width: 500px) {
    .dashboard {
      grid-template-columns: 1fr; /* 變成單欄 */
    }
    .card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px;
    }
    .card-icon { margin-bottom: 0; }
    .card-content { text-align: right; }
  }
</style>
</head>
<body>

<header>
  <h1><i class="fas fa-walking"></i> Smart Cane Monitor</h1>
  <div class="connection-status">
    <span id="status-dot" class="status-dot"></span>
    <span id="status-text">等待連線中...</span>
  </div>
</header>

<div class="camera-container">
  <div id="loader" class="placeholder">
    <i class="fas fa-spinner fa-spin fa-2x"></i>
    <span>等待影像傳輸...</span>
  </div>
  <img id="img" alt="Camera Feed">
</div>

<div class="dashboard">
  <div class="card" id="card-l">
    <div class="card-icon"><i class="fas fa-arrow-left"></i></div>
    <div class="card-content">
      <div class="card-label">左側障礙物</div>
      <div class="card-value" id="L">---</div>
    </div>
  </div>

  <div class="card" id="card-m">
    <div class="card-icon"><i id="mode-icon" class="fas fa-robot"></i></div>
    <div class="card-content">
      <div class="card-label">系統模式</div>
      <div class="card-value" id="M">---</div>
    </div>
  </div>

  <div class="card" id="card-r">
    <div class="card-icon"><i class="fas fa-arrow-right"></i></div>
    <div class="card-content">
      <div class="card-label">右側障礙物</div>
      <div class="card-value" id="R">---</div>
    </div>
  </div>
</div>

<script>
  // 自動判斷使用 ws 還是 wss
  const protocol = location.protocol === 'https:' ? 'wss' : 'ws';
  const ws = new WebSocket(protocol + '://' + location.host);
  
  const img = document.getElementById('img');
  const loader = document.getElementById('loader');
  const elL = document.getElementById('L');
  const elR = document.getElementById('R');
  const elM = document.getElementById('M');
  const statusText = document.getElementById('status-text');
  const statusDot = document.getElementById('status-dot');
  const cardL = document.getElementById('card-l');
  const cardR = document.getElementById('card-r');
  const modeIcon = document.getElementById('mode-icon');

  let isConnected = false;

  ws.onopen = () => {
    isConnected = true;
    statusText.textContent = "伺服器已連線";
    statusDot.className = "status-dot active";
  };

  ws.onclose = () => {
    isConnected = false;
    statusText.textContent = "連線中斷";
    statusDot.className = "status-dot error";
  };

  ws.onmessage = e => {
    if (typeof e.data !== 'string') {
      // 處理影像 Blob
      const url = URL.createObjectURL(e.data);
      img.src = url;
      img.onload = () => URL.revokeObjectURL(url);
      
      // 隱藏載入動畫，顯示圖片
      loader.style.display = 'none';
      img.style.display = 'block';
    } else {
      // 處理 JSON 數據
      try {
        const d = JSON.parse(e.data);
        
        // 更新數值與格式化
        updateDistance(elL, cardL, d.L);
        updateDistance(elR, cardR, d.R);
        updateMode(d.Mode);

      } catch (err) {
        console.error("JSON Parse Error:", err);
      }
    }
  };

  function updateDistance(element, card, value) {
    if (value === 999 || value > 300) {
      element.textContent = "> 3m";
      element.className = "card-value text-safe";
      card.classList.remove("bg-danger");
    } else {
      element.textContent = value + " cm";
      if (value < 50) {
        element.className = "card-value text-danger"; // 危險紅字
        card.classList.add("bg-danger"); // 卡片紅框
      } else {
        element.className = "card-value";
        card.classList.remove("bg-danger");
      }
    }
  }

  function updateMode(mode) {
    if (mode === 'MUTED') {
      elM.textContent = "靜音模式";
      elM.className = "card-value text-warn";
      modeIcon.className = "fas fa-volume-mute";
    } else if (mode === 'CROWD') {
      elM.textContent = "擁擠模式";
      elM.className = "card-value text-danger";
      modeIcon.className = "fas fa-users";
    } else {
      elM.textContent = "正常偵測";
      elM.className = "card-value text-safe";
      modeIcon.className = "fas fa-volume-up";
    }
  }
</script>
</body>
</html>`;

const server = http.createServer((_, res) => {
  res.writeHead(200, {'Content-Type':'text/html'});
  res.end(html);
});

const wss = new WebSocket.Server({ server });

wss.on('connection', ws => {
  console.log('Client connected');
  ws.on('message', (msg, isBinary) => {
    // 廣播訊息給所有連接的客戶端
    wss.clients.forEach(c => {
      if (c.readyState === WebSocket.OPEN) {
        c.send(msg, { binary: isBinary });
      }
    });
  });
});

server.listen(process.env.PORT || 3000, () => {
  console.log('Server started on port ' + (process.env.PORT || 3000));
});
