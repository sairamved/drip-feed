const WebSocket = require('ws');
const http = require('http');
const fs = require('fs');
const path = require('path');

const server = http.createServer((req, res) => {
  let filePath = req.url === '/' ? '/index.html' : req.url;
  filePath = path.join(__dirname, 'public', filePath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath);
    let contentType = 'text/html';
    if (ext === '.js') contentType = 'text/javascript';
    if (ext === '.css') contentType = 'text/css';
    if (ext === '.csv') contentType = 'text/csv';

    res.writeHead(200, { 'Content-Type': contentType });
    res.end(data);
  });
});

const wss = new WebSocket.Server({ server });

let clients = [];

wss.on('connection', ws => {
  clients.push(ws);

  ws.on('message', msg => {
    const msgStr = msg.toString();
    clients.forEach(c => {
      if (c.readyState === ws.OPEN) {
        c.send(msgStr);
      }
    });
  });

  ws.on('close', () => {
    clients = clients.filter(c => c !== ws);
  });
});

// Master time pulse
setInterval(() => {
  const m = JSON.stringify({ type: "TICK" });
  clients.forEach(c => c.send(m));
}, 1000);

server.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
});
