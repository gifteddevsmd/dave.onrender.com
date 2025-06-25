import fs from 'fs'
import path from 'path'

const SESSIONS_DIR = path.join(process.cwd(), 'sessions')

if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true })
}

export function generateSessionId(phone, code) {
  return `gifteddave~${code.replace(/\s+/g, '').toLowerCase()}`
}

export function saveSession(id, data) {
  const dir = path.join(SESSIONS_DIR, id)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(path.join(dir, 'creds.json'), JSON.stringify(data, null, 2))
}

export function loadSession(id) {
  const file = path.join(SESSIONS_DIR, id, 'creds.json')
  if (!fs.existsSync(file)) return null
  return JSON.parse(fs.readFileSync(file))
}
