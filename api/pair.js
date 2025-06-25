import express from 'express'
import { Boom } from '@hapi/boom'
import { makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys'
import pino from 'pino'

const app = express()
const PORT = process.env.PORT || 10000

app.get('/', async (req, res) => {
  res.send('✅ Pairing service is running. Use POST /pair to pair.')
})

// Dummy pairing route for now (you can extend this with phone+code logic later)
app.get('/pair', async (req, res) => {
  const { state, saveCreds } = await useMultiFileAuthState('./session')
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    logger: pino({ level: 'silent' }),
    printQRInTerminal: true,
    auth: state,
    browser: ['Dave-Md-V1', 'Safari', '1.0.0']
  })

  sock.ev.on('connection.update', ({ connection, lastDisconnect }) => {
    if (connection === 'close') {
      const reasonCode = lastDisconnect?.error?.output?.statusCode
      const shouldReconnect = reasonCode !== DisconnectReason.loggedOut
      console.log('Connection closed. Should reconnect:', shouldReconnect)
      if (shouldReconnect) {
        // auto-restart logic
        res.send('⚠️ Connection closed. Reconnecting...')
      } else {
        res.send('❌ Disconnected. Please re-pair.')
      }
    } else if (connection === 'open') {
      res.send('✅ Paired successfully! Session saved.')
    }
  })

  sock.ev.on('creds.update', saveCreds)
})

app.listen(PORT, () => {
  console.log(`✅ Pairing server live on port ${PORT}`)
})
