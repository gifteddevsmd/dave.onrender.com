import express from 'express'
import { Boom } from '@hapi/boom'
import makeWASocket, { useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } from '@whiskeysockets/baileys'
import qrcode from 'qrcode'
import fs from 'fs'

const app = express()
const PORT = process.env.PORT || 3000

app.get('/', async (req, res) => {
  const { state, saveCreds } = await useMultiFileAuthState(`./session`)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: false,
    generateHighQualityLinkPreview: true
  })

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update
    if (qr) {
      const qrImage = await qrcode.toDataURL(qr)
      res.send(`<img src="${qrImage}" />`)
    }

    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut)
      if (shouldReconnect) sock.ws.close()
    }
  })

  sock.ev.on('creds.update', saveCreds)
})

app.listen(PORT, () => {
  console.log(`Pairing server live on port ${PORT}`)
})
