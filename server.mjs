import crypto from 'node:crypto';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import express from 'express';
import { Server } from 'socket.io';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = readIntegerEnv('PORT', 3230, 1, 65535);
const HISTORY_LIMIT = readIntegerEnv('CHAT_HISTORY_LIMIT', 200, 1, 1000);
const MAX_CONNECTIONS = readIntegerEnv('MAX_CONNECTIONS', 300, 1, 10_000);
const DATA_DIR = path.resolve(process.env.DATA_DIR || path.join(__dirname, 'data'));
const MESSAGE_FILE = path.join(DATA_DIR, 'messages.json');

const NICKNAME_PATTERN = /^[0-9]{1,12}$/;
const MESSAGE_PATTERN = /^[0-9]{1,200}$/;

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  serveClient: true,
  maxHttpBufferSize: 16 * 1024,
  transports: ['websocket', 'polling'],
  cors: false,
});

app.disable('x-powered-by');

app.use((request, response, next) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'no-referrer');
  response.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  response.setHeader(
    'Content-Security-Policy',
    [
      "default-src 'self'",
      "script-src 'self'",
      "style-src 'self'",
      "img-src 'self' data:",
      "font-src 'self'",
      "connect-src 'self' ws: wss:",
      "object-src 'none'",
      "base-uri 'none'",
      "frame-ancestors 'none'",
      "form-action 'self'",
    ].join('; '),
  );
  next();
});

app.get('/health', (_request, response) => {
  response.json({
    ok: true,
    online: io.engine.clientsCount,
    storedMessages: messages.length,
  });
});

app.use(
  express.static(path.join(__dirname, 'public'), {
    extensions: ['html'],
    maxAge: '1h',
    etag: true,
  }),
);

let messages = [];
let saveQueue = Promise.resolve();

await mkdir(DATA_DIR, { recursive: true });
messages = await loadMessages();

io.use((socket, next) => {
  if (io.engine.clientsCount > MAX_CONNECTIONS) {
    next(new Error('현재 접속자가 너무 많습니다.'));
    return;
  }
  next();
});

io.on('connection', socket => {
  const sentAt = [];

  socket.emit('chat:history', messages);
  broadcastOnlineCount();

  socket.on('chat:send', async (payload, acknowledge) => {
    const reply = typeof acknowledge === 'function' ? acknowledge : () => {};

    const now = Date.now();
    while (sentAt.length && now - sentAt[0] >= 10_000) {
      sentAt.shift();
    }

    if ((sentAt.length && now - sentAt.at(-1) < 1000) || sentAt.length >= 5) {
      reply({
        ok: false,
        error: '메시지는 1초에 1개, 10초에 최대 5개까지 보낼 수 있습니다.',
      });
      return;
    }

    const nickname = String(payload?.nickname ?? '');
    const text = String(payload?.text ?? '');

    if (!NICKNAME_PATTERN.test(nickname)) {
      reply({ ok: false, error: '닉네임은 ASCII 숫자 1~12자리만 가능합니다.' });
      return;
    }

    if (!MESSAGE_PATTERN.test(text)) {
      reply({ ok: false, error: '메시지는 ASCII 숫자 1~200자리만 가능합니다.' });
      return;
    }

    sentAt.push(now);

    const message = {
      id: crypto.randomUUID(),
      nickname,
      text,
      createdAt: new Date(now).toISOString(),
    };

    messages.push(message);
    if (messages.length > HISTORY_LIMIT) {
      messages = messages.slice(-HISTORY_LIMIT);
    }

    try {
      await persistMessages();
    } catch (error) {
      console.error('[chat] 메시지 저장 실패:', error);
      reply({ ok: false, error: '메시지를 저장하지 못했습니다.' });
      return;
    }

    io.emit('chat:message', message);
    reply({ ok: true });
  });

  socket.on('disconnect', () => {
    broadcastOnlineCount();
  });
});

httpServer.listen(PORT, '127.0.0.1', () => {
  console.log(`[numeric-chat] http://127.0.0.1:${PORT}`);
  console.log(`[numeric-chat] history=${HISTORY_LIMIT}, data=${MESSAGE_FILE}`);
});

function broadcastOnlineCount() {
  io.emit('chat:online', { count: io.engine.clientsCount });
}

async function loadMessages() {
  try {
    const raw = await readFile(MESSAGE_FILE, 'utf8');
    const parsed = JSON.parse(raw);

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter(isStoredMessage).slice(-HISTORY_LIMIT);
  } catch (error) {
    if (error?.code !== 'ENOENT') {
      console.warn('[chat] 기존 메시지 파일을 읽지 못했습니다:', error);
    }
    return [];
  }
}

function isStoredMessage(value) {
  return (
    value &&
    typeof value.id === 'string' &&
    NICKNAME_PATTERN.test(String(value.nickname ?? '')) &&
    MESSAGE_PATTERN.test(String(value.text ?? '')) &&
    Number.isFinite(Date.parse(value.createdAt))
  );
}

function persistMessages() {
  const snapshot = JSON.stringify(messages, null, 2);
  const temporaryFile = `${MESSAGE_FILE}.tmp`;

  saveQueue = saveQueue.then(async () => {
    await writeFile(temporaryFile, snapshot, { encoding: 'utf8', mode: 0o600 });
    await rename(temporaryFile, MESSAGE_FILE);
  });

  return saveQueue;
}

function readIntegerEnv(name, fallback, minimum, maximum) {
  const raw = process.env[name];
  if (raw === undefined || raw === '') {
    return fallback;
  }

  const value = Number.parseInt(raw, 10);
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${name}은 ${minimum}~${maximum} 사이의 정수여야 합니다.`);
  }

  return value;
}
