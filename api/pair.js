import express from 'express'
import cors from 'cors'
import {
  makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import { existsSync, mkdirSync, readFileSync } from 'fs'
import { join, resolve } from 'path'
import QRCode from 'qrcode'
import Pino from 'pino'

const app = express()
app.use(cors())
app.use(express.json())
app.use(express.static('public')) // Serve frontend

const sessions = {}

app.post('/api/pair', async (req, res) => {
  const { phone, mode } = req.body

  if (!phone || !/^[0-9]{10,15}$/.test(phone)) {
    return res.status(400).json({ success: false, error: 'Invalid phone number format' })
  }

  const sessionId = `DAVE-XMD~${phone.slice(-4)}~${Math.random().toString(36).substring(2, 6)}`
  const sessionDir = join(process.cwd(), 'sessions', sessionId)
  if (!existsSync(sessionDir)) mkdirSync(sessionDir, { recursive: true })

  const { state, saveCreds } = await useMultiFileAuthState(sessionDir)
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
