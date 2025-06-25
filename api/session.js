// api/session.js

import fs from 'fs';
import path from 'path';

export default async function handler(req, res) {
  const { id } = req.query;

  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid session ID.' });
  }

  const filePath = path.join(process.cwd(), 'sessions', `${id}.json`);

  try {
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Session not found.' });
    }

    const data = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(data);

    return res.status(200).json({ session: json });
  } catch (err) {
    console.error('Error reading session:', err);
    return res.status(500).json({ error: 'Failed to read session file.' });
  }
      }
