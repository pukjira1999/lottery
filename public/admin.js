const $ = (id) => document.getElementById(id);
const places = ['แสน', 'หมื่น', 'พัน', 'ร้อย', 'สิบ', 'หน่วย'];
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
let previewId = null;
let duplicates = [];
let round = null;
let soundEnabled = false;
let lastRevealed = '';
const socket = window.io();

async function api(url, options = {}) {
  const response = await fetch(url, options);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error || 'ดำเนินการไม่สำเร็จ');
  return body;
}
function setFeedback(id, message, error = false) { $(id).textContent = message; $(id).classList.toggle('is-error', error); }
function showWorkspace(authenticated) {
  $('login-panel').hidden = authenticated;
  $('admin-workspace').hidden = !authenticated;
  $('logout-button').hidden = !authenticated;
  if (authenticated) { socket.disconnect().connect(); loadAdminState(); }
}
async function checkSession() {
  try { const data = await api('/api/auth/session'); showWorkspace(data.authenticated); }
  catch { showWorkspace(false); }
}
function renderState(data) {
  round = data.currentRound;
  const revealed = round?.revealed || '';
  $('round-number').textContent = round?.id ? `#${String(round.id).padStart(3, '0')}` : '—';
  $('draw-progress').textContent = round?.status === 'complete' ? 'ผลครบ 6 หลัก' : revealed ? `เปิดแล้ว ${revealed.length} จาก 6 หลัก` : 'รอเริ่มหมุน';
  $('draw-state-label').textContent = round?.status === 'complete' ? 'จบรอบแล้ว' : 'กำลังจับรางวัล';
  $('digit-track').innerHTML = places.map((place, index) => {
    const at = 5 - index;
    return `<div class="digit-cell ${revealed.length > at ? 'is-drawn' : ''} ${round?.status === 'complete' ? 'is-complete' : ''}"><span class="digit-place">${place}</span><strong class="digit-value">${revealed.length > at ? revealed[at] : '·'}</strong></div>`;
  }).join('');
  $('spin-button').disabled = !data.entries?.some((entry) => entry.valid) || round?.status === 'complete';
  $('spin-button').textContent = revealed.length === 6 ? 'หมุนครบแล้ว' : 'หมุนหลักถัดไป';
  if (round?.status === 'complete' && data.winner) $('winner-panel').innerHTML = `<h3>ผู้ชนะ</h3><p>${esc(data.winner.name)} · ${esc(data.winner.number)} · ต่าง ${esc(data.winner.difference)} เลข</p>`, $('winner-panel').hidden = false;
  else $('winner-panel').hidden = true;
  $('entry-count').textContent = String(data.entries?.length || 0);
  $('entries-body').innerHTML = (data.entries || []).map((entry) => `<tr><td>${esc(entry.name || 'ไม่ระบุชื่อ')}</td><td class="numeric-value">${esc(entry.number)}</td><td><span class="entry-status ${entry.valid ? 'is-valid' : 'is-invalid'}">${entry.valid ? 'เข้าร่วมจับรางวัล' : `Invalid · ${esc(entry.invalid_reason || '')}`}</span></td></tr>`).join('');
  if (revealed.length > lastRevealed.length && soundEnabled) speak(revealed);
  lastRevealed = revealed;
}
async function loadAdminState() {
  try { renderState(await api('/api/admin/state')); } catch (error) { $('draw-error').textContent = error.message; $('draw-error').hidden = false; }
}
function speak(revealed) {
  if (!('speechSynthesis' in window) || !revealed.length) return;
  const idx = revealed.length - 1;
  const utterance = new SpeechSynthesisUtterance(`หลัก${places[5 - idx]} ${revealed[idx]}`);
  utterance.lang = 'th-TH';
  const voice = speechSynthesis.getVoices().find((candidate) => candidate.lang.toLowerCase().startsWith('th'));
  if (voice) utterance.voice = voice;
  speechSynthesis.cancel(); speechSynthesis.speak(utterance);
}
function updateFile(file) { $('file-name').textContent = file?.name || 'เลือกหรือลากไฟล์ Excel มาวาง'; }
function displayPreview(data) {
  previewId = data.previewId;
  duplicates = data.duplicateNumbers || [];
  const { total, valid, invalid } = data.summary;
  $('preview-summary').innerHTML = `<span>ทั้งหมด <strong>${total}</strong></span><span>Valid <strong>${valid}</strong></span><span>Invalid <strong>${invalid}</strong></span>`;
  $('duplicate-warning').hidden = duplicates.length === 0;
  $('duplicate-warning').textContent = duplicates.length ? `พบเลขซ้ำ ${duplicates.length} หมายเลข: ${duplicates.map((item) => `${item.number} (${item.count} รายการ)`).join(' · ')}` : '';
  $('duplicate-ack-row').hidden = duplicates.length === 0;
  $('duplicate-ack').checked = false;
  $('preview-body').innerHTML = data.entries.map((entry) => `<tr class="${entry.valid ? '' : 'is-invalid'}"><td>${entry.source_row}</td><td>${esc(entry.name || 'ไม่ระบุชื่อ')}</td><td class="numeric-value">${esc(entry.number || '—')}</td><td>${entry.valid ? 'Valid' : `Invalid · ${esc(entry.invalid_reason)}`}</td></tr>`).join('');
  $('preview-panel').hidden = false;
}
async function previewFile(event) {
  event.preventDefault();
  const file = $('excel-file').files[0];
  if (!file) return setFeedback('import-feedback', 'เลือกไฟล์ .xls หรือ .xlsx ก่อน', true);
  const form = new FormData(); form.set('file', file);
  $('preview-button').disabled = true; $('preview-button').textContent = 'กำลังอ่านไฟล์…';
  try { displayPreview(await api('/api/import/preview', { method: 'POST', body: form })); setFeedback('import-feedback', 'ตรวจสอบตัวอย่างข้อมูล แล้วกดยืนยันเมื่อต้องการบันทึก'); }
  catch (error) { setFeedback('import-feedback', error.message, true); }
  finally { $('preview-button').disabled = false; $('preview-button').textContent = 'ดูตัวอย่างข้อมูล'; }
}
async function confirmImport() {
  if (!previewId) return;
  if (duplicates.length && !$('duplicate-ack').checked) return setFeedback('import-feedback', 'กรุณารับทราบคำเตือนเลขซ้ำก่อนยืนยัน', true);
  $('confirm-import').disabled = true;
  try {
    const mode = $('import-mode').value;
    const result = await api('/api/import/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ previewId, mode, acknowledgeDuplicates: $('duplicate-ack').checked }) });
    previewId = null; $('preview-panel').hidden = true; $('excel-file').value = ''; updateFile(null);
    setFeedback('import-feedback', `นำเข้าแล้ว ${result.imported} รายการ`); await loadAdminState();
  } catch (error) { setFeedback('import-feedback', error.message, true); }
  finally { $('confirm-import').disabled = false; }
}
async function login(event) {
  event.preventDefault();
  try { await api('/api/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('password').value }) }); $('password').value = ''; setFeedback('login-feedback', 'เข้าสู่ระบบแล้ว'); showWorkspace(true); }
  catch (error) { setFeedback('login-feedback', error.message, true); }
}
async function logout() {
  await api('/api/auth/logout', { method: 'POST' });
  socket.disconnect(); showWorkspace(false);
}
async function spin() {
  $('spin-button').disabled = true;
  try { await api('/api/admin/draw/spin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ commandId: crypto.randomUUID() }) }); await loadAdminState(); }
  catch (error) { $('draw-error').textContent = error.message; $('draw-error').hidden = false; await loadAdminState(); }
}
async function newRound() {
  if (round?.status === 'drawing' && round.revealed && !window.confirm('รอบนี้ยังหมุนไม่ครบ ต้องการปิดรอบและเริ่มรอบใหม่หรือไม่?')) return;
  try { await api('/api/admin/draw/new', { method: 'POST' }); await loadAdminState(); $('draw-error').hidden = true; }
  catch (error) { $('draw-error').textContent = error.message; $('draw-error').hidden = false; }
}
$('login-form').addEventListener('submit', login);
$('logout-button').addEventListener('click', logout);
$('upload-form').addEventListener('submit', previewFile);
$('confirm-import').addEventListener('click', confirmImport);
$('excel-file').addEventListener('change', (event) => { updateFile(event.target.files[0]); previewId = null; $('preview-panel').hidden = true; });
$('spin-button').addEventListener('click', spin);
$('new-round-button').addEventListener('click', newRound);
$('admin-sound').addEventListener('click', () => { soundEnabled = !soundEnabled; $('admin-sound').textContent = `เสียง: ${soundEnabled ? 'เปิด' : 'ปิด'}`; $('admin-sound').setAttribute('aria-pressed', String(soundEnabled)); if (!soundEnabled && 'speechSynthesis' in window) speechSynthesis.cancel(); });
$('file-drop').addEventListener('dragover', (event) => { event.preventDefault(); $('file-drop').classList.add('is-dragging'); });
$('file-drop').addEventListener('dragleave', () => $('file-drop').classList.remove('is-dragging'));
$('file-drop').addEventListener('drop', (event) => { event.preventDefault(); $('file-drop').classList.remove('is-dragging'); const file = event.dataTransfer.files[0]; if (file) { const transfer = new DataTransfer(); transfer.items.add(file); $('excel-file').files = transfer.files; updateFile(file); previewId = null; $('preview-panel').hidden = true; } });
socket.on('connect', () => { $('admin-connection').dataset.state = 'connected'; $('admin-connection-label').textContent = 'อัปเดตสดแล้ว'; });
socket.on('disconnect', () => { $('admin-connection').dataset.state = 'disconnected'; $('admin-connection-label').textContent = 'กำลังเชื่อมต่อใหม่'; });
socket.on('admin:snapshot', renderState);
checkSession();
