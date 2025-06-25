import express from 'express'
import cors from 'cors'
import { Boom } from '@hapi/boom'
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  makeInMemoryStore,
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

const sessions = {}
const pairingCache = new NodeCache({ stdTTL: 300 })

// Helper to generate code like 'XDF A123'
function generateCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
  const digits = '0123456789'
  const code =
    chars[Math.floor(Math.random() * chars.length)] +
    chars[Math.floor(Math.random() * chars.length)] +
    chars[Math.floor(Math.random() * chars.length)] +
    ' ' +
    digits[Math.floor(Math.random() * 10)] +
    digits[Math.floor(Math.random() * 10)] +
    digits[Math.floor(Math.random() * 10)]
  return code
}

// POST /pair
app.post('/pair', async (req, res) => {
  const { number } = req.body
  if (!number) return res.status(400).json({ error: 'Number required' })

  const code = generateCode()
  pairingCache.set(code, number)

  res.json({
    code,
    message: 'Code generated. Open WhatsApp > Link device > enter code.',
  })

  console.log(`Code ${code} generated for ${number}`)
})

// Internal: simulate WhatsApp session creation
async function startBot(code, number) {
  const { state, saveCreds } = await useMultiFileAuthState(`./sessions/${code.replace(' ', '_')}`)

  const sock = makeWASocket({
    version: await fetchLatestBaileysVersion(),
    printQRInTerminal: false,
    auth: state,
    logger: undefined,
    generateHighQualityLinkPreview: true,
    markOnlineOnConnect: false,
    browser: ['Dave-Md-V1', 'Chrome', '1.0.0'],
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update
    const reason = new Boom(lastDisconnect?.error)?.output?.statusCode

    if (connection === 'open') {
      const sessionID = `gifteddave~${code.replace(' ', '_').toLowerCase()}`
      await sock.sendMessage(`${number}@s.whatsapp.net`, {
        text: `✅ Your session is ready!\n\n📦 *Session ID:* \n\`\`\`${sessionID}\`\`\`\n\nUse it to run the bot.`,
      })
      console.log(`✅ Session ready for ${number} - ID: ${sessionID}`)
      sock.end()
    } else if (connection === 'close') {
      if (reason !== DisconnectReason.loggedOut) {
        startBot(code, number)
      } else {
        console.log(`❌ Disconnected for ${number}`)
      }
    }
  })
}

// Optional GET /simulate to test pairing
app.get('/simulate/:code', async (req, res) => {
  const code = req.params.code
  const number = pairingCache.get(code)
  if (!number) return res.status(404).json({ error: 'Code expired or invalid' })

  await startBot(code, number)
  res.send('📦 Pairing started... you will receive your session ID shortly on WhatsApp.')
})

app.listen(port, () => {
  console.log(`✅ Pairing service running on port ${port}`)
})
