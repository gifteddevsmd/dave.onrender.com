import fs from "fs"
import path from "path"

const sessionFilePath = path.join(process.cwd(), "sessions.json")

// Load sessions.json or initialize
function loadSessions() {
  if (!fs.existsSync(sessionFilePath)) {
    fs.writeFileSync(sessionFilePath, JSON.stringify([]))
  }
  return JSON.parse(fs.readFileSync(sessionFilePath))
}

// Save sessions to disk
function saveSessions(sessions) {
  fs.writeFileSync(sessionFilePath, JSON.stringify(sessions, null, 2))
}

// Add a new pairing
export function addPair(number, code, sessionId) {
  const sessions = loadSessions()
  sessions.push({ number, code, sessionId, timestamp: Date.now() })
  saveSessions(sessions)
}

// Find by number
export function getSessionByNumber(number) {
  const sessions = loadSessions()
  return sessions.find((s) => s.number === number)
}

// Find by code
export function getSessionByCode(code) {
  const sessions = loadSessions()
  return sessions.find((s) => s.code === code)
}

// Optional: clean expired sessions (older than X minutes)
export function cleanupOldSessions(maxAgeMinutes = 30) {
  const sessions = loadSessions()
  const cutoff = Date.now() - maxAgeMinutes * 60000
  const updated = sessions.filter((s) => s.timestamp > cutoff)
  saveSessions(updated)
    }
