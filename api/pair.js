// XMD Pairing Endpoint
const { default: makeWASocket, useMultiFileAuthState } = require('@whiskeysockets/baileys');
const { Boom } = require('@hapi/boom');
const fs = require('fs');
const path = require('path');

module.exports = async (req, res) => {
  const { number, code } = req.query;

  if (!number || !code) {
    return res.status(400).json({ error: 'Missing number or code' });
  }

  const sessionId = `xmd~${number}`;
  const sessionDir = path.join(__dirname, '..', 'sessions', sessionId);

  if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: false,
  });

  sock.ev.on('creds.update', saveCreds);
  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'open') {
      console.log('✅ Paired:', number);
    } else if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error = Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log('❌ Disconnected. Reconnecting:', shouldReconnect);
      if (shouldReconnect) startSock();
    }
  });

  return res.json({
    sessionId: sessionId,
    status: 'Session created and paired!',
  });
};
