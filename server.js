import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';
import { createServer } from 'node:http';
import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import express from 'express';
import multer from 'multer';
import pg from 'pg';
import { Server } from 'socket.io';

const { Pool } = pg;
const root = path.dirname(fileURLToPath(import.meta.url));
const dataDirectory = process.env.DATA_DIR || path.join(root, 'data');
const sqlitePath = path.join(dataDirectory, 'lottery.sqlite');
const port = Number(process.env.PORT || 3491);
const host = process.env.HOST || '0.0.0.0';
const databaseUrl = process.env.DATABASE_URL;
const isProduction = process.env.NODE_ENV === 'production';
if (isProduction && !process.env.ADMIN_PASSWORD) throw new Error('ADMIN_PASSWORD is required in production.');
if (isProduction && !process.env.SESSION_SECRET) throw new Error('SESSION_SECRET is required in production.');
const adminPassword = process.env.ADMIN_PASSWORD || 'admin';
const sessionSecret = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('base64url');
if (!databaseUrl) throw new Error('DATABASE_URL is required to run Lottery Lucky Draw.');
if (!process.env.SESSION_SECRET) console.warn('SESSION_SECRET is unset; using an ephemeral secret. Set a long random value for deployment.');

const pool = new Pool({ connectionString: databaseUrl, max: 10 });
const sessions = new Map();
const loginAttempts = new Map();
const app = express();
app.set('trust proxy', 1);
const httpServer = createServer(app);
const io = new Server(httpServer);
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024, files: 1 } });

app.use(express.json({ limit: '64kb' }));
app.use(express.static(path.join(root, 'public')));
app.get('/admin', (_req, res) => res.sendFile(path.join(root, 'public', 'admin.html')));
app.get('/admin.js', (_req, res) => res.sendFile(path.join(root, 'public', 'admin.js')));

const schema = `
CREATE TABLE IF NOT EXISTS lottery_entries (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  number TEXT NOT NULL,
  valid BOOLEAN NOT NULL DEFAULT TRUE,
  invalid_reason TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (NOT valid OR number ~ '^[1-9]{6}$')
);
CREATE INDEX IF NOT EXISTS lottery_entries_name_idx ON lottery_entries (LOWER(name));
CREATE TABLE IF NOT EXISTS lottery_rounds (
  id BIGSERIAL PRIMARY KEY,
  revealed TEXT NOT NULL DEFAULT '',
  result TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL CHECK(status IN ('drawing', 'complete', 'abandoned')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS lottery_winners (
  round_id BIGINT PRIMARY KEY REFERENCES lottery_rounds(id) ON DELETE CASCADE,
  entry_id BIGINT REFERENCES lottery_entries(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  number TEXT NOT NULL,
  difference INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS lottery_spin_commands (
  command_id UUID PRIMARY KEY,
  round_id BIGINT NOT NULL REFERENCES lottery_rounds(id) ON DELETE CASCADE,
  response JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS import_previews (
  id UUID PRIMARY KEY,
  entries JSONB NOT NULL,
  summary JSONB NOT NULL,
  duplicate_numbers JSONB NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE TABLE IF NOT EXISTS app_migrations (name TEXT PRIMARY KEY, completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW());
`;

async function initialize() {
  await pool.query(schema);
  await migrateSqlite();
  const { rows } = await pool.query('SELECT id FROM lottery_rounds ORDER BY id DESC LIMIT 1');
  if (!rows.length) await pool.query("INSERT INTO lottery_rounds (status) VALUES ('drawing')");
}

async function migrateSqlite() {
  if (!fs.existsSync(sqlitePath)) return;
  const client = await pool.connect();
  let legacy;
  try {
    const oldDb = new DatabaseSync(sqlitePath, { readOnly: true });
    try {
      const tables = oldDb.prepare("SELECT name FROM sqlite_master WHERE type='table'").all().map((row) => row.name);
      legacy = {
        entries: tables.includes('entries') ? oldDb.prepare('SELECT id, name, number, created_at FROM entries ORDER BY id').all() : [],
        rounds: tables.includes('rounds') ? oldDb.prepare('SELECT id, result, status, created_at, completed_at FROM rounds ORDER BY id').all() : [],
      };
    } finally { oldDb.close(); }
  } catch (error) {
    console.warn(`SQLite migration skipped: ${error.message}`);
    return;
  }
  try {
    await client.query('BEGIN');
    const done = await client.query("SELECT 1 FROM app_migrations WHERE name='sqlite-import-v1'");
    if (done.rowCount) { await client.query('COMMIT'); return; }
    const existing = await client.query('SELECT (SELECT COUNT(*) FROM lottery_entries) + (SELECT COUNT(*) FROM lottery_rounds) AS count');
    if (Number(existing.rows[0].count) === 0) {
      for (const entry of legacy.entries) {
        const number = String(entry.number);
        const valid = /^[1-9]{6}$/.test(number);
        await client.query(
          `INSERT INTO lottery_entries (id, name, number, valid, invalid_reason, created_at)
           VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, NOW()))`,
          [entry.id, entry.name, number, valid, valid ? null : 'หมายเลขเดิมไม่ตรงรูปแบบ [1-9]{6}', entry.created_at],
        );
      }
      for (const round of legacy.rounds) {
        const partial = round.status === 'drawing';
        await client.query(
          `INSERT INTO lottery_rounds (id, revealed, result, status, created_at, completed_at)
           VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, NOW()), $6)`,
          [round.id, partial ? String(round.result || '') : '', round.status === 'complete' ? String(round.result || '') : '', partial ? 'abandoned' : round.status, round.created_at, round.completed_at],
        );
      }
      await client.query("SELECT setval(pg_get_serial_sequence('lottery_entries','id'), GREATEST(COALESCE((SELECT MAX(id) FROM lottery_entries), 1), 1), EXISTS(SELECT 1 FROM lottery_entries))");
      await client.query("SELECT setval(pg_get_serial_sequence('lottery_rounds','id'), GREATEST(COALESCE((SELECT MAX(id) FROM lottery_rounds), 1), 1), EXISTS(SELECT 1 FROM lottery_rounds))");
      if (legacy.rounds.some((round) => round.status === 'drawing')) {
        await client.query("INSERT INTO lottery_rounds (status) VALUES ('drawing')");
      }
    }
    await client.query("INSERT INTO app_migrations (name) VALUES ('sqlite-import-v1') ON CONFLICT DO NOTHING");
    await client.query('COMMIT');
    console.info(`SQLite migration complete: ${legacy.entries.length} entries, ${legacy.rounds.length} rounds.`);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally { client.release(); }
}

function readSession(req) {
  const token = req.cookies?.lottery_session;
  if (!token) return null;
  const [id, signature] = token.split('.');
  if (!id || !signature) return null;
  const expected = crypto.createHmac('sha256', sessionSecret).update(id).digest('base64url');
  const a = Buffer.from(signature); const b = Buffer.from(expected);
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  const expiry = sessions.get(id);
  if (!expiry || expiry < Date.now()) { sessions.delete(id); return null; }
  return id;
}

app.use((req, _res, next) => {
  const cookies = Object.fromEntries(String(req.headers.cookie || '').split(';').map((part) => {
    const index = part.indexOf('=');
    return index < 0 ? ['', ''] : [part.slice(0, index).trim(), decodeURIComponent(part.slice(index + 1).trim())];
  }).filter(([key]) => key));
  req.cookies = cookies;
  req.sessionId = readSession(req);
  next();
});

function requireAdmin(req, res, next) {
  if (!req.sessionId) return res.status(401).json({ error: 'กรุณาเข้าสู่ระบบผู้ดูแลก่อน' });
  next();
}

app.post('/api/auth/login', (req, res) => {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const attempt = loginAttempts.get(ip) || { count: 0, until: 0 };
  if (attempt.until > Date.now() && attempt.count >= 5) return res.status(429).json({ error: 'ลองรหัสผ่านมากเกินไป กรุณารอสักครู่แล้วลองใหม่' });
  const supplied = crypto.createHash('sha256').update(String(req.body?.password || '')).digest();
  const expectedPassword = crypto.createHash('sha256').update(adminPassword).digest();
  if (!crypto.timingSafeEqual(supplied, expectedPassword)) {
    attempt.count += 1;
    if (attempt.count >= 5) attempt.until = Date.now() + 15 * 60 * 1000;
    loginAttempts.set(ip, attempt);
    return res.status(401).json({ error: 'รหัสผ่านไม่ถูกต้อง' });
  }
  loginAttempts.delete(ip);
  const id = crypto.randomBytes(32).toString('base64url');
  sessions.set(id, Date.now() + 12 * 60 * 60 * 1000);
  const signature = crypto.createHmac('sha256', sessionSecret).update(id).digest('base64url');
  res.setHeader('Set-Cookie', `lottery_session=${id}.${signature}; Path=/; HttpOnly; SameSite=Strict; Max-Age=43200${req.secure ? '; Secure' : ''}`);
  res.json({ authenticated: true });
});
app.post('/api/auth/logout', (req, res) => {
  if (req.sessionId) {
    sessions.delete(req.sessionId);
    io.in(`session:${req.sessionId}`).disconnectSockets(true);
  }
  res.setHeader('Set-Cookie', 'lottery_session=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0');
  res.json({ authenticated: false });
});
app.get('/api/auth/session', (req, res) => res.json({ authenticated: Boolean(req.sessionId) }));

async function snapshot(includeEntries = false) {
  const [entries, current, history, winner] = await Promise.all([
    includeEntries ? pool.query('SELECT id, name, number, valid, invalid_reason FROM lottery_entries ORDER BY id') : Promise.resolve({ rows: [] }),
    pool.query('SELECT id, revealed, result, status, created_at, completed_at FROM lottery_rounds ORDER BY id DESC LIMIT 1'),
    pool.query("SELECT id, result, status, created_at, completed_at FROM lottery_rounds WHERE status='complete' ORDER BY id DESC LIMIT 100"),
    pool.query('SELECT w.entry_id, w.name, w.number, w.difference FROM lottery_winners w JOIN lottery_rounds r ON r.id=w.round_id ORDER BY r.id DESC LIMIT 1'),
  ]);
  return { entries: includeEntries ? entries.rows : [], currentRound: current.rows[0] || null, history: history.rows, winner: winner.rows[0] || null };
}

async function publish(eventName, data = {}) {
  io.emit('lottery:snapshot', await snapshot(false));
  io.to('admins').emit('admin:snapshot', await snapshot(true));
  io.emit(eventName, { ...data });
}

app.get('/api/state', async (_req, res, next) => {
  try {
    const state = await snapshot();
    res.json({ ...state, entries: [] });
  } catch (error) { next(error); }
});
app.get('/api/admin/state', requireAdmin, async (_req, res, next) => {
  try { res.json(await snapshot(true)); } catch (error) { next(error); }
});
app.get('/api/search', async (req, res, next) => {
  try {
    const name = String(req.query.name || '').trim();
    if (!name) return res.json({ name: '', entries: [] });
    const result = await pool.query(
      "SELECT id, name, number, valid, invalid_reason FROM lottery_entries WHERE name ILIKE $1 ORDER BY id",
      [`%${name.replace(/[\\%_]/g, '\\$&')}%`],
    );
    res.json({ name, entries: result.rows });
  } catch (error) { next(error); }
});

const NAME_HEADERS = new Set(['name', 'ชื่อ', 'ผู้เขียน', 'ชื่อผู้ซื้อ', 'ผู้ซื้อ', 'ผู้ถือ']);
const NUMBER_HEADERS = new Set(['number', 'lottery number', 'lottery_number', 'lottery', 'เลข', 'เลขสลาก', 'เลขล็อตเตอรี่', 'เลขลอตเตอรี่', 'เนื้อหา']);
function headerKey(value) { return String(value ?? '').trim().toLocaleLowerCase().replace(/\s+/g, ' '); }
function getValue(value) {
  if (value == null) return '';
  if (typeof value === 'object' && 'text' in value) return String(value.text || '').trim();
  return String(value).trim();
}
function normalizeNumber(value, formatted = '') {
  if (typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= 999999) {
    return /^\d{6}$/.test(formatted) ? formatted : String(value).padStart(6, '0');
  }
  return getValue(value);
}
async function parseWorkbook(buffer, extension) {
  const rows = [];
  if (extension === '.xlsx') {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    const sheet = workbook.worksheets[0];
    if (!sheet) throw new Error('ไม่พบชีตในไฟล์ Excel');
    for (let r = 1; r <= sheet.rowCount; r += 1) rows.push(Array.from({ length: sheet.columnCount }, (_, c) => {
      const cell = sheet.getRow(r).getCell(c + 1);
      return { value: cell.value, text: String(cell.text || '').trim() };
    }));
  } else {
    const book = XLSX.read(buffer, { type: 'buffer', cellDates: false });
    const sheet = book.Sheets[book.SheetNames[0]];
    if (!sheet) throw new Error('ไม่พบชีตในไฟล์ Excel');
    rows.push(...XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' }));
  }
  const headerIndex = rows.findIndex((row) => row.some((cell) => getValue(cell?.value ?? cell)));
  if (headerIndex < 0) throw new Error('ไฟล์ไม่มีข้อมูล');
  const headers = rows[headerIndex].map((cell) => headerKey(cell?.text ?? cell));
  const nameIndex = headers.findIndex((name) => NAME_HEADERS.has(name));
  const numberIndex = headers.findIndex((name) => NUMBER_HEADERS.has(name));
  if (nameIndex < 0 || numberIndex < 0) throw new Error('ต้องมีหัวคอลัมน์ชื่อและเลขสลาก');
  const entries = [];
  for (let index = headerIndex + 1; index < rows.length; index += 1) {
    const row = rows[index];
    const name = getValue(row[nameIndex]?.value ?? row[nameIndex]);
    const number = normalizeNumber(row[numberIndex]?.value ?? row[numberIndex], row[numberIndex]?.text || '');
    if (!name && !number) continue;
    const reasons = [];
    if (!name) reasons.push('ไม่มีชื่อ');
    if (!/^[1-9]{6}$/.test(number)) reasons.push('เลขต้องตรงรูปแบบ [1-9]{6}');
    entries.push({ name, number, valid: reasons.length === 0, invalid_reason: reasons.join(' · '), source_row: index + 1 });
  }
  if (!entries.length) throw new Error('ไม่พบแถวข้อมูลชื่อและเลขสลาก');
  const numberCounts = new Map();
  for (const entry of entries) if (entry.number) numberCounts.set(entry.number, (numberCounts.get(entry.number) || 0) + 1);
  const duplicates = [...numberCounts].filter(([, count]) => count > 1).map(([number, count]) => ({ number, count }));
  return { entries, duplicates };
}

app.post('/api/import/preview', requireAdmin, upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'กรุณาเลือกไฟล์ Excel' });
    const extension = path.extname(req.file.originalname).toLowerCase();
    if (!['.xls', '.xlsx'].includes(extension)) return res.status(400).json({ error: 'รองรับไฟล์ .xls และ .xlsx' });
    const { entries, duplicates } = await parseWorkbook(req.file.buffer, extension);
    const id = crypto.randomUUID();
    const validCount = entries.filter((entry) => entry.valid).length;
    const summary = { total: entries.length, valid: validCount, invalid: entries.length - validCount };
    await pool.query('INSERT INTO import_previews (id, entries, summary, duplicate_numbers, expires_at) VALUES ($1, $2, $3, $4, NOW() + INTERVAL \'30 minutes\')', [id, JSON.stringify(entries), summary, JSON.stringify(duplicates)]);
    res.json({ previewId: id, summary, duplicateNumbers: duplicates, entries });
  } catch (error) { next(error); }
});
app.post('/api/import/confirm', requireAdmin, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { previewId, mode, acknowledgeDuplicates } = req.body || {};
    if (!['append', 'replace'].includes(mode)) return res.status(400).json({ error: 'กรุณาเลือกโหมดนำเข้า' });
    await client.query('BEGIN');
    const previewResult = await client.query('SELECT * FROM import_previews WHERE id=$1 AND expires_at > NOW() FOR UPDATE', [previewId]);
    if (!previewResult.rowCount) { await client.query('ROLLBACK'); return res.status(410).json({ error: 'ตัวอย่างข้อมูลหมดอายุ กรุณาเลือกไฟล์ใหม่' }); }
    const preview = previewResult.rows[0];
    const duplicateNumbers = preview.duplicate_numbers;
    if (duplicateNumbers.length && acknowledgeDuplicates !== true) { await client.query('ROLLBACK'); return res.status(409).json({ error: 'กรุณารับทราบคำเตือนเลขซ้ำก่อนยืนยัน' }); }
    if (mode === 'replace') await client.query('DELETE FROM lottery_entries');
    for (const entry of preview.entries) {
      const number = String(entry.number || '');
      const reason = entry.invalid_reason || (!entry.valid ? `เลขต้นทางไม่ถูกต้อง: ${number}` : null);
      await client.query('INSERT INTO lottery_entries (name, number, valid, invalid_reason) VALUES ($1, $2, $3, $4)', [entry.name, number, entry.valid, reason]);
    }
    await client.query('DELETE FROM import_previews WHERE id=$1', [previewId]);
    await client.query('COMMIT');
    await publish('lottery:imported', { count: preview.entries.length, mode });
    res.json({ imported: preview.entries.length, mode, summary: preview.summary });
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); next(error); }
  finally { client.release(); }
});

app.post('/api/admin/draw/spin', requireAdmin, async (req, res, next) => {
  const client = await pool.connect();
  try {
    const commandId = String(req.body?.commandId || '');
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(commandId)) {
      return res.status(400).json({ error: 'คำสั่งหมุนไม่มีรหัสคำสั่งที่ถูกต้อง' });
    }
    await client.query('BEGIN');
    const current = await client.query('SELECT * FROM lottery_rounds ORDER BY id DESC LIMIT 1 FOR UPDATE');
    const previousCommand = await client.query('SELECT response FROM lottery_spin_commands WHERE command_id=$1', [commandId]);
    if (previousCommand.rowCount) { await client.query('COMMIT'); return res.json(previousCommand.rows[0].response); }
    const round = current.rows[0];
    if (!round || round.status !== 'drawing' || round.revealed.length >= 6) {
      await client.query('ROLLBACK'); return res.status(409).json({ error: 'รอบนี้หมุนต่อไม่ได้ กรุณาเริ่มรอบใหม่' });
    }
    const hasValidEntries = await client.query('SELECT EXISTS(SELECT 1 FROM lottery_entries WHERE valid=TRUE) AS available');
    if (!hasValidEntries.rows[0].available) {
      await client.query('ROLLBACK'); return res.status(409).json({ error: 'เพิ่มรายการเลขที่ถูกต้องก่อนเริ่มจับรางวัล' });
    }
    const digit = String(crypto.randomInt(1, 10));
    const revealed = `${round.revealed}${digit}`;
    const complete = revealed.length === 6;
    const result = complete ? [...revealed].reverse().join('') : '';
    await client.query('UPDATE lottery_rounds SET revealed=$1, result=$2, status=$3, completed_at=CASE WHEN $4 THEN NOW() ELSE completed_at END WHERE id=$5', [revealed, result, complete ? 'complete' : 'drawing', complete, round.id]);
    let winner = null;
    if (complete) {
      const selected = await client.query(`SELECT id, name, number, ABS(number::integer - $1::integer) AS difference FROM lottery_entries WHERE valid=TRUE ORDER BY ABS(number::integer - $1::integer), id LIMIT 1`, [result]);
      if (selected.rowCount) {
        winner = selected.rows[0];
        await client.query('INSERT INTO lottery_winners (round_id, entry_id, name, number, difference) VALUES ($1,$2,$3,$4,$5)', [round.id, winner.id, winner.name, winner.number, winner.difference]);
      }
    }
    const response = { digit, revealed, result, complete, winner };
    await client.query('INSERT INTO lottery_spin_commands (command_id, round_id, response) VALUES ($1,$2,$3)', [commandId, round.id, response]);
    await client.query('COMMIT');
    await publish('lottery:spinning', { digit, revealed, result, winner });
    io.emit('lottery:number-revealed', { digit, revealed, result, index: revealed.length - 1 });
    if (complete) io.emit('lottery:draw-completed', { digit, revealed, result, winner });
    if (complete && winner) io.emit('lottery:winner-announced', { winner });
    res.json(response);
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); next(error); }
  finally { client.release(); }
});
app.post('/api/admin/draw/new', requireAdmin, async (_req, res, next) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const current = await client.query('SELECT * FROM lottery_rounds ORDER BY id DESC LIMIT 1 FOR UPDATE');
    if (current.rows[0]?.status === 'drawing') await client.query("UPDATE lottery_rounds SET status='abandoned', completed_at=NOW() WHERE id=$1", [current.rows[0].id]);
    const created = await client.query("INSERT INTO lottery_rounds (status) VALUES ('drawing') RETURNING id");
    await client.query('COMMIT');
    await publish('lottery:draw-started', { id: created.rows[0].id });
    io.emit('lottery:reset', { id: created.rows[0].id });
    res.status(201).json({ id: created.rows[0].id });
  } catch (error) { await client.query('ROLLBACK').catch(() => {}); next(error); }
  finally { client.release(); }
});
app.get('/api/draw/history', async (_req, res, next) => {
  try { const rows = await pool.query("SELECT id,result,status,created_at,completed_at FROM lottery_rounds ORDER BY id DESC LIMIT 100"); res.json(rows.rows); }
  catch (error) { next(error); }
});

io.use((socket, next) => {
  const fakeReq = { headers: { cookie: socket.handshake.headers.cookie || '' }, socket: socket.request.socket };
  const cookies = Object.fromEntries(String(fakeReq.headers.cookie).split(';').map((part) => { const idx = part.indexOf('='); return idx < 0 ? ['', ''] : [part.slice(0, idx).trim(), decodeURIComponent(part.slice(idx + 1).trim())]; }));
  fakeReq.cookies = cookies;
  const sessionId = readSession(fakeReq);
  if (sessionId) { socket.data.isAdmin = true; socket.data.sessionId = sessionId; }
  next();
});
io.on('connection', async (socket) => {
  socket.emit('lottery:snapshot', await snapshot(false));
  if (socket.data.isAdmin) {
    const expiryTimer = setTimeout(() => socket.disconnect(true), Math.max(0, (sessions.get(socket.data.sessionId) || Date.now()) - Date.now()));
    expiryTimer.unref();
    socket.join('admins');
    socket.join(`session:${socket.data.sessionId}`);
    socket.emit('admin:snapshot', await snapshot(true));
  }
});

app.use((error, _req, res, _next) => {
  const status = error instanceof multer.MulterError ? 400 : 500;
  if (status === 500) console.error(error);
  res.status(status).json({ error: status === 400 ? error.message : 'เกิดข้อผิดพลาดในเซิร์ฟเวอร์' });
});

initialize().then(() => httpServer.listen(port, host, () => console.info(`Lottery server listening on ${host}:${port}`))).catch((error) => {
  console.error('Database initialization failed:', error);
  process.exitCode = 1;
  httpServer.close();
});
