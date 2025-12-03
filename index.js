// server.js
// Basic Express.js server (Node.js v18.17.0)

const express = require('express');
const path = require('path');
const fs = require('fs');
const app = express();
// Define the port
const PORT = process.env.PORT || 3000;

// Load config (sanitize before exposing)
let config = {};
try {
  const raw = fs.readFileSync(path.join(__dirname, 'config.json'), 'utf8');
  const parsed = JSON.parse(raw);
  config = {
    roomUrl: parsed.ROOM_URL || '',
    joinToken: parsed.DAILY_TOKEN || '',
  };
} catch (err) {
  console.warn('No config.json found or failed to parse; using defaults.');
}

// Serve static assets from /public
app.use(express.static(path.join(__dirname, 'public')));

// Expose only the non-secret bits needed by the frontend
app.get('/config', (_req, res) => {
  res.json(config);
});

app.get('/*splat', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start the server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server is running at http://localhost:${PORT}`);
});
