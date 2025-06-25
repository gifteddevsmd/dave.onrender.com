import makeWASocket, {
  useSingleFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion
} from '@whiskeysockets/baileys';

import { Boom } from '@hapi/boom';
import { existsSync, mkdirSync } from 'fs';
import P from 'pino';

const { state, saveState } = useSingleFileAuthState('./auth_info.json');

const startSock = async () => {
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    logger: P({ level: 'silent' }),
    printQRInTerminal: true,
    auth: state,
    version
  });

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      const shouldReconnect = (lastDisconnect?.error as Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) {
        startSock();
      }
    } else if (connection === 'open') {
      console.log('✅ Pairing server live on port 10000');
    }
  });

  sock.ev.on('creds.update', saveState);
};

startSock();
