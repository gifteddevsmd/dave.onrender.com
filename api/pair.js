import express from 'express'
import cors from 'cors'
import { Boom } from '@hapi/boom'
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
} from '@whiskeysockets/baileys'
import NodeCache from 'node-cache'
import path from 'path'
import qrcode from 'qrcode-terminal'
import { fileURLToPath } from 'url'
import fs from 'fs'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const port = process.env.PORT || 10000

app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, '../public')))

const pairingCache = new NodeCache({ stdTTL: 300 })

app.post('/pair', async (req, res) => {
  const { number } = req.body
  if (!number) return res.status(400).json({ error: 'Number is required' })

  const sessionDir = `./sessions/${number}`
  const { state, saveCreds } = await useMultiFileAuthState(sessionDir)

  const sock = makeWASocket({
    version: await fetchLatestBaileysVersion(),
    auth: state,
    printQRInTerminal: true,
    browser: ['DAVE-XMD', 'Chrome', '1.0.0'],
  })

  sock.ev.on('connection.update', async (update) => {
    const { connection, qr, lastDisconnect } = update
    if (qr) {
      pairingCache.set(number, qr)
    }

    if (connection === 'open') {
      const sessionID = `davexmd~${number}`
      await sock.sendMessage(`${number}@s.whatsapp.net`, {
        text: `✅ *Your session is ready!*\n\n📦 *Session ID:* \n\`\`\`${sessionID}\`\`\``,
      })
      console.log(`[CONNECTED] ${number} => ${sessionID}`)
      sock.end()
    } else if (connection === 'close') {
      const reason = new Boom(lastDisconnect?.error)?.output?.statusCode
      if (reason !== DisconnectReason.loggedOut) {
        startBot(number)
      } else {
        console.log(`[LOGGED OUT] ${number}`)
      }
    }
  })

  sock.ev.on('creds.update', saveCreds)

  res.json({
    message: 'QR generated. Visit /qr?number=YOUR_NUMBER to view.',
    qrUrl: `/qr?number=${number}`
  })
})

// QR Viewer
app.get('/qr', (req, res) => {
  const number = req.query.number
  const qr = pairingCache.get(number)
  if (!qr) return res.send('❌ QR expired or not found.')
  res.send(`<pre>${qr}</pre>`)
})

app.listen(port, () => {
  console.log(`✅ QR pairing server is live on port ${port}`)
})
