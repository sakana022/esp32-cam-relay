const http = require('http');
const WebSocket = require('ws');

const html = `<!DOCTYPE html>
<html lang="zh-TW">
<head>
<meta charset="UTF-8">
<title>Smart Cane Monitor</title>
<style>
body{background:#121212;color:#fff;text-align:center;font-family:sans-serif}
.status{margin:10px;padding:10px;border-radius:8px;font-weight:bold}
.safe{color:#2ecc71} .danger{color:#e74c3c} .muted{color:#95a5a6}
img{max-width:100%;border:2px solid #333}
.card{display:inline-block;margin:10px}
</style>
</head>
<body>
<div id="status" class="status safe">等待連線</div>
<img id="img">
<div class="card">左：<span id="L">---</span></div>
<div class="card">模式：<span id="M">---</span></div>
<div class="card">右：<span id="R">---</span></div>

<script>
const ws = new WebSocket((location.protocol==='https:'?'wss':'ws')+'://'+location.host);
const img=document.getElementById('img');
const L=document.getElementById('L');
const R=document.getElementById('R');
const M=document.getElementById('M');
const S=document.getElementById('status');

ws.onmessage=e=>{
 if(typeof e.data!=='string'){
  const u=URL.createObjectURL(e.data);
  img.src=u; img.onload=()=>URL.revokeObjectURL(u);
 }else{
  const d=JSON.parse(e.data);
  L.textContent=d.L===999?'>3m':d.L+'cm';
  R.textContent=d.R===999?'>3m':d.R+'cm';
  M.textContent=d.Mode;
  S.textContent=d.Mode==='MUTED'?'靜音中':'連線正常';
  S.className='status '+(d.Mode==='MUTED'?'muted':'safe');
 }
};
</script>
</body>
</html>`;

const server = http.createServer((_, res) => {
  res.writeHead(200, {'Content-Type':'text/html'});
  res.end(html);
});

const wss = new WebSocket.Server({ server });

wss.on('connection', ws => {
  ws.on('message', (msg, isBinary) => {
    wss.clients.forEach(c => {
      if (c.readyState === WebSocket.OPEN)
        c.send(msg, { binary: isBinary });
    });
  });
});

server.listen(process.env.PORT || 3000);
