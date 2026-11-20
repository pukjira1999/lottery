const places = ['แสน', 'หมื่น', 'พัน', 'ร้อย', 'สิบ', 'หน่วย'];
const state = { entries: [], round: null, history: [], winner: null, sound: false };
const byId = (id) => document.getElementById(id);
const track = byId('digit-track');
const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const revealed = () => state.round?.revealed || '';
function renderDigits() {
  const sequence = revealed();
  track.innerHTML = places.map((place, index) => {
    const revealIndex = 5 - index;
    const isShown = sequence.length > revealIndex;
    return `<div class="digit-cell ${isShown ? 'is-drawn' : ''} ${state.round?.status === 'complete' ? 'is-complete' : ''}"><span class="digit-place">${place}</span><strong class="digit-value">${isShown ? sequence[revealIndex] : '·'}</strong></div>`;
  }).join('');
  byId('round-number').textContent = state.round?.id ? `#${String(state.round.id).padStart(3, '0')}` : '—';
  byId('draw-progress').textContent = state.round?.status === 'complete' ? 'ผลครบ 6 หลัก' : sequence.length ? `เปิดแล้ว ${sequence.length} จาก 6 หลัก` : 'รอเริ่มหมุน';
  byId('draw-state-label').textContent = state.round?.status === 'complete' ? 'จบรอบแล้ว' : sequence.length ? 'กำลังจับรางวัล' : 'รอเริ่มหมุน';
  const winner = byId('winner-panel');
  if (state.round?.status === 'complete' && state.winner) {
    winner.hidden = false;
    winner.innerHTML = `<h3>ผู้ชนะรอบนี้</h3><p><strong>${esc(state.winner.name)}</strong> · ${esc(state.winner.number)} <span>ห่างจากผล ${esc(state.winner.difference)} เลข</span></p>`;
  } else if (state.round?.status === 'complete') {
    winner.hidden = false;
    winner.innerHTML = '<h3>รอบนี้ไม่มีรายการเลขที่ถูกต้อง</h3>';
  } else winner.hidden = true;
}
function renderHistory() {
  byId('history-count').textContent = String(state.history.length);
  byId('history-empty').hidden = state.history.length > 0;
  byId('history-body').innerHTML = state.history.map((round) => `<tr><td>#${String(round.id).padStart(3, '0')}</td><td class="numeric-value">${esc(round.result)}</td><td>${round.completed_at ? new Intl.DateTimeFormat('th-TH', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(round.completed_at)) : '—'}</td></tr>`).join('');
}
function setSnapshot(snapshot) {
  state.round = snapshot.currentRound;
  state.history = snapshot.history || [];
  state.winner = snapshot.winner;
  renderDigits(); renderHistory();
  if (state.lastSearch) renderSearch(state.lastSearch);
}
function matchTicket(number) {
  const seq = revealed();
  return [...number].map((digit, index) => {
    const revealIndex = 5 - index;
    const open = seq.length > revealIndex;
    const matched = open && digit === seq[revealIndex];
    return `<span class="${matched ? 'is-match' : ''}">${esc(digit)}</span>`;
  }).join('');
}
function renderSearch(result) {
  const results = byId('search-results');
  if (!result.entries.length) {
    byId('search-feedback').textContent = `ไม่พบชื่อที่มีคำว่า “${result.name}”`;
    results.innerHTML = `<div class="search-no-results"><strong>ยังไม่พบ “${esc(result.name)}”</strong><span>ลองพิมพ์ชื่อบางส่วนอีกครั้ง</span></div>`;
    return;
  }
  byId('search-feedback').textContent = `พบ ${result.entries.length} รายการที่ตรงกับ “${result.name}”`;
  results.innerHTML = `<div class="search-result-heading"><h2>รายการที่พบ</h2><span>${result.entries.length} รายการ</span></div>${result.entries.map((entry) => `<div class="result-ticket-row ${entry.valid ? '' : 'is-invalid'}"><div><div class="result-owner">${esc(entry.name || 'ไม่ระบุชื่อ')}</div><span class="ticket-number">${matchTicket(entry.number)}</span>${entry.valid ? '' : `<p class="invalid-reason">เลขนี้ไม่เข้าร่วมจับรางวัล · ${esc(entry.invalid_reason || 'ข้อมูลไม่ถูกต้อง')}</p>`}</div><span class="result-match-score">${revealed().length ? `${revealed().length}/6 หลักเปิดแล้ว` : 'รอผลหมุน'}</span></div>`).join('')}`;
}
async function search(event) {
  event.preventDefault();
  const name = byId('search-name').value.trim();
  if (!name) return;
  const button = event.submitter;
  if (button) button.disabled = true;
  byId('search-feedback').textContent = 'กำลังค้นหา';
  try {
    const response = await fetch(`/api/search?name=${encodeURIComponent(name)}`);
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'ค้นหาไม่สำเร็จ');
    state.lastSearch = payload;
    renderSearch(payload);
  } catch (error) { byId('search-feedback').textContent = error.message; }
  finally { if (button) button.disabled = false; }
}
function sayDigit(event) {
  if (!state.sound || !('speechSynthesis' in window)) return;
  const seq = revealed();
  if (!seq.length) return;
  const index = seq.length - 1;
  const utterance = new SpeechSynthesisUtterance(`หลัก${places[5 - index]} ${seq[index]}`);
  utterance.lang = 'th-TH';
  const thaiVoice = speechSynthesis.getVoices().find((voice) => voice.lang.toLowerCase().startsWith('th'));
  if (thaiVoice) utterance.voice = thaiVoice;
  speechSynthesis.cancel(); speechSynthesis.speak(utterance);
}
byId('search-form').addEventListener('submit', search);
byId('user-sound').addEventListener('click', () => {
  state.sound = !state.sound;
  byId('user-sound').textContent = `เสียง: ${state.sound ? 'เปิด' : 'ปิด'}`;
  byId('user-sound').setAttribute('aria-pressed', String(state.sound));
  if (!state.sound && 'speechSynthesis' in window) speechSynthesis.cancel();
});
const socket = window.io();
socket.on('connect', () => { byId('connection-state').dataset.state = 'connected'; byId('connection-label').textContent = 'อัปเดตสดแล้ว'; });
socket.on('disconnect', () => { byId('connection-state').dataset.state = 'disconnected'; byId('connection-label').textContent = 'กำลังเชื่อมต่อใหม่'; });
socket.on('lottery:snapshot', setSnapshot);
socket.on('lottery:number-revealed', sayDigit);
fetch('/api/state').then((response) => response.json()).then(setSnapshot).catch(() => { byId('draw-error').textContent = 'เชื่อมต่อเซิร์ฟเวอร์ไม่ได้'; byId('draw-error').hidden = false; });
