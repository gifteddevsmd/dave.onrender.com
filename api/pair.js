import express from "express"
import cors from "cors"
import fs from "fs"
import { randomBytes } from "crypto"

const app = express()
const port = process.env.PORT || 10000
app.use(cors())
app.use(express.json())

const sessions = {}

function generateCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
  const part = () => Array.from({ length: 3 }, () => chars[Math.floor(Math.random() * chars.length)]).join("")
  return `${part()} ${part()}`
}

function generateSessionID() {
  return `gifteddave~${randomBytes(3).toString("hex").toUpperCase()}`
}

app.get("/", (req, res) => {
  res.send("✅ Pairing service is running. Use POST /pair to pair.")
})

app.post("/pair", (req, res) => {
  const { number } = req.body
  if (!number || !/^\d{10,15}$/.test(number)) {
    return res.status(400).json({ error: "Invalid phone number format." })
  }

  const code = generateCode()
  const sessionId = generateSessionID()

  // Save pairing info (simulated)
  sessions[number] = { code, sessionId }

  console.log(`📲 Pairing for ${number}:`)
  console.log(`➡️ Code: ${code}`)
  console.log(`✅ Session: ${sessionId}`)

  // Simulate sending session via WhatsApp (later we automate)
  setTimeout(() => {
    console.log(`📤 Sent session ID ${sessionId} to WhatsApp number ${number}`)
  }, 5000)

  res.json({
    success: true,
    message: "Pairing started.",
    code,
    notice: "Use this code in WhatsApp bot to finish pairing."
  })
})

app.listen(port, () => {
  console.log(`✅ Server live at http://localhost:${port}`)
})
