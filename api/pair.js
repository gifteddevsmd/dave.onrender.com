import { makeWASocket, useMultiFileAuthState, fetchLatestBaileysVersion, DisconnectReason } from '@whiskeysockets/baileys';
import { Boom } from '@hapi/boom';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createCanvas } from 'canvas';

const sessions = {}; // For code mode tracking

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Only POST requests allowed' });
  }

  const { phone, mode } = req.body;

  if (!phone || !/^[0-9]{10,15}$/.test(phone)) {
    return res.status(400).json({ success: false, error: 'Invalid phone number format' });
  }

  const sessionId = `gifteddave~${phone.slice(-4)}~${Math.random().toString(36).substring(2, 6)}`;
  const sessionDir = join(process.cwd(), 'sessions', sessionId);

  if (!existsSync(sessionDir)) mkdirSync(sessionDir, { recursive: true });

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir);
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    printQRInTerminal: false,
    auth: state,
    browser: ['Dave-Md-V1', 'Chrome', '110.0'],
  });

  sock.ev.on('creds.update', saveCreds);

  // QR Pairing Mode
  if (mode === 'qr') {
    sock.ev.once('connection.update', async (update) => {
      const { qr, connection, lastDisconnect } = update;

      if (qr) {
        const canvas = createCanvas(300, 300);
        const QRCode = await import('qrcode');
        await QRCode.toCanvas(canvas, qr);
        const qrImage = canvas.toDataURL();
        return res.status(200).json({ success: true, session: sessionId, qr: qrImage });
      }

      if (connection === 'open') {
        console.log(`✅ QR connected: ${sessionId}`);
      }

      if (connection === 'close') {
        const reason = new Boom(lastDisconnect?.error)?.output?.statusCode;
        console.log(`❌ QR Disconnected: ${reason}`);
      }
    });

  // Code Pairing Mode
  } else if (mode === 'code') {
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    sessions[phone] = { code, sessionId };

    try {
      await sock.sendMessage(`${phone}@s.whatsapp.net`, {
        text: `🔐 Your *Dave-Md-V1* bot code is: *${code}*\n\nEnter this code on the website to activate your bot.`,
      });

      return res.status(200).json({ success: true, code });
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Failed to send code via WhatsApp' });
    }

  } else {
    return res.status(400).json({ success: false, error: 'Invalid mode. Use "qr" or "code"' });
  }
    }
