import express from 'express'
import cors from 'cors'
import {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import { existsSync, mkdirSync, readFileSync } from 'fs'
import { join, resolve } from 'path'
import QRCode from 'qrcode'
import Pino from 'pino'

const app = express()
app.use(cors())
app.use(express.json())
app.use(express.static('public')) // Serve frontend

const sessions = {}

app.post('/api/pair', async (req, res) => {
  const { phone, mode } = req.body

  if (!phone || !/^[0-9]{10,15}$/.test(phone)) {
    return res.status(400).json({ success: false, error: 'Invalid phone number format' })
  }

  const sessionId = `DAVE-XMD~${phone.slice(-4)}~${Math.random().toString(36).substring(2, 6)}`
  const sessionDir = join(process.cwd(), 'sessions', sessionId)
  if (!existsSync(sessionDir)) mkdirSync(sessionDir, { recursive: true })

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    logger: Pino({ level: 'silent' }),
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, Pino({ level: 'fatal' })),
    },
    browser: ['DAVE-XMD', 'Chrome', '20.0.04'],
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.once('connection.update', async (update) => {
    const { connection } = update
    if (connection === 'open') {
      console.log(`✅ Connected: ${sessionId}`)
      await sock.sendMessage(`${phone}@s.whatsapp.net`, {
        text: `✅ *DAVE-XMD Bot Linked Successfully!*\n🆔 *Session ID:* ${sessionId}\n\nCopy & paste this into your bot.`,
      })
    }
  })

  if (mode === 'qr') {
    try {
      const qrImage = await new Promise((resolveQR, rejectQR) => {
        sock.ev.once('connection.update', async (update) => {
          const { qr } = update
          if (qr) {
            const image = await QRCode.toDataURL(qr)
            resolveQR(image)
          } else {
            rejectQR('QR not generated')
          }
        })
      })

      return res.status(200).json({ success: true, session: sessionId, qr: qrImage })
    } catch (err) {
      console.error('❌ Error generating QR:', err)
      return res.status(500).json({ success: false, error: 'QR generation failed' })
    }

  } else if (mode === 'code') {
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    sessions[phone] = { code, sessionId }

    try {
      await sock.sendMessage(`${phone}@s.whatsapp.net`, {
        text: `🔐 Your *DAVE-XMD* pairing code is: *${code}*\n\nEnter this code on the website to activate your bot.`,
      })

      return res.status(200).json({ success: true, code, session: sessionId })
    } catch (err) {
      console.error('❌ Error sending code:', err)
      return res.status(500).json({ success: false, error: 'Failed to send code via WhatsApp' })
    }
  } else {
    return res.status(400).json({ success: false, error: 'Invalid mode. Use "qr" or "code"' })
  }
})

// Serve frontend
app.get('/', (req, res) => {
  const html = readFileSync(resolve('public/index.html'), 'utf-8')
  res.setHeader('Content-Type', 'text/html')
  res.send(html)
})

// Start server
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`✅ DAVE-XMD Pairing Backend running on port ${PORT}`)
})
