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
import { fileURLToPath } from 'url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const port = process.env.PORT || 10000

app.use(cors())
app.use(express.json())
app.use(express.static(path.join(__dirname, '../public')))

const pairingCache = new NodeCache({ stdTTL: 300 })

function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const digits = '0123456789'
  return (
    chars[Math.floor(Math.random() * chars.length)] +
    chars[Math.floor(Math.random() * chars.length)] +
    chars[Math.floor(Math.random() * chars.length)] +
    ' ' +
    digits[Math.floor(Math.random() * 10)] +
    digits[Math.floor(Math.random() * 10)] +
    digits[Math.floor(Math.random() * 10)]
  )
}

app.post('/pair', async (req, res) => {
  const { number } = req.body
  if (!number) return res.status(400).json({ error: 'Number required' })

  const code = generateCode()
  pairingCache.set(code, number)

  res.json({
    code,
    message: 'Code generated. Link device in WhatsApp using the code.'
  })

  console.log(`[PAIRING] Code: ${code} for number: ${number}`)
})

async function startBot(code, number) {
  const folder = `./sessions/${code.replace(' ', '_')}`
  const { state, saveCreds } = await useMultiFileAuthState(folder)

  const sock = makeWASocket({
    version: await fetchLatestBaileysVersion(),
    printQRInTerminal: false,
    auth: state,
    browser: ['DAVE-XMD', 'Chrome', '1.0.0']
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async ({ connection, lastDisconnect }) => {
    const reason = new Boom(lastDisconnect?.error)?.output?.statusCode

    if (connection === 'open') {
      const sessionID = `davexmd~${code.replace(' ', '_').toLowerCase()}`
      await sock.sendMessage(`${number}@s.whatsapp.net`, {
        text: `✅ *Your session is ready!\n\nSession ID:* \n\n\`\`\`${sessionID}\\`\``
      })
      console.log(`[SUCCESS] Session for ${number}: ${sessionID}`)
      sock.end()
    } else if (connection === 'close') {
      if (reason !== DisconnectReason.loggedOut) {
        startBot(code, number)
      } else {
        console.log(`[DISCONNECTED] ${number}`)
      }
    }
  })
}

app.get('/simulate/:code', async (req, res) => {
  const code = req.params.code
  const number = pairingCache.get(code)
  if (!number) return res.status(404).send('Code expired or invalid')

  await startBot(code, number)
  res.send('📦 Pairing started. You will get your session on WhatsApp.')
})

app.listen(port, () => {
  console.log(`✅ Pairing service live on port ${port}`)
})
