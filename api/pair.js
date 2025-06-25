import express from 'express'
import cors from 'cors'
import { addPair } from './session.js'
import crypto from 'crypto'

// Setup
const app = express()
const PORT = process.env.PORT || 10000
app.use(cors())
app.use(express.json())

// Random session ID + code generator
function generateCode() {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'
  const digits = '0123456789'
  const l = letters[Math.floor(Math.random() * letters.length)]
  const d1 = digits[Math.floor(Math.random() * digits.length)]
  const d2 = digits[Math.floor(Math.random() * digits.length)]
  const d3 = digits[Math.floor(Math.random() * digits.length)]
  return `${l}${d1}${d2} ${d3}`
}

function generateSessionId(number) {
  const hash = crypto.createHash('sha1').update(number + Date.now()).digest('hex')
  return `gifteddave~${hash.slice(0, 10)}`
}

// Routes
app.get('/', (req, res) => {
  res.send('✅ Pairing service is running. Use POST /pair to pair.')
})

app.post('/pair', (req, res) => {
  const { number } = req.body

  if (!number || typeof number !== 'string') {
    return res.status(400).json({ error: 'Invalid number provided' })
  }

  const code = generateCode()
  const sessionId = generateSessionId(number)

  // Save to sessions.json
  addPair(number, code, sessionId)

  // Send session ID or response (you can replace this logic)
  res.json({
    status: true,
    number,
    code,
    sessionId,
    message: `🔐 Your pairing code is: ${code}\n✅ Link this code on WhatsApp.\nSession will be sent after linking.`
  })
})

// Start
app.listen(PORT, () => {
  console.log(`✅ Pairing service is live on port ${PORT}`)
})
