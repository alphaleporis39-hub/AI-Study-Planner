'use strict';

/* ── Constants ──────────────────────────────────────────────── */
const API_BASE = '';
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const PRIORITY_LABELS = { '1': 'High', '2': 'Medium', '3': 'Low' };
const TIPS = [
  { title: 'Spaced Repetition', body: 'Review material at increasing intervals to move it into long-term memory.' },
  { title: 'Active Recall', body: 'Test yourself instead of re-reading. Close the book and write what you remember.' },
  { title: 'Pomodoro Technique', body: 'Work in focused 25-minute sprints with 5-minute breaks to maintain concentration.' },
  { title: 'Feynman Technique', body: 'Explain a concept in simple words as if teaching a child to expose gaps in understanding.' },
  { title: 'Interleaving', body: 'Mix different subjects in one session rather than blocking one topic for hours.' },
  { title: 'Sleep & Memory', body: 'Sleep consolidates memories. Aim for 7-9 hours, especially before exams.' },
  { title: 'Eliminate Distractions', body: 'Put your phone in another room. Even its presence reduces cognitive capacity.' },
  { title: 'Mind Mapping', body: 'Draw visual diagrams connecting ideas to understand relationships between concepts.' },
  { title: 'Teach Others', body: 'Explaining to a peer is one of the most effective ways to solidify knowledge.' },
  { title: 'Chunking', body: 'Break large topics into smaller chunks and master each before moving on.' },
  { title: 'Exercise Breaks', body: 'Short physical activity between sessions boosts blood flow to the brain.' },
  { title: 'Hydration', body: 'Even mild dehydration impairs concentration. Keep a water bottle at your desk.' },
];

/* ── Daily Motivation Quotes (32) ─────────────────────────────── */
const DAILY_QUOTES = [
  'Every expert was once a beginner. Keep going, {name}!',
  '{name}, consistency beats intensity. Show up today!',
  'Small steps every day lead to big results. You got this, {name}!',
  '{name}, your future self will thank you for studying today.',
  'The secret of getting ahead is getting started. Let\'s go, {name}!',
  '{name}, don\'t break the chain. Keep your streak alive!',
  'Focus on progress, not perfection. You\'re doing great, {name}!',
  '{name}, one page at a time. You\'re building something amazing.',
  'Discipline is choosing between what you want now and what you want most. Stay strong, {name}!',
  '{name}, you\'re one study session closer to your goal!',
  'The best time to plant a tree was 20 years ago. The second best time is now. Start studying, {name}!',
  '{name}, tough days don\'t last. Tough students do.',
  'You don\'t have to be perfect, you just have to show up. Way to go, {name}!',
  '{name}, remember why you started. That fire still burns.',
  'A little progress each day adds up to big results. Keep at it, {name}!',
  '{name}, your brain is a muscle. Exercise it today!',
  'Success is the sum of small efforts repeated daily. You\'ve got this, {name}!',
  '{name}, don\'t compare your chapter 1 to someone else\'s chapter 20.',
  'The only way to learn a subject is by studying it. Let\'s do this, {name}!',
  '{name}, your streak is proof of your dedication. Protect it!',
  'Study when you\'re tired. That\'s when it counts. Proud of you, {name}!',
  '{name}, you\'re not behind. You\'re exactly where you need to be.',
  'Every hour you study is an investment in your future. Keep investing, {name}!',
  '{name}, don\'t lose your {streak}-day streak! Study today.',
  'The harder you work, the luckier you get. Go get it, {name}!',
  '{name}, your dreams don\'t work unless you do. Time to study!',
  'Knowledge is power. Keep building yours, {name}!',
  '{name}, you\'ve overcome challenges before. This is just another one.',
  'Start where you are. Use what you have. Do what you can. You\'re capable, {name}!',
  '{name}, today\'s effort is tomorrow\'s success. Put in the work!',
  'You\'re capable of amazing things. One study session at a time, {name}!',
  '{name}, the journey of a thousand miles begins with a single step. Take it now!',
];

/* ── App State ──────────────────────────────────────────────── */
let currentUser = null;
let pomodoroInterval = null;
let pomodoroSeconds = 0;
let pomodoroRunning = false;
let pomodoroIsBreak = false;
let pomodoroCycle = 1;
let activeNoteId = null;
let hydrationTimer = null;
let editingSlotKey = null;

/* ═══════════════════════════════════════════════════════════════
   LOCAL STORAGE HELPERS
═══════════════════════════════════════════════════════════════ */
const lsKey = (k) => `sp_${currentUser}_${k}`;

function lsGet(k, fallback = null) {
  try {
    const v = localStorage.getItem(lsKey(k));
    return v !== null ? JSON.parse(v) : fallback;
  } catch { return fallback; }
}

function lsSet(k, v) {
  try { localStorage.setItem(lsKey(k), JSON.stringify(v)); } catch { }
}

/* ── Utility ────────────────────────────────────────────────── */
function esc(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function pad(n) { return String(n).padStart(2, '0'); }
function todayISO() { return new Date().toISOString().slice(0, 10); }
function yesterdayISO() { return new Date(Date.now() - 86400000).toISOString().slice(0, 10); }

/* ═══════════════════════════════════════════════════════════════
   SETTINGS
═══════════════════════════════════════════════════════════════ */
const SETTINGS_KEY = 'sp_global_settings';
const DEFAULT_SETTINGS = {
  darkMode: 'light',
  hydrationEnabled: true,
  hydrationInterval: 60,
  notificationsEnabled: false,
  pomodoroWork: 25,
  pomodoroBreak: 5,
  soundEnabled: false,
};

function getSettings() {
  try {
    const saved = localStorage.getItem(SETTINGS_KEY);
    return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : { ...DEFAULT_SETTINGS };
  } catch { return { ...DEFAULT_SETTINGS }; }
}

function saveSettings(s) {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s)); } catch { }
}

function applySettings() {
  const s = getSettings();
  document.documentElement.setAttribute('data-theme', s.darkMode);
  updateDarkIcon(s.darkMode);
  initHydrationReminder();
  const pw = document.getElementById('pom-work');
  const pb = document.getElementById('pom-break');
  if (pw && !pomodoroRunning) pw.value = s.pomodoroWork;
  if (pb && !pomodoroRunning) pb.value = s.pomodoroBreak;
}

function renderSettings() {
  const s = getSettings();
  const setChk = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };
  const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
  setChk('set-dark', s.darkMode === 'dark');
  setChk('set-hydration', s.hydrationEnabled);
  setVal('set-hydration-interval', s.hydrationInterval);
  setChk('set-notif', s.notificationsEnabled);
  setVal('set-pom-work', s.pomodoroWork);
  setVal('set-pom-break', s.pomodoroBreak);
  setChk('set-sound', s.soundEnabled);
  renderNotifStatus();
}

function renderNotifStatus() {
  const el = document.getElementById('notif-permission-status');
  if (!el) return;
  if (!('Notification' in window)) {
    el.innerHTML = '<span style="color:var(--text-muted)">Notifications not supported in this browser.</span>';
    return;
  }
  const perm = Notification.permission;
  if (perm === 'granted') {
    el.innerHTML = '<span style="color:var(--accent)">✓ Notifications enabled — you\'ll receive daily motivation and alerts.</span>';
  } else if (perm === 'denied') {
    el.innerHTML = '<span style="color:var(--danger)">✕ Notifications blocked. To enable: click the lock icon in your browser\'s address bar → Allow notifications.</span>';
  } else {
    el.innerHTML = '<span style="color:var(--warn)">⏳ Notifications not yet allowed. Toggle the switch above to enable.</span>';
  }
}

function onSettingChange() {
  const s = getSettings();
  const getChk = (id) => { const el = document.getElementById(id); return el ? el.checked : false; };
  const getNum = (id, def) => { const el = document.getElementById(id); return el ? (parseInt(el.value, 10) || def) : def; };

  s.darkMode = getChk('set-dark') ? 'dark' : 'light';
  s.hydrationEnabled = getChk('set-hydration');
  s.hydrationInterval = getNum('set-hydration-interval', 60);
  s.notificationsEnabled = getChk('set-notif');
  s.pomodoroWork = getNum('set-pom-work', 25);
  s.pomodoroBreak = getNum('set-pom-break', 5);
  s.soundEnabled = getChk('set-sound');

  saveSettings(s);
  if (s.notificationsEnabled) requestNotificationPermission();
  applySettings();
}

/* ═══════════════════════════════════════════════════════════════
   DARK MODE
═══════════════════════════════════════════════════════════════ */
function initDarkMode() {
  const s = getSettings();
  document.documentElement.setAttribute('data-theme', s.darkMode);
  updateDarkIcon(s.darkMode);
}

function toggleDarkMode() {
  const current = document.documentElement.getAttribute('data-theme');
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  updateDarkIcon(next);
  const s = getSettings();
  s.darkMode = next;
  saveSettings(s);
  const el = document.getElementById('set-dark');
  if (el) el.checked = next === 'dark';
}

function updateDarkIcon(theme) {
  const btn = document.getElementById('dark-toggle');
  if (btn) btn.textContent = theme === 'dark' ? '☀️' : '🌙';
}

/* ═══════════════════════════════════════════════════════════════
   NOTIFICATIONS
═══════════════════════════════════════════════════════════════ */
function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') {
    Notification.requestPermission();
  }
}

function sendNotification(title, body) {
  const s = getSettings();
  if (!s.notificationsEnabled) return;
  if (!('Notification' in window)) { showToast(`${title}: ${body}`); return; }
  if (Notification.permission === 'granted') {
    try { new Notification(title, { body }); } catch { }
  } else {
    showToast(`${title}: ${body}`);
  }
}

function showToast(msg, type) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast' + (type ? ' ' + type : '');
  toast.textContent = msg;
  container.appendChild(toast);
  setTimeout(() => { if (toast.parentNode) toast.parentNode.removeChild(toast); }, 4000);
}

function checkExamNotifications() {
  const s = getSettings();
  if (!s.notificationsEnabled) return;
  const exams = getExams();
  const today = todayISO();
  exams.forEach(ex => {
    const days = daysUntil(ex.date);
    if (days === 1) {
      const sentKey = `sp_notif_sent_${today}_${ex.id}`;
      if (!localStorage.getItem(sentKey)) {
        sendNotification('📖 Exam Tomorrow!', `${ex.name} is tomorrow! Make sure you are prepared.`);
        localStorage.setItem(sentKey, '1');
      }
    }
  });
}

/* ═══════════════════════════════════════════════════════════════
   DAILY MOTIVATION NOTIFICATION
═══════════════════════════════════════════════════════════════ */
function sendDailyMotivation() {
  const s = getSettings();
  if (!s.notificationsEnabled) return;
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  const today = todayISO();
  const sentKey = 'sp_daily_motif_' + today;
  if (localStorage.getItem(sentKey)) return;

  const streak = getStreak();
  const lastIdx = parseInt(localStorage.getItem('sp_last_quote_idx') || '-1', 10);

  let idx;
  do {
    idx = Math.floor(Math.random() * DAILY_QUOTES.length);
  } while (idx === lastIdx && DAILY_QUOTES.length > 1);

  localStorage.setItem('sp_last_quote_idx', String(idx));
  localStorage.setItem(sentKey, '1');

  const name = currentUser || 'there';
  let msg = DAILY_QUOTES[idx].replace(/\{name\}/g, name);
  msg = msg.replace(/\{streak\}/g, String(streak.count || 0));

  try { new Notification('💪 Daily Motivation', { body: msg }); } catch { }
}

function requestNotifPermissionOnVisit() {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'default') return;
  const asked = localStorage.getItem('sp_notif_asked');
  if (asked) return;
  localStorage.setItem('sp_notif_asked', '1');
  try { Notification.requestPermission(); } catch { }
}

/* ═══════════════════════════════════════════════════════════════
   HYDRATION REMINDER
═══════════════════════════════════════════════════════════════ */
function initHydrationReminder() {
  if (hydrationTimer) { clearInterval(hydrationTimer); hydrationTimer = null; }
  const s = getSettings();
  if (!s.hydrationEnabled) return;
  const ms = s.hydrationInterval * 60 * 1000;
  hydrationTimer = setInterval(function () {
    const title = '💧 Hydration Reminder';
    const body = 'Time to drink water and stay hydrated!';
    const cfg = getSettings();
    if (cfg.notificationsEnabled && typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      try { new Notification(title, { body }); } catch { }
    } else {
      showToast(title + ' — ' + body, 'hydration');
    }
  }, ms);
}

/* ═══════════════════════════════════════════════════════════════
   SOUND
═══════════════════════════════════════════════════════════════ */
function playBeep() {
  const s = getSettings();
  if (!s.soundEnabled) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.frequency.value = 880;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.6);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.6);
  } catch { }
}

/* ═══════════════════════════════════════════════════════════════
   STREAK TRACKING
═══════════════════════════════════════════════════════════════ */
function getStreak() { return lsGet('streak', { count: 0, lastDate: null }); }

function updateStreak() {
  const today = todayISO();
  const streak = getStreak();
  if (streak.lastDate === today) return streak.count;
  const newCount = streak.lastDate === yesterdayISO() ? streak.count + 1 : 1;
  lsSet('streak', { count: newCount, lastDate: today });
  return newCount;
}

function renderStreakBadge() {
  const badge = document.getElementById('streak-badge');
  if (!badge) return;
  badge.textContent = '🔥 ' + getStreak().count + ' day streak';
}

/* ═══════════════════════════════════════════════════════════════
   ACCOUNT INIT
═══════════════════════════════════════════════════════════════ */
function initAccountDate() {
  if (!lsGet('created_at')) {
    lsSet('created_at', new Date().toISOString());
  }
}

/* ═══════════════════════════════════════════════════════════════
   ONBOARDING (Welcome-only, no Login/Register)
═══════════════════════════════════════════════════════════════ */
function setActiveScreen(which) {
  const welcome = document.getElementById('welcome-screen');
  const dash = document.getElementById('dashboard-screen');

  if (which === 'welcome') {
    if (welcome) welcome.classList.add('active');
    if (dash) dash.classList.remove('active');
    return;
  }

  if (welcome) welcome.classList.remove('active');
  if (dash) dash.classList.add('active');
}

function enterDashboard() {
  const dash = document.getElementById('dashboard-screen');

  // If the page doesn't include the dashboard markup, do nothing (prevents classList crash)
  if (!dash) return;

  dash.classList.add('active');

  const welcome = document.getElementById('welcome-screen');
  if (welcome) welcome.classList.remove('active');

  const u = document.getElementById('sidebar-username');
  if (u) u.textContent = currentUser || '';

  initAccountDate();
  updateStreak();
  renderStreakBadge();
  applySettings();

  // Render only if target containers exist (renderers already guard internally, but keep safe)
  renderDashboard();
  renderStudyGuide();
  renderSubjects();
  renderTimetable();
  renderEditTimetableDaySelect();
  renderEditTimetable();
  renderProgress();
  renderGoals();
  renderExams();
  renderNotes();
  renderAnalytics();
  loadTips();
  initPomodoro();
  syncAllSelects();
  initHydrationReminder();
  checkExamNotifications();
  requestNotifPermissionOnVisit();
  sendDailyMotivation();
}

function handleWelcome(e) {
  if (e && e.preventDefault) e.preventDefault();

  const input = document.getElementById('welcome-name');
  const name = (input ? input.value : '').trim();

  if (!name) return;

  currentUser = name;
  try { localStorage.setItem('sp_current_user', name); } catch { }

  // Ensure future visits skip welcome
  setActiveScreen('dashboard');
  enterDashboard();
}

function logout() {
  try { localStorage.removeItem('sp_current_user'); } catch { }
  currentUser = null;

  pausePomodoro();
  if (hydrationTimer) { clearInterval(hydrationTimer); hydrationTimer = null; }

  // Return to welcome screen (no auth-screen)
  setActiveScreen('welcome');
}

/* ═══════════════════════════════════════════════════════════════
   NAVIGATION
═══════════════════════════════════════════════════════════════ */
function initNav() {
  document.querySelectorAll('.nav-item').forEach(function (link) {
    link.addEventListener('click', function (e) {
      e.preventDefault();
      navigateTo(link.dataset.page);
      closeSidebar();
    });
  });
}

function navigateTo(page) {
  document.querySelectorAll('.nav-item').forEach(function (l) {
    l.classList.toggle('active', l.dataset.page === page);
  });
  document.querySelectorAll('.page').forEach(function (p) {
    p.classList.toggle('active', p.id === 'page-' + page);
  });
  if (page === 'analytics') renderAnalytics();
  if (page === 'profile') renderProfile();
  if (page === 'settings') renderSettings();
}

function toggleSidebar() {
  const s = document.getElementById('sidebar');
  const o = document.getElementById('sidebar-overlay');
  const open = s.classList.toggle('open');
  o.classList.toggle('visible', open);
}

function closeSidebar() {
  const s = document.getElementById('sidebar');
  const o = document.getElementById('sidebar-overlay');
  if (s) s.classList.remove('open');
  if (o) o.classList.remove('visible');
}

/* ═══════════════════════════════════════════════════════════════
   SUBJECTS
═══════════════════════════════════════════════════════════════ */
function getSubjects() { return lsGet('subjects', []); }
function saveSubjects(s) { lsSet('subjects', s); }

function addSubject(e) {
  e.preventDefault();
  const name = document.getElementById('sub-name').value.trim();
  const priority = document.getElementById('sub-priority').value;
  const hours = parseInt(document.getElementById('sub-hrs').value, 10);
  if (!name || !hours) return;
  const subjects = getSubjects();
  subjects.push({ id: Date.now(), name: name, priority: priority, hours: hours, studiedMins: 0 });
  saveSubjects(subjects);
  document.getElementById('sub-name').value = '';
  document.getElementById('sub-hrs').value = '';
  renderSubjects();
  renderProgress();
  renderDashboard();
  syncAllSelects();
}

function deleteSubject(id) {
  if (!confirm('Delete this subject?')) return;
  saveSubjects(getSubjects().filter(function (s) { return s.id !== id; }));
  renderSubjects();
  renderProgress();
  renderDashboard();
  syncAllSelects();
}

function renderSubjects() {
  const list = document.getElementById('subjects-list');
  const subjects = getSubjects();
  if (!list) return;
  if (!subjects.length) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:.9rem">No subjects yet. Add one above!</p>';
    return;
  }
  list.innerHTML = subjects.map(function (s) {
    return '<div class="subject-item">' +
      '<div class="subject-info">' +
      '<span class="subject-name">' + esc(s.name) + '</span>' +
      '<span class="subject-meta">' + s.hours + 'h estimated &bull; ' + (Math.round((s.studiedMins || 0) / 60 * 10) / 10) + 'h studied</span>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:.6rem">' +
      '<span class="priority-badge p' + s.priority + '">' + PRIORITY_LABELS[s.priority] + '</span>' +
      '<button class="btn btn-danger" style="padding:.3rem .7rem;font-size:.78rem" onclick="deleteSubject(' + s.id + ')">🗑</button>' +
      '</div>' +
      '</div>';
  }).join('');
}

function syncAllSelects() {
  const subjects = getSubjects();
  const opts = subjects.map(function (s) {
    return '<option value="' + s.id + '">' + esc(s.name) + '</option>';
  }).join('');
  const noOpt = '<option value="">No subject</option>';

  const progSel = document.getElementById('prog-subject');
  if (progSel) progSel.innerHTML = opts || '<option value="">No subjects yet</option>';

  ['goal-subject', 'exam-subject', 'note-subject'].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.innerHTML = noOpt + opts;
  });

  const editSel = document.getElementById('edit-slot-subject');
  if (editSel) editSel.innerHTML = opts || '<option value="">No subjects yet</option>';
}

/* ═══════════════════════════════════════════════════════════════
   TIMETABLE
═══════════════════════════════════════════════════════════════ */
function getTimetable() { return lsGet('timetable', []); }
function saveTimetable(t) { lsSet('timetable', t); }
function getTimetableChecks() { return lsGet('tt_checks', {}); }
function saveTimetableChecks(c) { lsSet('tt_checks', c); }

function generateTimetable(e) {
  e.preventDefault();
  const days = parseInt(document.getElementById('tt-days').value, 10);
  const hpd = parseInt(document.getElementById('tt-hours').value, 10);
  const start = parseInt(document.getElementById('tt-start').value, 10);
  const subjects = getSubjects();
  if (!subjects.length) { alert('Please add at least one subject first.'); return; }

  const pool = [];
  subjects.forEach(function (s) {
    const w = s.priority === '1' ? 3 : s.priority === '2' ? 2 : 1;
    for (let i = 0; i < w; i++) pool.push(s);
  });

  const timetable = [];
  let pi = 0;
  for (let d = 0; d < days; d++) {
    const slots = [];
    for (let h = 0; h < hpd; h++) {
      const subj = pool[pi % pool.length]; pi++;
      const hr = (start + h) % 24;
      slots.push({
        time: pad(hr) + ':00 - ' + pad((hr + 1) % 24) + ':00',
        subject: subj.name,
        subjectId: subj.id,
      });
    }
    timetable.push({ day: DAYS[d], slots: slots });
  }
  saveTimetable(timetable);
  saveTimetableChecks({});
  renderTimetable();
  renderEditTimetableDaySelect();
  renderEditTimetable();
  renderDashboard();
}

function renderTimetable() {
  const grid = document.getElementById('timetable-grid');
  const timetable = getTimetable();
  const checks = getTimetableChecks();
  if (!grid) return;
  if (!timetable.length) {
    grid.innerHTML = '<p style="color:var(--text-muted);font-size:.9rem">No timetable yet. Generate one above!</p>';
    return;
  }
  let html = '<div class="tt-grid">';
  timetable.forEach(function (day, di) {
    html += '<div class="tt-day-card">';
    html += '<div class="tt-day-header">' + esc(day.day) + '</div>';
    html += '<div class="tt-slots">';
    day.slots.forEach(function (slot, si) {
      const key = di + '_' + si;
      const done = !!checks[key];
      html += '<div class="tt-slot' + (done ? ' done' : '') + '" id="slot-' + key + '">';
      html += '<input type="checkbox" ' + (done ? 'checked' : '') + ' onchange="toggleSlot(\'' + key + '\',this.checked)" />';
      html += '<span class="tt-time">' + esc(slot.time) + '</span>';
      html += '<span class="tt-subject">' + esc(slot.subject) + '</span>';
      html += '</div>';
    });
    html += '</div></div>';
  });
  html += '</div>';
  grid.innerHTML = html;
}

function toggleSlot(key, checked) {
  const checks = getTimetableChecks();
  checks[key] = checked;
  saveTimetableChecks(checks);
  const el = document.getElementById('slot-' + key);
  if (el) el.classList.toggle('done', checked);
  renderDashboard();
}

/* ── PDF Export ─────────────────────────────────────────────── */
function exportTimetablePDF() {
  const timetable = getTimetable();
  if (!timetable.length) { alert('Generate a timetable first.'); return; }
  if (!window.jspdf) { alert('PDF library not loaded.'); return; }
  const jsPDF = window.jspdf.jsPDF;
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  const margin = 14;
  let y = 20;

  doc.setFontSize(18); doc.setFont('helvetica', 'bold');
  doc.text('AI Study Planner – Weekly Timetable', pageW / 2, y, { align: 'center' });
  y += 6;
  doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
  doc.text('Generated: ' + new Date().toLocaleDateString() + '  |  User: ' + currentUser, pageW / 2, y, { align: 'center' });
  doc.setTextColor(0); y += 10;

  timetable.forEach(function (day) {
    if (y > 260) { doc.addPage(); y = 20; }
    doc.setFillColor(99, 102, 241);
    doc.roundedRect(margin, y, pageW - margin * 2, 8, 2, 2, 'F');
    doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(255);
    doc.text(day.day, margin + 4, y + 5.5);
    doc.setTextColor(0); y += 10;
    day.slots.forEach(function (slot) {
      if (y > 270) { doc.addPage(); y = 20; }
      doc.setFillColor(248, 250, 255);
      doc.roundedRect(margin, y, pageW - margin * 2, 7, 1, 1, 'F');
      doc.setDrawColor(220);
      doc.roundedRect(margin, y, pageW - margin * 2, 7, 1, 1, 'S');
      doc.setFontSize(9); doc.setFont('helvetica', 'normal'); doc.setTextColor(100);
      doc.text(slot.time, margin + 3, y + 4.8);
      doc.setTextColor(30); doc.setFont('helvetica', 'bold');
      doc.text(slot.subject, margin + 45, y + 4.8);
      y += 8;
    });
    y += 4;
  });
  doc.save('study-timetable-' + todayISO() + '.pdf');
}

/* ═══════════════════════════════════════════════════════════════
   TIMETABLE EDITOR
═══════════════════════════════════════════════════════════════ */
function renderEditTimetableDaySelect() {
  const sel = document.getElementById('edit-tt-day');
  if (!sel) return;
  const timetable = getTimetable();
  if (!timetable.length) {
    sel.innerHTML = '<option value="">No timetable</option>';
    return;
  }
  const prev = sel.value;
  sel.innerHTML = timetable.map(function (d, i) {
    return '<option value="' + i + '">' + esc(d.day) + '</option>';
  }).join('');
  if (prev !== '' && timetable[parseInt(prev, 10)]) sel.value = prev;
}

function getEditDayIdx() {
  const sel = document.getElementById('edit-tt-day');
  return sel ? parseInt(sel.value, 10) || 0 : 0;
}

function renderEditTimetable() {
  const container = document.getElementById('edit-tt-slots');
  if (!container) return;
  const timetable = getTimetable();
  if (!timetable.length) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:.88rem">Generate a timetable first, then edit it here.</p>';
    return;
  }
  const di = getEditDayIdx();
  const day = timetable[di];
  if (!day) { container.innerHTML = ''; return; }

  let html = '';
  day.slots.forEach(function (slot, si) {
    const key = di + '_' + si;
    if (editingSlotKey === key) {
      const subjects = getSubjects();
      const subjectOpts = subjects.map(function (s) {
        return '<option value="' + esc(s.name) + '"' + (s.name === slot.subject ? ' selected' : '') + '>' + esc(s.name) + '</option>';
      }).join('');
      const parts = slot.time.split(' - ');
      const startT = parts[0] || '09:00';
      const endT = parts[1] || '10:00';
      html += '<div class="edit-slot-inline">';
      html += '<select id="esi-subj-' + key + '">' + subjectOpts + '</select>';
      html += '<input type="time" id="esi-start-' + key + '" value="' + esc(startT) + '" />';
      html += '<input type="time" id="esi-end-' + key + '" value="' + esc(endT) + '" />';
      html += '<button class="btn btn-primary btn-sm" onclick="saveEditSlot(\'' + key + '\')">Save</button>';
      html += '<button class="btn btn-ghost btn-sm" onclick="cancelEditSlot()">Cancel</button>';
      html += '</div>';
    } else {
      html += '<div class="edit-slot-row">';
      html += '<span class="edit-slot-time">' + esc(slot.time) + '</span>';
      html += '<span class="edit-slot-subject">' + esc(slot.subject) + '</span>';
      html += '<div class="edit-slot-actions">';
      if (si > 0) {
        html += '<button onclick="moveSlot(' + di + ',' + si + ',-1)" title="Move up">▲</button>';
      }
      if (si < day.slots.length - 1) {
        html += '<button onclick="moveSlot(' + di + ',' + si + ',1)" title="Move down">▼</button>';
      }
      html += '<button onclick="openEditSlot(\'' + key + '\')" title="Edit">✏️</button>';
      html += '<button onclick="deleteEditSlot(' + di + ',' + si + ')" title="Delete" style="color:var(--danger)">🗑</button>';
      html += '</div></div>';
    }
  });
  container.innerHTML = html;
}

function openEditSlot(key) {
  editingSlotKey = key;
  renderEditTimetable();
}

function cancelEditSlot() {
  editingSlotKey = null;
  renderEditTimetable();
}

function saveEditSlot(key) {
  const parts = key.split('_');
  const di = parseInt(parts[0], 10);
  const si = parseInt(parts[1], 10);
  const timetable = getTimetable();
  if (!timetable[di] || !timetable[di].slots[si]) return;

  const subjEl = document.getElementById('esi-subj-' + key);
  const startEl = document.getElementById('esi-start-' + key);
  const endEl = document.getElementById('esi-end-' + key);
  if (!subjEl || !startEl || !endEl) return;

  const subject = subjEl.value;
  const start = startEl.value;
  const end = endEl.value;

  timetable[di].slots[si].subject = subject;
  timetable[di].slots[si].time = start + ' - ' + end;

  const subj = getSubjects().find(function (s) { return s.name === subject; });
  timetable[di].slots[si].subjectId = subj ? subj.id : null;

  saveTimetable(timetable);
  editingSlotKey = null;
  renderEditTimetable();
  renderTimetable();
  renderDashboard();
}

function deleteEditSlot(di, si) {
  if (!confirm('Delete this slot?')) return;
  const timetable = getTimetable();
  if (!timetable[di]) return;
  timetable[di].slots.splice(si, 1);
  saveTimetable(timetable);
  editingSlotKey = null;
  renderEditTimetable();
  renderTimetable();
  renderDashboard();
}

function moveSlot(di, si, dir) {
  const timetable = getTimetable();
  if (!timetable[di]) return;
  const slots = timetable[di].slots;
  const target = si + dir;
  if (target < 0 || target >= slots.length) return;
  const tmp = slots[si];
  slots[si] = slots[target];
  slots[target] = tmp;
  saveTimetable(timetable);
  renderEditTimetable();
  renderTimetable();
  renderDashboard();
}

function addEditSlot() {
  const timetable = getTimetable();
  const di = getEditDayIdx();
  if (!timetable.length || !timetable[di]) {
    alert('Generate a timetable first.');
    return;
  }
  const subjEl = document.getElementById('edit-slot-subject');
  const startEl = document.getElementById('edit-slot-start');
  const endEl = document.getElementById('edit-slot-end');
  if (!subjEl || !startEl || !endEl) return;

  const subjects = getSubjects();
  const subj = subjects.find(function (s) { return String(s.id) === subjEl.value; }) || subjects[0];
  if (!subj) { alert('Add a subject first.'); return; }

  const start = startEl.value || '09:00';
  const end = endEl.value || '10:00';
  timetable[di].slots.push({
    time: start + ' - ' + end,
    subject: subj.name,
    subjectId: subj.id,
  });
  saveTimetable(timetable);
  renderEditTimetable();
  renderTimetable();
  renderDashboard();
}

/* ═══════════════════════════════════════════════════════════════
   PROGRESS TRACKER
═══════════════════════════════════════════════════════════════ */
function logProgress(e) {
  e.preventDefault();
  const id = parseInt(document.getElementById('prog-subject').value, 10);
  const mins = parseInt(document.getElementById('prog-mins').value, 10);
  if (!id || !mins) return;
  const subjects = getSubjects();
  const idx = subjects.findIndex(function (s) { return s.id === id; });
  if (idx === -1) return;
  subjects[idx].studiedMins = (subjects[idx].studiedMins || 0) + mins;

  const history = lsGet('daily_history', {});
  const today = todayISO();
  history[today] = (history[today] || 0) + mins;
  lsSet('daily_history', history);

  const sessions = lsGet('sessions', 0);
  lsSet('sessions', sessions + 1);

  saveSubjects(subjects);
  updateStreak();
  renderStreakBadge();
  document.getElementById('prog-mins').value = '';
  renderProgress();
  renderSubjects();
  renderDashboard();
}

function getProgressChecks() { return lsGet('prog_checks', {}); }
function saveProgressChecks(c) { lsSet('prog_checks', c); }

function renderProgress() {
  syncAllSelects();
  const subjects = getSubjects();
  const checks = getProgressChecks();
  const list = document.getElementById('progress-list');
  const overallPct = document.getElementById('overall-percent');
  const overallBar = document.getElementById('overall-bar');

  if (!list) return;

  if (!subjects.length) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:.9rem">No subjects yet.</p>';
    if (overallPct) overallPct.textContent = '0%';
    if (overallBar) overallBar.style.width = '0%';
    return;
  }

  const totalMins = subjects.reduce(function (a, s) { return a + s.hours * 60; }, 0);
  const studiedMins = subjects.reduce(function (a, s) { return a + (s.studiedMins || 0); }, 0);
  const pctVal = totalMins ? Math.min(100, Math.round(studiedMins / totalMins * 100)) : 0;
  if (overallPct) overallPct.textContent = pctVal + '%';
  if (overallBar) overallBar.style.width = pctVal + '%';

  list.innerHTML = subjects.map(function (s) {
    const targetMins = s.hours * 60;
    const pct = targetMins ? Math.min(100, Math.round((s.studiedMins || 0) / targetMins * 100)) : 0;
    const checkboxes = Array.from({ length: s.hours }, function (_, i) {
      const key = s.id + '_h' + i;
      const done = !!checks[key];
      return '<label class="progress-check-item' + (done ? ' checked' : '') + '" id="pci-' + key + '">' +
        '<input type="checkbox" ' + (done ? 'checked' : '') + ' onchange="toggleProgressCheck(\'' + key + '\',this.checked)" />' +
        'Hour ' + (i + 1) +
        '</label>';
    }).join('');
    return '<div class="progress-item">' +
      '<div class="progress-item-header">' +
      '<span class="progress-item-name">' + esc(s.name) + '</span>' +
      '<span class="progress-item-pct">' + pct + '%</span>' +
      '</div>' +
      '<div class="progress-item-bar-wrap"><div class="progress-item-bar" style="width:' + pct + '%"></div></div>' +
      '<div class="progress-checklist">' + checkboxes + '</div>' +
      '</div>';
  }).join('');
}

function toggleProgressCheck(key, checked) {
  const checks = getProgressChecks();
  checks[key] = checked;
  saveProgressChecks(checks);
  const el = document.getElementById('pci-' + key);
  if (el) el.classList.toggle('checked', checked);
}

/* ═══════════════════════════════════════════════════════════════
   DAILY GOALS
═══════════════════════════════════════════════════════════════ */
function getGoals() { return lsGet('goals_' + todayISO(), []); }
function saveGoals(g) { lsSet('goals_' + todayISO(), g); }

function addGoal(e) {
  e.preventDefault();
  const text = document.getElementById('goal-text').value.trim();
  const subjId = document.getElementById('goal-subject').value;
  if (!text) return;
  const subj = getSubjects().find(function (s) { return String(s.id) === subjId; });
  const goals = getGoals();
  goals.push({ id: Date.now(), text: text, subjName: subj ? subj.name : '', done: false });
  saveGoals(goals);
  document.getElementById('goal-text').value = '';
  renderGoals();
  renderDashboard();
}

function toggleGoal(id, checked) {
  const goals = getGoals();
  const g = goals.find(function (g) { return g.id === id; });
  if (g) g.done = checked;
  saveGoals(goals);
  renderGoals();
  renderDashboard();
}

function deleteGoal(id) {
  saveGoals(getGoals().filter(function (g) { return g.id !== id; }));
  renderGoals();
  renderDashboard();
}

function renderGoals() {
  const goals = getGoals();
  const list = document.getElementById('goals-list');
  const summary = document.getElementById('goal-summary');
  const bar = document.getElementById('goal-bar');
  if (!list) return;

  const done = goals.filter(function (g) { return g.done; }).length;
  const total = goals.length;
  const pct = total ? Math.round(done / total * 100) : 0;
  if (summary) summary.textContent = done + ' / ' + total + ' done';
  if (bar) bar.style.width = pct + '%';

  if (!goals.length) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:.9rem">No goals for today. Add one above!</p>';
    return;
  }
  list.innerHTML = goals.map(function (g) {
    return '<div class="goal-item' + (g.done ? ' done' : '') + '">' +
      '<input type="checkbox" ' + (g.done ? 'checked' : '') + ' onchange="toggleGoal(' + g.id + ',this.checked)" />' +
      '<span class="goal-label">' + esc(g.text) + '</span>' +
      (g.subjName ? '<span class="goal-tag">' + esc(g.subjName) + '</span>' : '') +
      '<button class="goal-delete" onclick="deleteGoal(' + g.id + ')">✕</button>' +
      '</div>';
  }).join('');
}

/* ═══════════════════════════════════════════════════════════════
   EXAM COUNTDOWN
═══════════════════════════════════════════════════════════════ */
function getExams() { return lsGet('exams', []); }
function saveExams(e) { lsSet('exams', e); }

function addExam(ev) {
  ev.preventDefault();
  const name = document.getElementById('exam-name').value.trim();
  const date = document.getElementById('exam-date').value;
  const subjId = document.getElementById('exam-subject').value;
  if (!name || !date) return;
  const subj = getSubjects().find(function (s) { return String(s.id) === subjId; });
  const exams = getExams();
  exams.push({ id: Date.now(), name: name, date: date, subjName: subj ? subj.name : '' });
  exams.sort(function (a, b) { return a.date.localeCompare(b.date); });
  saveExams(exams);
  document.getElementById('exam-name').value = '';
  document.getElementById('exam-date').value = '';
  renderExams();
  renderDashboard();
}

function deleteExam(id) {
  saveExams(getExams().filter(function (e) { return e.id !== id; }));
  renderExams();
  renderDashboard();
}

function daysUntil(dateStr) {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const exam = new Date(dateStr);
  return Math.round((exam - now) / 86400000);
}

function renderExams() {
  const list = document.getElementById('exams-list');
  const exams = getExams();
  if (!list) return;
  if (!exams.length) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:.9rem">No exams added yet.</p>';
    return;
  }
  list.innerHTML = exams.map(function (ex) {
    const days = daysUntil(ex.date);
    const cls = days <= 3 ? 'urgent' : days <= 7 ? 'soon' : 'ok';
    const label = days < 0 ? 'Past' : days === 0 ? 'Today!' : days + 'd';
    const dateLabel = new Date(ex.date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    return '<div class="exam-item">' +
      '<div class="exam-info">' +
      '<span class="exam-name">' + esc(ex.name) + '</span>' +
      '<span class="exam-date-str">' + dateLabel + (ex.subjName ? ' &bull; ' + esc(ex.subjName) : '') + '</span>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:.8rem">' +
      '<div class="exam-countdown-wrap">' +
      '<span class="exam-countdown ' + cls + '">' + label + '</span>' +
      '<span class="exam-days-label">' + (days >= 0 ? 'days left' : 'ago') + '</span>' +
      '</div>' +
      '<button class="btn btn-danger" style="padding:.3rem .65rem;font-size:.78rem" onclick="deleteExam(' + ex.id + ')">🗑</button>' +
      '</div>' +
      '</div>';
  }).join('');
}

/* ═══════════════════════════════════════════════════════════════
   NOTES
═══════════════════════════════════════════════════════════════ */
function getNotes() { return lsGet('notes', []); }
function saveNotes(n) { lsSet('notes', n); }

function newNote() {
  activeNoteId = null;
  document.getElementById('note-title').value = '';
  document.getElementById('note-body').value = '';
  document.getElementById('note-subject').value = '';
  document.querySelectorAll('.note-list-item').forEach(function (el) { el.classList.remove('active'); });
}

function saveNote() {
  const title = document.getElementById('note-title').value.trim() || 'Untitled';
  const body = document.getElementById('note-body').value;
  const subjId = document.getElementById('note-subject').value;
  const subj = getSubjects().find(function (s) { return String(s.id) === subjId; });
  const notes = getNotes();
  if (activeNoteId) {
    const idx = notes.findIndex(function (n) { return n.id === activeNoteId; });
    if (idx !== -1) {
      notes[idx] = { id: notes[idx].id, title: title, body: body, subjName: subj ? subj.name : '', updatedAt: Date.now() };
    }
  } else {
    const note = { id: Date.now(), title: title, body: body, subjName: subj ? subj.name : '', updatedAt: Date.now() };
    notes.unshift(note);
    activeNoteId = note.id;
  }
  saveNotes(notes);
  renderNotes();
}

function openNote(id) {
  const note = getNotes().find(function (n) { return n.id === id; });
  if (!note) return;
  activeNoteId = id;
  document.getElementById('note-title').value = note.title;
  document.getElementById('note-body').value = note.body;
  const subj = getSubjects().find(function (s) { return s.name === note.subjName; });
  document.getElementById('note-subject').value = subj ? String(subj.id) : '';
  document.querySelectorAll('.note-list-item').forEach(function (el) {
    el.classList.toggle('active', parseInt(el.dataset.id, 10) === id);
  });
}

function deleteNote() {
  if (!activeNoteId) return;
  if (!confirm('Delete this note?')) return;
  saveNotes(getNotes().filter(function (n) { return n.id !== activeNoteId; }));
  activeNoteId = null;
  document.getElementById('note-title').value = '';
  document.getElementById('note-body').value = '';
  renderNotes();
}

function renderNotes() {
  const list = document.getElementById('notes-list');
  const notes = getNotes();
  if (!list) return;
  if (!notes.length) {
    list.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem;margin-top:.5rem">No notes yet. Click + New to start.</p>';
    return;
  }
  list.innerHTML = notes.map(function (n) {
    return '<div class="note-list-item' + (n.id === activeNoteId ? ' active' : '') + '" data-id="' + n.id + '" onclick="openNote(' + n.id + ')">' +
      '<div class="note-list-title">' + esc(n.title) + '</div>' +
      '<div class="note-list-preview">' + esc((n.body || '').slice(0, 60)) + '</div>' +
      '</div>';
  }).join('');
}

/* ═══════════════════════════════════════════════════════════════
   DASHBOARD
═══════════════════════════════════════════════════════════════ */
function renderDashboard() {
  const subjects = getSubjects();
  const timetable = getTimetable();
  const checks = getTimetableChecks();
  const streak = getStreak();
  const goals = getGoals();

  const studiedHours = subjects.reduce(function (a, s) { return a + Math.round((s.studiedMins || 0) / 60 * 10) / 10; }, 0);
  const totalSlots = timetable.reduce(function (a, d) { return a + d.slots.length; }, 0);
  const doneSlots = Object.values(checks).filter(Boolean).length;
  const goalsDone = goals.filter(function (g) { return g.done; }).length;

  const statsGrid = document.getElementById('stats-grid');
  if (statsGrid) {
    statsGrid.innerHTML = [
      { icon: '📚', value: subjects.length, label: 'Subjects' },
      { icon: '⏰', value: studiedHours + 'h', label: 'Hours Studied' },
      { icon: '📅', value: doneSlots + '/' + totalSlots, label: 'Slots Done' },
      { icon: '🔥', value: streak.count, label: 'Day Streak' },
      { icon: '🎯', value: goalsDone + '/' + goals.length, label: 'Goals Today' },
    ].map(function (s) {
      return '<div class="stat-card">' +
        '<span class="stat-icon">' + s.icon + '</span>' +
        '<span class="stat-value">' + s.value + '</span>' +
        '<span class="stat-label">' + s.label + '</span>' +
        '</div>';
    }).join('');
  }

  const todayIdx = (new Date().getDay() + 6) % 7;
  const todaySchedule = document.getElementById('today-schedule');
  const todayData = timetable[todayIdx];
  if (todaySchedule) {
    if (!todayData || !todayData.slots.length) {
      todaySchedule.innerHTML = '<p style="color:var(--text-muted);font-size:.9rem">No schedule for today. Generate a timetable first.</p>';
    } else {
      todaySchedule.innerHTML = todayData.slots.map(function (slot, si) {
        const key = todayIdx + '_' + si;
        const done = !!checks[key];
        return '<div class="today-slot' + (done ? ' done' : '') + '" id="today-slot-' + key + '">' +
          '<input type="checkbox" ' + (done ? 'checked' : '') + ' onchange="toggleSlot(\'' + key + '\',this.checked)" />' +
          '<span style="color:var(--text-muted);font-size:.8rem;min-width:110px">' + esc(slot.time) + '</span>' +
          '<span style="font-weight:600">' + esc(slot.subject) + '</span>' +
          '</div>';
      }).join('');
    }
  }

  const dashExams = document.getElementById('dash-exams');
  if (dashExams) {
    const upcoming = getExams().filter(function (ex) { return daysUntil(ex.date) >= 0; }).slice(0, 4);
    if (!upcoming.length) {
      dashExams.innerHTML = '<p style="color:var(--text-muted);font-size:.9rem">No upcoming exams.</p>';
    } else {
      dashExams.innerHTML = upcoming.map(function (ex) {
        const days = daysUntil(ex.date);
        const cls = days <= 3 ? 'urgent' : days <= 7 ? 'soon' : 'ok';
        return '<div style="display:flex;justify-content:space-between;align-items:center;padding:.6rem .8rem;border-radius:8px;border:1px solid var(--border);margin-bottom:.4rem;background:var(--surface2)">' +
          '<span style="font-weight:600;font-size:.88rem">' + esc(ex.name) + '</span>' +
          '<span class="exam-countdown ' + cls + '" style="font-size:1rem">' + (days === 0 ? 'Today!' : days + 'd') + '</span>' +
          '</div>';
      }).join('');
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   AI STUDY GUIDE
═══════════════════════════════════════════════════════════════ */
function renderStudyGuide() {
  const subjects = getSubjects();
  const timetable = getTimetable();
  const checks = getTimetableChecks();
  const streak = getStreak();
  const goals = getGoals();
  const notes = getNotes();
  const exams = getExams();
  const createdAt = lsGet('created_at');
  const name = currentUser || 'there';

  const totalSlots = timetable.reduce(function (a, d) { return a + d.slots.length; }, 0);
  const doneSlots = Object.values(checks).filter(Boolean).length;
  const goalsDone = goals.filter(function (g) { return g.done; }).length;
  const totalMins = subjects.reduce(function (a, s) { return a + (s.studiedMins || 0); }, 0);
  const isNew = !createdAt || (Date.now() - new Date(createdAt).getTime()) < 86400000;
  const hasTimetable = timetable.length > 0 && totalSlots > 0;
  const hasSubjects = subjects.length > 0;
  const upcomingExams = exams.filter(function (e) { return daysUntil(e.date) >= 0; });
  const urgentExam = upcomingExams.find(function (e) { return daysUntil(e.date) <= 3; });

  const summaryEl = document.getElementById('study-guide-summary');
  const stepsEl = document.getElementById('study-guide-steps');

  let summary = '';
  let steps = [];

  if (isNew && !hasSubjects) {
    summary = '👋 Welcome, ' + name + '! Let\'s set up your study plan.';
    steps = [
      { icon: '📚', text: 'Add your subjects with estimated study hours' },
      { icon: '📅', text: 'Generate a personalized timetable' },
      { icon: '🎯', text: 'Set your first daily goal' },
      { icon: '⏱', text: 'Start a Pomodoro session to begin studying' },
    ];
  } else if (isNew && hasSubjects && !hasTimetable) {
    summary = '👋 Hi ' + name + '! Great start — now let\'s build your schedule.';
    steps = [
      { icon: '📅', text: 'Generate a timetable from your ' + subjects.length + ' subject' + (subjects.length > 1 ? 's' : '') },
      { icon: '⏱', text: 'Start a Pomodoro session for your first subject' },
      { icon: '🎯', text: 'Set daily goals to stay on track' },
      { icon: '📝', text: 'Take notes on what you\'re learning' },
    ];
  } else if (urgentExam) {
    const days = daysUntil(urgentExam.date);
    summary = '🚨 ' + name + ', ' + urgentExam.name + ' is ' + (days === 0 ? 'today' : days + ' day' + (days > 1 ? 's' : '') + ' away') + '!';
    steps = [
      { icon: '📖', text: 'Review key topics for ' + urgentExam.name },
      { icon: '📝', text: 'Go through your notes for this subject' },
      { icon: '⏱', text: 'Do a focused Pomodoro session on weak areas' },
      { icon: '🎯', text: 'Set an exam-specific study goal for today' },
    ];
  } else if (streak.count >= 7) {
    summary = '🔥 Amazing, ' + name + '! ' + streak.count + '-day streak — keep it going!';
    steps = [
      { icon: '📅', text: 'Check today\'s timetable and complete remaining slots' },
      { icon: '🎯', text: 'Finish your remaining ' + (goals.length - goalsDone) + ' goal' + ((goals.length - goalsDone) !== 1 ? 's' : '') + ' for today' },
      { icon: '📈', text: 'Log study time to maintain your streak' },
      { icon: '📝', text: 'Review or add notes for today\'s subjects' },
    ];
  } else if (doneSlots < totalSlots && hasTimetable) {
    const remaining = totalSlots - doneSlots;
    summary = '💪 ' + name + ', you have ' + remaining + ' timetable slot' + (remaining !== 1 ? 's' : '') + ' left today.';
    steps = [
      { icon: '📅', text: 'Complete remaining ' + remaining + ' slot' + (remaining !== 1 ? 's' : '') + ' in today\'s schedule' },
      { icon: '⏱', text: 'Start a Pomodoro session for your next subject' },
      { icon: '🎯', text: goalsDone < goals.length ? 'Complete ' + (goals.length - goalsDone) + ' more goal' + ((goals.length - goalsDone) !== 1 ? 's' : '') : 'All goals done — set new ones for tomorrow' },
      { icon: '📈', text: 'Log your progress after each session' },
    ];
  } else if (totalMins === 0 && hasSubjects) {
    summary = '📚 Hi ' + name + '! You have ' + subjects.length + ' subject' + (subjects.length > 1 ? 's' : '') + ' — time to study!';
    steps = [
      { icon: '⏱', text: 'Start a Pomodoro session for your first subject' },
      { icon: '📈', text: 'Log your study time after each session' },
      { icon: '📝', text: 'Take notes on key concepts' },
      { icon: '🎯', text: 'Set daily goals to stay motivated' },
    ];
  } else {
    const hours = Math.round(totalMins / 60 * 10) / 10;
    summary = '✅ Great progress, ' + name + '! ' + hours + 'h studied so far.';
    steps = [
      { icon: '📅', text: hasTimetable ? 'Review your timetable for upcoming sessions' : 'Generate a timetable to organize your study time' },
      { icon: '🎯', text: goalsDone < goals.length ? 'Complete your remaining ' + (goals.length - goalsDone) + ' goal' + ((goals.length - goalsDone) !== 1 ? 's' : '') : 'Set new goals for tomorrow' },
      { icon: '📝', text: notes.length > 0 ? 'Review your ' + notes.length + ' note' + (notes.length > 1 ? 's' : '') : 'Start taking notes for better retention' },
      { icon: '📊', text: 'Check your analytics to track improvement' },
    ];
  }

  if (summaryEl) summaryEl.innerHTML = '<p style="font-size:.9rem;line-height:1.5;color:var(--text);margin:0">' + esc(summary) + '</p>';
  if (stepsEl) {
    stepsEl.innerHTML = steps.map(function (s, i) {
      return '<div class="study-guide-step">' +
        '<span class="study-guide-step-icon">' + s.icon + '</span>' +
        '<span class="study-guide-step-text">' + esc(s.text) + '</span>' +
        '</div>';
    }).join('');
  }
}

function toggleStudyGuide() {
  const el = document.getElementById('study-guide-steps');
  const btn = document.getElementById('study-guide-toggle');
  if (!el) return;
  el.classList.toggle('hidden');
  if (btn) btn.textContent = el.classList.contains('hidden') ? '💡' : '✕';
}

/* ═══════════════════════════════════════════════════════════════
   AI STUDY ASSISTANT
═══════════════════════════════════════════════════════════════ */
let aiUploadedFiles = [];
let aiCurrentResult = '';
let aiCurrentAction = '';

const FREE_AI_UPLOAD_LIMIT = 30;
const FREE_AI_QUESTION_LIMIT = 30;

function getOrCreateUserId() {
  var id = localStorage.getItem('sp_user_id');
  if (!id) {
    id = 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10);
    localStorage.setItem('sp_user_id', id);
  }
  return id;
}

function isPremium() {
  const exp = localStorage.getItem('sp_premium_expires');
  return exp && new Date(exp) > new Date();
}

function getMonthlyUploadCount() {
  const m = new Date().toISOString().slice(0, 7);
  return parseInt(localStorage.getItem('sp_ai_uploads_' + m) || '0', 10);
}

function incMonthlyUploadCount() {
  const m = new Date().toISOString().slice(0, 7);
  const k = 'sp_ai_uploads_' + m;
  localStorage.setItem(k, String(parseInt(localStorage.getItem(k) || '0', 10) + 1));
}

function getDailyQuestionCount() {
  const d = todayISO();
  return parseInt(localStorage.getItem('sp_ai_questions_' + d) || '0', 10);
}

function incDailyQuestionCount() {
  const d = todayISO();
  const k = 'sp_ai_questions_' + d;
  localStorage.setItem(k, String(parseInt(localStorage.getItem(k) || '0', 10) + 1));
}

function updateAIUsageBadge() {
  const el = document.getElementById('ai-usage-badge');
  if (!el) return;
  if (isPremium()) {
    el.textContent = '⭐ Premium — Unlimited';
    el.className = 'ai-usage-badge ai-badge-premium';
    return;
  }
  const uploads = getMonthlyUploadCount();
  const questions = getDailyQuestionCount();
  el.textContent = 'Free: ' + uploads + '/' + FREE_AI_UPLOAD_LIMIT + ' uploads, ' + questions + '/' + FREE_AI_QUESTION_LIMIT + ' questions';
  el.className = 'ai-usage-badge ai-badge-free';
}

function openAIAssistant() {
  const overlay = document.getElementById('ai-assistant-overlay');
  if (!overlay) return;
  overlay.classList.remove('hidden');
  aiUploadedFiles = [];
  updateAIUsageBadge();
  renderUploadedFiles();
  document.getElementById('ai-actions').style.display = 'none';
  document.getElementById('ai-chat-section').style.display = 'none';
  document.getElementById('ai-results-section').style.display = 'none';
  document.getElementById('ai-upload-section').style.display = '';
  var msgs = document.getElementById('ai-chat-messages');
  if (msgs) msgs.innerHTML = '<div class="ai-msg ai-msg-bot"><div class="ai-msg-avatar">🤖</div><div class="ai-msg-content">Hi! Upload a document and I\'ll help you study. You can ask me anything about the content.</div></div>';
}

function closeAIAssistant() {
  var overlay = document.getElementById('ai-assistant-overlay');
  if (overlay) overlay.classList.add('hidden');
  aiUploadedFiles = [];
}

function renderUploadedFiles() {
  var el = document.getElementById('ai-uploaded-files');
  if (!el) return;
  if (!aiUploadedFiles.length) { el.innerHTML = ''; return; }
  el.innerHTML = aiUploadedFiles.map(function (f, i) {
    return '<div class="ai-file-item"><span class="ai-file-icon">📄</span><span class="ai-file-name">' + esc(f.name) + '</span><span class="ai-file-size">' + (f.size < 1024 ? f.size + ' B' : (f.size / 1024).toFixed(1) + ' KB') + '</span><button class="ai-file-remove" onclick="removeAIFile(' + i + ')">✕</button></div>';
  }).join('');
  document.getElementById('ai-actions').style.display = aiUploadedFiles.length ? '' : 'none';
  document.getElementById('ai-chat-section').style.display = aiUploadedFiles.length ? '' : 'none';
}

function removeAIFile(i) {
  aiUploadedFiles.splice(i, 1);
  renderUploadedFiles();
}

function handleAIFileDrop(e) {
  e.preventDefault();
  e.stopPropagation();
  var zone = document.getElementById('ai-upload-zone');
  if (zone) zone.classList.remove('dragover');
  var files = Array.from(e.dataTransfer ? e.dataTransfer.files : e.target.files);
  processAIFiles(files);
}

function processAIFiles(files) {
  files.forEach(function (file) {
    if (file.size > 10 * 1024 * 1024) { showToast('File too large: ' + file.name, 'error'); return; }
    if (!isPremium() && getMonthlyUploadCount() >= FREE_AI_UPLOAD_LIMIT) {
      showToast('Free upload limit reached (' + FREE_AI_UPLOAD_LIMIT + '/month). Upgrade to Premium!', 'error');
      return;
    }
    var reader = new FileReader();
    reader.onload = function (ev) {
      var content = ev.target.result;
      aiUploadedFiles.push({ name: file.name, size: file.size, type: file.type, content: content });
      if (!isPremium()) incMonthlyUploadCount();
      updateAIUsageBadge();
      renderUploadedFiles();
    };
    if (file.type === 'text/plain' || file.name.endsWith('.txt')) {
      reader.readAsText(file);
    } else {
      reader.readAsDataURL(file);
    }
  });
}

function aiAction(action) {
  if (!aiUploadedFiles.length) return;
  if (!isPremium() && getDailyQuestionCount() >= FREE_AI_QUESTION_LIMIT) {
    showToast('Free question limit reached (' + FREE_AI_QUESTION_LIMIT + '/day). Upgrade to Premium!', 'error');
    return;
  }
  if (!isPremium()) incDailyQuestionCount();
  updateAIUsageBadge();
  aiCurrentAction = action;
  var file = aiUploadedFiles[0];
  var content = file.content || '';
  if (content.startsWith('data:')) content = '[Binary document: ' + file.name + ']';

  document.getElementById('ai-results-section').style.display = '';
  document.getElementById('ai-results-content').innerHTML = '<div class="ai-loading"><div class="ai-spinner"></div> Analyzing your document...</div>';

  fetch('/api/ai/process', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: action, content: content, fileName: file.name, userId: getOrCreateUserId() })
  }).then(function (r) { return r.json(); }).then(function (data) {
    if (data.success) {
      aiCurrentResult = data.result;
      document.getElementById('ai-results-content').innerHTML =
        '<div class="ai-result-card"><div class="ai-result-header"><span class="ai-result-icon">' + data.icon + '</span><strong>' + data.title + '</strong><span class="ai-result-file">' + esc(data.fileName) + '</span></div><div class="ai-result-body">' + formatAIResult(data.result) + '</div></div>';
    } else {
      if (data.error && data.error.includes('limit reached')) showToast(data.error, 'error');
      document.getElementById('ai-results-content').innerHTML = '<p style="color:var(--danger)">Error: ' + esc(data.error || 'Unknown error') + '</p>';
    }
  }).catch(function () {
    document.getElementById('ai-results-content').innerHTML = '<p style="color:var(--danger)">Network error. Please try again.</p>';
  });
}

function sendAIMessage() {
  var input = document.getElementById('ai-chat-input');
  if (!input || !input.value.trim()) return;
  if (!aiUploadedFiles.length) return;
  if (!isPremium() && getDailyQuestionCount() >= FREE_AI_QUESTION_LIMIT) {
    showToast('Free question limit reached (' + FREE_AI_QUESTION_LIMIT + '/day). Upgrade to Premium!', 'error');
    return;
  }
  if (!isPremium()) incDailyQuestionCount();
  updateAIUsageBadge();

  var question = input.value.trim();
  input.value = '';
  var msgs = document.getElementById('ai-chat-messages');
  msgs.innerHTML += '<div class="ai-msg ai-msg-user"><div class="ai-msg-content">' + esc(question) + '</div></div>';
  msgs.innerHTML += '<div class="ai-msg ai-msg-bot ai-msg-loading"><div class="ai-msg-avatar">🤖</div><div class="ai-msg-content"><div class="ai-spinner-inline"></div></div></div>';
  msgs.scrollTop = msgs.scrollHeight;

  var file = aiUploadedFiles[0];
  var content = file.content || '';
  if (content.startsWith('data:')) content = '[Binary document: ' + file.name + ']';

  fetch('/api/ai/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question: question, content: content, fileName: file.name, userId: getOrCreateUserId() })
  }).then(function (r) { return r.json(); }).then(function (data) {
    var loading = msgs.querySelector('.ai-msg-loading');
    if (loading) loading.remove();
    if (data.success) {
      msgs.innerHTML += '<div class="ai-msg ai-msg-bot"><div class="ai-msg-avatar">🤖</div><div class="ai-msg-content">' + formatAIResult(data.answer) + '</div></div>';
    } else {
      var errMsg = data.error && data.error.includes('limit reached') ? data.error : 'Sorry, something went wrong. Please try again.';
      if (data.error && data.error.includes('limit reached')) showToast(data.error, 'error');
      msgs.innerHTML += '<div class="ai-msg ai-msg-bot"><div class="ai-msg-avatar">🤖</div><div class="ai-msg-content" style="color:var(--danger)">' + esc(errMsg) + '</div></div>';
    }
    msgs.scrollTop = msgs.scrollHeight;
  }).catch(function () {
    var loading = msgs.querySelector('.ai-msg-loading');
    if (loading) loading.remove();
    msgs.innerHTML += '<div class="ai-msg ai-msg-bot"><div class="ai-msg-avatar">🤖</div><div class="ai-msg-content" style="color:var(--danger)">Network error. Please try again.</div></div>';
  });
}

function formatAIResult(text) {
  return text
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>')
    .replace(/^- (.*)/gm, '• $1');
}

function addAIResultToNote() {
  if (!aiCurrentResult) return;
  var title = 'AI: ' + (aiCurrentAction || 'Document Notes');
  document.getElementById('note-title').value = title;
  document.getElementById('note-body').value = aiCurrentResult;
  saveNote();
  closeAIAssistant();
  showToast('AI content saved as note!');
}

function addAIResultToPlan() {
  if (!aiCurrentResult) return;
  var text = aiCurrentResult.slice(0, 200) + (aiCurrentResult.length > 200 ? '...' : '');
  var goals = getGoals();
  goals.push({ id: Date.now(), text: '[AI] ' + text, subjName: '', done: false });
  saveGoals(goals);
  closeAIAssistant();
  showToast('Added to today\'s study plan!');
}

/* ── Payment ──────────────────────────────────────────────────── */
function showPayment(plan) {
  var modal = document.getElementById('payment-modal');
  if (!modal) return;
  var summary = document.getElementById('payment-summary');
  var planLabel = plan === 'quarterly' ? 'Quarterly (₹299/3mo)' : 'Monthly (₹199/mo)';
  var amount = plan === 'quarterly' ? '₹299' : '₹199';
  summary.innerHTML = '<div class="payment-plan-info"><h4>' + planLabel + '</h4><div class="payment-amount">' + amount + '</div><p class="payment-includes">Includes: Unlimited AI uploads, questions, flashcards, quizzes, revision notes, study plans, exam topics</p></div>';
  modal.classList.remove('hidden');
  modal.dataset.plan = plan;
}

function closePayment() {
  var modal = document.getElementById('payment-modal');
  if (modal) modal.classList.add('hidden');
}

function processPayment(gateway) {
  var modal = document.getElementById('payment-modal');
  var plan = modal ? modal.dataset.plan : 'monthly';
  var summary = document.getElementById('payment-summary');
  summary.innerHTML = '<div class="ai-loading"><div class="ai-spinner"></div> Creating ' + gateway + ' order...</div>';

  fetch('/api/payment/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan: plan, gateway: gateway })
  }).then(function (r) { return r.json(); }).then(function (data) {
    if (data.success) {
      summary.innerHTML = '<div class="ai-loading"><div class="ai-spinner"></div> Verifying payment...</div>';
      return fetch('/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: data.orderId, plan: plan })
      });
    }
    throw new Error(data.error || 'Payment failed');
  }).then(function (r) { return r.json(); }).then(function (data) {
    if (data.success && data.verified) {
      localStorage.setItem('sp_premium_expires', data.expiresAt);
      summary.innerHTML = '<div class="payment-success"><div class="payment-success-icon">🎉</div><h4>Welcome to Premium!</h4><p>Your plan is active until ' + new Date(data.expiresAt).toLocaleDateString() + '</p><button class="btn btn-primary" onclick="closePayment()">Start Using AI</button></div>';
      showToast('Welcome to Premium! 🎉');
    }
  }).catch(function () {
    summary.innerHTML = '<p style="color:var(--danger);text-align:center">Payment could not be processed. Please try again.</p><button class="btn btn-ghost btn-full" onclick="closePayment()">Close</button>';
  });
}

/* ═══════════════════════════════════════════════════════════════
   ANALYTICS
═══════════════════════════════════════════════════════════════ */
function renderAnalytics() {
  const subjects = getSubjects();
  const exams = getExams();
  const history = lsGet('daily_history', {});
  const streak = getStreak();

  const totalStudied = subjects.reduce(function (a, s) { return a + (s.studiedMins || 0); }, 0);
  const totalTarget = subjects.reduce(function (a, s) { return a + s.hours * 60; }, 0);
  const overallPct = totalTarget ? Math.min(100, Math.round(totalStudied / totalTarget * 100)) : 0;

  let goalTotal = 0, goalDone = 0;
  for (let i = 0; i < 7; i++) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const g = lsGet('goals_' + d, []);
    goalTotal += g.length;
    goalDone += g.filter(function (x) { return x.done; }).length;
  }
  const goalRate = goalTotal ? Math.round(goalDone / goalTotal * 100) : 0;

  const statsEl = document.getElementById('analytics-stats');
  if (statsEl) {
    statsEl.innerHTML = [
      { icon: '📊', value: overallPct + '%', label: 'Overall Progress' },
      { icon: '⏱', value: (Math.round(totalStudied / 60 * 10) / 10) + 'h', label: 'Total Studied' },
      { icon: '🔥', value: streak.count, label: 'Current Streak' },
      { icon: '🎯', value: goalRate + '%', label: '7-Day Goal Rate' },
    ].map(function (s) {
      return '<div class="stat-card">' +
        '<span class="stat-icon">' + s.icon + '</span>' +
        '<span class="stat-value">' + s.value + '</span>' +
        '<span class="stat-label">' + s.label + '</span>' +
        '</div>';
    }).join('');
  }

  const subjEl = document.getElementById('analytics-subjects');
  if (subjEl) {
    if (!subjects.length) {
      subjEl.innerHTML = '<p class="analytics-empty">No subjects yet.</p>';
    } else {
      const maxMins = Math.max.apply(null, subjects.map(function (s) { return s.studiedMins || 0; }).concat([1]));
      subjEl.innerHTML = '<div class="bar-chart">' + subjects.map(function (s) {
        const pct = Math.round((s.studiedMins || 0) / maxMins * 100);
        const hrs = Math.round((s.studiedMins || 0) / 60 * 10) / 10;
        return '<div class="bar-row">' +
          '<span class="bar-label" title="' + esc(s.name) + '">' + esc(s.name) + '</span>' +
          '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
          '<span class="bar-val">' + hrs + 'h</span>' +
          '</div>';
      }).join('') + '</div>';
    }
  }

  const dailyEl = document.getElementById('analytics-daily');
  if (dailyEl) {
    const days7 = Array.from({ length: 7 }, function (_, i) {
      const d = new Date(Date.now() - (6 - i) * 86400000);
      return { label: d.toLocaleDateString('en-GB', { weekday: 'short' }), iso: d.toISOString().slice(0, 10) };
    });
    const maxMins7 = Math.max.apply(null, days7.map(function (d) { return history[d.iso] || 0; }).concat([1]));
    dailyEl.innerHTML = '<div class="bar-chart">' + days7.map(function (d) {
      const mins = history[d.iso] || 0;
      const pct = Math.round(mins / maxMins7 * 100);
      const hrs = Math.round(mins / 60 * 10) / 10;
      return '<div class="bar-row">' +
        '<span class="bar-label">' + d.label + '</span>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
        '<span class="bar-val">' + hrs + 'h</span>' +
        '</div>';
    }).join('') + '</div>';
  }

  const goalsEl = document.getElementById('analytics-goals');
  if (goalsEl) {
    const days7 = Array.from({ length: 7 }, function (_, i) {
      const d = new Date(Date.now() - (6 - i) * 86400000);
      return { label: d.toLocaleDateString('en-GB', { weekday: 'short' }), iso: d.toISOString().slice(0, 10) };
    });
    goalsEl.innerHTML = '<div class="bar-chart">' + days7.map(function (d) {
      const g = lsGet('goals_' + d.iso, []);
      const done = g.filter(function (x) { return x.done; }).length;
      const pct = g.length ? Math.round(done / g.length * 100) : 0;
      return '<div class="bar-row">' +
        '<span class="bar-label">' + d.label + '</span>' +
        '<div class="bar-track"><div class="bar-fill" style="width:' + pct + '%"></div></div>' +
        '<span class="bar-val">' + pct + '%</span>' +
        '</div>';
    }).join('') + '</div>';
  }

  const examsEl = document.getElementById('analytics-exams');
  if (examsEl) {
    const upcoming = exams.filter(function (ex) { return daysUntil(ex.date) >= 0; });
    if (!upcoming.length) {
      examsEl.innerHTML = '<p class="analytics-empty">No upcoming exams.</p>';
    } else {
      examsEl.innerHTML = '<div class="bar-chart">' + upcoming.slice(0, 6).map(function (ex) {
        const days = daysUntil(ex.date);
        const readiness = Math.min(100, Math.round(days / 30 * 100));
        const cls = days <= 3 ? 'urgent' : days <= 7 ? 'soon' : 'ok';
        const color = days <= 3 ? '#ef4444' : days <= 7 ? '#f59e0b' : '#10b981';
        return '<div class="bar-row">' +
          '<span class="bar-label" title="' + esc(ex.name) + '">' + esc(ex.name) + '</span>' +
          '<div class="bar-track"><div class="bar-fill" style="width:' + readiness + '%;background:' + color + '"></div></div>' +
          '<span class="bar-val exam-countdown ' + cls + '" style="font-size:.78rem">' + days + 'd</span>' +
          '</div>';
      }).join('') + '</div>';
    }
  }
}

/* ═══════════════════════════════════════════════════════════════
   PROFILE
═══════════════════════════════════════════════════════════════ */
function renderProfile() {
  const subjects = getSubjects();
  const exams = getExams();
  const streak = getStreak();

  const avatarEl = document.getElementById('profile-avatar');
  const usernameEl = document.getElementById('profile-username');
  const sinceEl = document.getElementById('profile-since');
  const statsEl = document.getElementById('profile-stats');

  if (avatarEl) avatarEl.textContent = currentUser ? currentUser[0].toUpperCase() : '?';
  if (usernameEl) usernameEl.textContent = currentUser || '';

  const createdAt = lsGet('created_at');
  if (sinceEl) {
    sinceEl.textContent = createdAt
      ? 'Member since ' + new Date(createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
      : 'Member since today';
  }

  const totalStudied = subjects.reduce(function (a, s) { return a + (s.studiedMins || 0); }, 0);
  const studiedHours = Math.round(totalStudied / 60 * 10) / 10;
  const sessions = lsGet('sessions', 0);

  let allGoalsDone = 0;
  for (let i = 0; i < 30; i++) {
    const d = new Date(Date.now() - i * 86400000).toISOString().slice(0, 10);
    const g = lsGet('goals_' + d, []);
    allGoalsDone += g.filter(function (x) { return x.done; }).length;
  }

  if (statsEl) {
    statsEl.innerHTML = [
      { icon: '⏰', value: studiedHours + 'h', label: 'Total Study Hours' },
      { icon: '🔥', value: streak.count, label: 'Current Streak' },
      { icon: '🎯', value: allGoalsDone, label: 'Goals Completed (30d)' },
      { icon: '🚨', value: exams.length, label: 'Exams Added' },
      { icon: '📚', value: subjects.length, label: 'Subjects Created' },
      { icon: '📋', value: sessions, label: 'Study Sessions' },
    ].map(function (s) {
      return '<div class="stat-card">' +
        '<span class="stat-icon">' + s.icon + '</span>' +
        '<span class="stat-value">' + s.value + '</span>' +
        '<span class="stat-label">' + s.label + '</span>' +
        '</div>';
    }).join('');
  }
}

/* ═══════════════════════════════════════════════════════════════
   POMODORO
═══════════════════════════════════════════════════════════════ */
function initPomodoro() {
  const s = getSettings();
  const pw = document.getElementById('pom-work');
  const pb = document.getElementById('pom-break');
  if (pw) pw.value = s.pomodoroWork;
  if (pb) pb.value = s.pomodoroBreak;
  resetPomodoro();
}

function getPomSettings() {
  return {
    work: parseInt(document.getElementById('pom-work').value, 10) || 25,
    brk: parseInt(document.getElementById('pom-break').value, 10) || 5,
    cycles: parseInt(document.getElementById('pom-cycles').value, 10) || 4,
  };
}

function startPomodoro() {
  if (pomodoroRunning) return;
  pomodoroRunning = true;
  pomodoroInterval = setInterval(tickPomodoro, 1000);
  sendNotification('⏰ Pomodoro Started', 'Focus session has begun. Stay focused!');
}

function pausePomodoro() {
  pomodoroRunning = false;
  clearInterval(pomodoroInterval);
}

function resetPomodoro() {
  pausePomodoro();
  pomodoroIsBreak = false;
  pomodoroCycle = 1;
  pomodoroSeconds = getPomSettings().work * 60;
  updatePomDisplay();
}

function tickPomodoro() {
  if (pomodoroSeconds <= 0) {
    const cfg = getPomSettings();
    if (!pomodoroIsBreak) {
      pomodoroIsBreak = true;
      pomodoroSeconds = cfg.brk * 60;
      if (pomodoroCycle >= cfg.cycles) {
        pausePomodoro();
        playBeep();
        sendNotification('🎉 All Done!', 'All Pomodoro cycles complete!');
        alert('🎉 All Pomodoro cycles complete! Great work!');
        resetPomodoro();
        return;
      }
      sendNotification('☕ Break Time!', 'Take a short break. You earned it!');
    } else {
      pomodoroIsBreak = false;
      pomodoroCycle++;
      pomodoroSeconds = cfg.work * 60;
      sendNotification('⏰ Back to Work!', 'Break over. Time to focus again!');
    }
  } else {
    pomodoroSeconds--;
  }
  updatePomDisplay();
}

function updatePomDisplay() {
  const cfg = getPomSettings();
  const m = pad(Math.floor(pomodoroSeconds / 60));
  const s = pad(pomodoroSeconds % 60);
  const dispEl = document.getElementById('pomodoro-display');
  const modeEl = document.getElementById('pomodoro-mode');
  const cycleEl = document.getElementById('pomodoro-cycle');
  if (dispEl) dispEl.textContent = m + ':' + s;
  if (modeEl) modeEl.textContent = pomodoroIsBreak ? 'BREAK' : 'FOCUS';
  if (cycleEl) cycleEl.textContent = 'Cycle ' + pomodoroCycle + ' / ' + cfg.cycles;
}

/* ═══════════════════════════════════════════════════════════════
   AI TIPS
═══════════════════════════════════════════════════════════════ */
function loadTips() {
  const grid = document.getElementById('tips-grid');
  if (!grid) return;
  const shuffled = TIPS.slice().sort(function () { return Math.random() - 0.5; }).slice(0, 6);
  grid.innerHTML = shuffled.map(function (t) {
    return '<div class="tip-card">' +
      '<h4>' + esc(t.title) + '</h4>' +
      '<p>' + esc(t.body) + '</p>' +
      '</div>';
  }).join('');
}

/* ═══════════════════════════════════════════════════════════════
   BOOT
═══════════════════════════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function () {
  initDarkMode();
  initNav();
  initAIUpload();
  const saved = localStorage.getItem('sp_current_user');
  if (saved) {
    currentUser = saved;
    enterDashboard();
  }
});

function initAIUpload() {
  var zone = document.getElementById('ai-upload-zone');
  var input = document.getElementById('ai-file-input');
  if (zone) {
    zone.addEventListener('dragover', function (e) { e.preventDefault(); e.stopPropagation(); zone.classList.add('dragover'); });
    zone.addEventListener('dragleave', function (e) { e.preventDefault(); e.stopPropagation(); zone.classList.remove('dragover'); });
    zone.addEventListener('drop', handleAIFileDrop);
  }
  if (input) {
    input.addEventListener('change', function (e) { processAIFiles(Array.from(e.target.files)); e.target.value = ''; });
  }
}
document.querySelectorAll('.counter').forEach(counter => {
  const updateCounter = () => {
    const target = +counter.getAttribute('data-target');
    const current = +counter.innerText;

    const increment = target / 100;

    if (current < target) {
      counter.innerText = Math.ceil(current + increment);
      setTimeout(updateCounter, 20);
    } else {
      counter.innerText = target.toLocaleString() + '+';
    }
  };

  updateCounter();
});
