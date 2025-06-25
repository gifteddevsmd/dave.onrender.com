import express from 'express'
import crypto from 'crypto'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json())

const sessions = {} // phone => { code, expires }

function generateSessionId() {
  const random = crypto.randomBytes(3).toString('hex') // e.g., a1b2c3
  return `gifteddave~${random}`
}

app.post('/pair', (req, res) => {
  const { number } = req.body
  if (!number || !/^\d+$/.test(number)) {
    return res.status(400).json({ error: 'Invalid phone number' })
  }

  const sessionId = generateSessionId()

  sessions[number] = {
    code: sessionId,
    expires: Date.now() + 10 * 60 * 1000 // 10 mins
  }

  const link = `https://wa.me/${number}?text=PAIR%20${encodeURIComponent(sessionId)}`
  return res.json({
    message: 'Send this message to WhatsApp to confirm pairing',
    sessionId,
    wa_link: link
  })
})

app.get('/', (req, res) => {
  res.send('✅ Pairing service is running. Use POST /pair to pair.')
})

// Port used by Render
const PORT = process.env.PORT || 10000
app.listen(PORT, () => console.log(`✅ Pairing server live on port ${PORT}`))

export { sessions } // so bot can import it and validate
