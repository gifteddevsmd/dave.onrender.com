// api/pair.js

import express from 'express'
import { Boom } from '@hapi/boom'
import makeWASocket, { useMultiFileAuthState, DisconnectReason } from '@whiskeysockets/baileys'
import pino from 'pino'
import { join } from 'path'
import { existsSync } from 'fs'

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())

app.post('/pair', async (req, res) => {
  const { phoneNumber } = req.body
  if (!phoneNumber) return res.status(400).json({ error: 'Phone number is required' })

  const sessionFolder = join('sessions', `session-${phoneNumber}`)
  const { state, saveCreds } = await useMultiFileAuthState(sessionFolder)

  const sock = makeWASocket({
    printQRInTerminal: true,
    auth: state,
    logger: pino({ level: 'silent' })
  })

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update
    if (connection === 'open') {
      await saveCreds()
      const sessionId = `davexmd~${phoneNumber}`
      return res.status(200).json({ status: 'paired', sessionId })
    } else if (
      connection === 'close' &&
      (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut)
    ) {
      sock.restart()
    }
  })

  sock.ev.on('creds.update', saveCreds)
})

app.listen(PORT, () => console.log(`✅ Pairing service running on http://localhost:${PORT}`))
