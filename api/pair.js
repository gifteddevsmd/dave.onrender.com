import express from 'express'
import cors from 'cors'
import {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import { writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { createCanvas } from 'canvas'
import QRCode from 'qrcode'

const app = express()
app.use(cors())
app.use(express.json())

const sessions = {} // For code mode tracking

app.post('/api/pair', async (req, res) => {
  const { phone, mode } = req.body

  if (!phone || !/^[0-9]{10,15}$/.test(phone)) {
    return res.status(400).json({ success: false, error: 'Invalid phone number format' })
  }

  const sessionId = `gifteddave~${phone.slice(-4)}~${Math.random().toString(36).substring(2, 6)}`
  const sessionDir = join(process.cwd(), 'sessions', sessionId)

  if (!existsSync(sessionDir)) mkdirSync(sessionDir, { recursive: true })

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    printQRInTerminal: false,
    auth: state,
    browser: ['DAVE-XMD', 'Chrome', '110.0'],
  })

  sock.ev.on('creds.update', saveCreds)

  if (mode === 'qr') {
    sock.ev.once('connection.update', async (update) => {
      const { qr, connection, lastDisconnect } = update

      if (qr) {
        const canvas = createCanvas(300, 300)
        await QRCode.toCanvas(canvas, qr)
        const qrImage = canvas.toDataURL()
        return res.status(200).json({ success: true, session: sessionId, qr: qrImage })
      }

      if (connection === 'open') {
        console.log(`✅ QR connected: ${sessionId}`)
      }

      if (connection === 'close') {
        const reason = new Boom(lastDisconnect?.error)?.output?.statusCode
        console.log(`❌ QR Disconnected: ${reason}`)
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

// ✅ Required for Render/Vercel
const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`✅ DAVE-XMD Pairing Backend running on port ${PORT}`)
})
