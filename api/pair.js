import express from 'express'
import cors from 'cors'
import {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { createCanvas } from 'canvas'
import QRCode from 'qrcode'
import Pino from 'pino'

const app = express()
app.use(cors())
app.use(express.json())

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

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update
    if (connection === 'open') {
      console.log(`✅ Connected: ${sessionId}`)
    } else if (connection === 'close') {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode
      console.log(`❌ Disconnected [${reason}]`)
    }
  })

  if (mode === 'qr') {
    sock.ev.once('connection.update', async (update) => {
      const { qr } = update
      if (qr) {
        const canvas = createCanvas(300, 300)
        await QRCode.toCanvas(canvas, qr)
        const qrImage = canvas.toDataURL()
        return res.status(200).json({ success: true, session: sessionId, qr: qrImage })
      }
    })
  } else if (mode === 'code') {
    const code = Math.floor(100000 + Math.random() * 900000).toString()
    sessions[phone] = { code, sessionId }

    try {
      await sock.sendMessage(`${phone}@s.whatsapp.net`, {
        text: `🔐 Your *DAVE-XMD* bot code is: *${code}*\n\nEnter this code on the website to activate your bot.`,
      })

      return res.status(200).json({ success: true, code, session: sessionId })
    } catch (err) {
      return res.status(500).json({ success: false, error: 'Failed to send code via WhatsApp' })
    }
  } else {
    return res.status(400).json({ success: false, error: 'Invalid mode. Use "qr" or "code"' })
  }
})

// ✅ For testing the server directly
app.get('/', (req, res) => {
  res.send('✅ DAVE-XMD Pairing Server is Live!')
})

// ✅ Start server
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`✅ DAVE-XMD Pairing Backend running on port ${PORT}`)
})
