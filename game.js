'use strict';

// ---------- Pieces ----------
// Each shape is drawn with '#' for a block and '.' for a gap; '/' starts a new row.
// No rotation, so every orientation is its own shape. Weight = how often it appears.
const SHAPE_DEFS = [
  [1, '#'],
  [2, '##'], [2, '#/#'],
  [2, '###'], [2, '#/#/#'],
  [2, '####'], [2, '#/#/#/#'],
  [1, '#####'], [1, '#/#/#/#/#'],
  [3, '##/##'],
  [1, '###/###/###'],
  [1.5, '###/###'], [1.5, '##/##/##'],
  [1.5, '#./##'], [1.5, '.#/##'], [1.5, '##/#.'], [1.5, '##/.#'],
  [1, '#./#./##'], [1, '.#/.#/##'], [1, '##/#./#.'], [1, '##/.#/.#'],
  [1, '###/#..'], [1, '###/..#'], [1, '#../###'], [1, '..#/###'],
  [0.7, '#../#../###'], [0.7, '..#/..#/###'], [0.7, '###/#../#..'], [0.7, '###/..#/..#'],
  [1, '###/.#.'], [1, '.#./###'], [1, '#./##/#.'], [1, '.#/##/.#'],
  [1, '##./.##'], [1, '.##/##.'], [1, '#./##/.#'], [1, '.#/##/#.'],
];

const SHAPES = SHAPE_DEFS.map(([weight, art]) => {
  const rows = art.split('/');
  const cells = [];
  rows.forEach((row, r) => [...row].forEach((ch, c) => { if (ch === '#') cells.push([r, c]); }));
  return { weight, cells, h: rows.length, w: rows[0].length };
});
const TOTAL_WEIGHT = SHAPES.reduce((sum, s) => sum + s.weight, 0);

const N = 7;            // board is N × N
const COLORS = 5;
const SAVE_KEY = 'blox.game';
const BEST_KEY = 'blox.best.7x7'; // separate best for the 7×7 board

// ---------- Game state ----------
// grid: 64 numbers, 0 = empty, 1–5 = block colour
// tray: three pieces { s: shape index, k: colour } or null once placed
// streak: consecutive clears; resets after 3 placements in a row without one
let state;
let best = Number(load(BEST_KEY)) || 0;

function load(key) {
  try { return localStorage.getItem(key); } catch { return null; }
}
function store(key, value) {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable */ }
}
function save() {
  store(SAVE_KEY, JSON.stringify(state));
  store(BEST_KEY, String(best));
}

function newGame() {
  state = { grid: Array(N * N).fill(0), tray: [], score: 0, streak: 0, sinceClear: 0, over: false, newBest: false };
  state.tray = makeTray();
  save();
}

function restore() {
  try {
    const s = JSON.parse(load(SAVE_KEY));
    if (s && Array.isArray(s.grid) && s.grid.length === N * N && Array.isArray(s.tray)) {
      state = s;
      return;
    }
  } catch { /* fall through to a fresh game */ }
  newGame();
}

// ---------- Rules ----------
function canPlace(grid, shape, r, c) {
  if (r < 0 || c < 0 || r + shape.h > N || c + shape.w > N) return false;
  return shape.cells.every(([dr, dc]) => !grid[(r + dr) * N + c + dc]);
}

function fitsAnywhere(grid, shape) {
  for (let r = 0; r <= N - shape.h; r++)
    for (let c = 0; c <= N - shape.w; c++)
      if (canPlace(grid, shape, r, c)) return true;
  return false;
}

function fullLines(grid) {
  const cells = new Set();
  let count = 0;
  for (let i = 0; i < N; i++) {
    let row = true, col = true;
    for (let j = 0; j < N; j++) {
      if (!grid[i * N + j]) row = false;
      if (!grid[j * N + i]) col = false;
    }
    if (row) { count++; for (let j = 0; j < N; j++) cells.add(i * N + j); }
    if (col) { count++; for (let j = 0; j < N; j++) cells.add(j * N + i); }
  }
  return { count, cells };
}

function pickShape() {
  let x = Math.random() * TOTAL_WEIGHT;
  for (let i = 0; i < SHAPES.length; i++) {
    x -= SHAPES[i].weight;
    if (x <= 0) return i;
  }
  return 0;
}

// Deal three pieces, re-rolling a few times so at least one of them fits.
function makeTray() {
  let tray;
  for (let tries = 0; tries < 30; tries++) {
    tray = [0, 1, 2].map(() => ({ s: pickShape(), k: 1 + Math.floor(Math.random() * COLORS) }));
    if (!state || tray.some(p => fitsAnywhere(state.grid, SHAPES[p.s]))) break;
  }
  return tray;
}

function isStuck() {
  return !state.tray.some(p => p && fitsAnywhere(state.grid, SHAPES[p.s]));
}

// Scoring:
//   1 point per block placed
//   lines cleared at once: 1 → 10, 2 → 30, 3 → 60, 4 → 100 … (10 × 1+2+…+n)
//   that line bonus is multiplied by the current streak (×2, ×3 …)
//   emptying the whole board: +300
function place(slot, r, c) {
  const piece = state.tray[slot];
  const shape = SHAPES[piece.s];
  const grid = state.grid;

  const placed = shape.cells.map(([dr, dc]) => (r + dr) * N + c + dc);
  placed.forEach(i => { grid[i] = piece.k; });
  state.tray[slot] = null;

  const lines = fullLines(grid);
  let gained = shape.cells.length;
  let note = '';

  if (lines.count) {
    state.streak = (state.sinceClear < 3 ? state.streak : 0) + 1;
    state.sinceClear = 0;
    gained += 10 * (lines.count * (lines.count + 1) / 2) * state.streak;
    const parts = [];
    if (lines.count > 1) parts.push(`${lines.count} lines`);
    if (state.streak > 1) parts.push(`streak ×${state.streak}`);
    note = parts.join(' · ');
  } else {
    state.sinceClear++;
    if (state.sinceClear >= 3) state.streak = 0;
  }

  const cleared = [...lines.cells].map(i => ({ i, k: grid[i] }));
  lines.cells.forEach(i => { grid[i] = 0; });
  if (lines.count && grid.every(v => !v)) {
    gained += 300;
    note = 'board clear';
  }

  state.score += gained;
  if (state.score > best) {
    best = state.score;
    state.newBest = true;
  }

  if (state.tray.every(p => !p)) state.tray = makeTray();
  state.over = isStuck();
  save();

  // Visuals
  renderBoard(new Set(placed.filter(i => grid[i])));
  renderTray();
  burst(cleared, placed);
  floatText(`+${gained}`, placed);
  if (note) flashNote(note);
  setScore(state.score, true);
  bestEl.textContent = best;
  if (state.over) setTimeout(showOver, 900);
}

// ---------- Rendering ----------
const $ = id => document.getElementById(id);
const boardEl = $('board'), fxEl = $('fx'), trayEl = $('tray');
const scoreEl = $('score'), bestEl = $('best'), noteEl = $('note');
const overEl = $('over'), restartEl = $('restart');
const slots = [...trayEl.children];
let cells = [];
let size = { cell: 40, gap: 5, pad: 8 };

function layout() {
  const w = Math.min(innerWidth - 32, 480);
  let cell = Math.floor(Math.min((w - 16) / (N + 0.85), (innerHeight - 280) / (N + 3.6)));
  cell = Math.max(cell, 22);
  const gap = Math.max(3, Math.round(cell * 0.12));
  const pad = Math.round(gap * 1.6);
  const bw = cell * N + gap * (N - 1) + pad * 2;
  const mgap = Math.max(2, Math.round(gap * 0.6));
  // Tray pieces are half size, but a 5-long bar must still fit in a third of the width
  const mini = Math.min(Math.round(cell * 0.5), Math.floor((bw / 3 - 12 - mgap * 4) / 5));
  size = { cell, gap, pad };
  const root = document.documentElement.style;
  root.setProperty('--n', N);
  root.setProperty('--cell', cell + 'px');
  root.setProperty('--gap', gap + 'px');
  root.setProperty('--pad', pad + 'px');
  root.setProperty('--mini', mini + 'px');
  root.setProperty('--mgap', mgap + 'px');
  root.setProperty('--bw', bw + 'px');
}

function buildBoard() {
  boardEl.innerHTML = '';
  cells = [];
  for (let i = 0; i < N * N; i++) {
    const d = document.createElement('div');
    d.className = 'cell';
    boardEl.appendChild(d);
    cells.push(d);
  }
}

function renderBoard(pop) {
  state.grid.forEach((v, i) => {
    cells[i].className = 'cell' + (v ? ' k' + v : '') + (pop && pop.has(i) ? ' pop' : '');
  });
}

function pieceHTML(shape, k, cls) {
  const filled = new Set(shape.cells.map(([r, c]) => r * 10 + c));
  let html = `<div class="${cls}" style="grid-template-columns:repeat(${shape.w},auto)">`;
  for (let r = 0; r < shape.h; r++)
    for (let c = 0; c < shape.w; c++)
      html += filled.has(r * 10 + c) ? `<i class="b k${k}"></i>` : '<i class="b"></i>';
  return html + '</div>';
}

function renderTray() {
  state.tray.forEach((p, i) => {
    const slot = slots[i];
    slot.classList.remove('lifted');
    if (!p) { slot.innerHTML = ''; slot.classList.remove('nofit'); return; }
    const key = p.s + ':' + p.k;
    if (slot.dataset.key !== key || !slot.firstChild) {
      slot.innerHTML = pieceHTML(SHAPES[p.s], p.k, 'mini');
      slot.firstChild.style.animationDelay = (i * 60) + 'ms';
    }
    slot.dataset.key = key;
    slot.classList.toggle('nofit', !fitsAnywhere(state.grid, SHAPES[p.s]));
  });
  state.tray.forEach((p, i) => { if (!p) slots[i].dataset.key = ''; });
}

// Shows where the piece will land, and highlights lines it would complete
function showPreview(piece, r, c) {
  renderBoard();
  const shape = SHAPES[piece.s];
  const ghost = shape.cells.map(([dr, dc]) => (r + dr) * N + c + dc);
  const trial = state.grid.slice();
  ghost.forEach(i => { trial[i] = piece.k; });
  fullLines(trial).cells.forEach(i => { cells[i].className = `cell k${piece.k} hint`; });
  ghost.forEach(i => { cells[i].className = `cell k${piece.k} ghost`; });
}

function cellPos(i) {
  const pitch = size.cell + size.gap;
  return { x: size.pad + (i % N) * pitch, y: size.pad + Math.floor(i / N) * pitch };
}

function centre(indices) {
  const pts = indices.map(cellPos);
  const half = size.cell / 2;
  return {
    x: pts.reduce((s, p) => s + p.x, 0) / pts.length + half,
    y: pts.reduce((s, p) => s + p.y, 0) / pts.length + half,
  };
}

// Cleared blocks shrink away, rippling outward from where you placed the piece
function burst(cleared, placed) {
  if (!cleared.length) return;
  const from = centre(placed);
  cleared.forEach(({ i, k }) => {
    const p = cellPos(i);
    const d = document.createElement('div');
    d.className = 'fxcell k' + k;
    d.style.left = p.x + 'px';
    d.style.top = p.y + 'px';
    d.style.animationDelay = Math.hypot(p.x - from.x, p.y - from.y) * 0.9 + 'ms';
    fxEl.appendChild(d);
    setTimeout(() => d.remove(), 1000);
  });
}

function floatText(text, placed) {
  const p = centre(placed);
  const d = document.createElement('div');
  d.className = 'float';
  d.textContent = text;
  d.style.left = p.x + 'px';
  d.style.top = p.y + 'px';
  fxEl.appendChild(d);
  setTimeout(() => d.remove(), 1000);
}

let noteTimer;
function flashNote(text) {
  noteEl.textContent = text;
  noteEl.classList.add('on');
  clearTimeout(noteTimer);
  noteTimer = setTimeout(() => noteEl.classList.remove('on'), 1600);
}

// Score counts up gently instead of jumping
let shownScore = 0, scoreFrame;
function setScore(value, animate) {
  cancelAnimationFrame(scoreFrame);
  if (!animate) { shownScore = value; scoreEl.textContent = value; return; }
  const from = shownScore, t0 = performance.now();
  const step = t => {
    const k = Math.min(1, (t - t0) / 500);
    shownScore = Math.round(from + (value - from) * (1 - Math.pow(1 - k, 3)));
    scoreEl.textContent = shownScore;
    if (k < 1) scoreFrame = requestAnimationFrame(step);
  };
  scoreFrame = requestAnimationFrame(step);
}

function showOver() {
  if (!state.over) return;
  $('final').textContent = state.score;
  $('overbest').textContent = state.newBest && state.score > 0 ? 'new best' : '';
  overEl.hidden = false;
}

function renderAll() {
  renderBoard();
  renderTray();
  setScore(state.score, false);
  bestEl.textContent = best;
  overEl.hidden = true;
  if (state.over) showOver();
}

// ---------- Dragging ----------
// The piece travels this much further than your finger (1.2 = 20% faster)
const DRAG_SPEED = 1.2;
let drag = null;

trayEl.addEventListener('pointerdown', e => {
  const slot = e.target.closest('.slot');
  if (!slot || drag || state.over) return;
  const i = Number(slot.dataset.i);
  const piece = state.tray[i];
  if (!piece) return;
  e.preventDefault();

  const shape = SHAPES[piece.s];
  const el = document.createElement('div');
  el.className = 'drag';
  el.innerHTML = pieceHTML(shape, piece.k, 'drag-inner');
  document.body.appendChild(el);

  drag = {
    id: e.pointerId, i, piece, shape, el, slot, r: null, c: null,
    x0: e.clientX, y0: e.clientY,
    w: shape.w * size.cell + (shape.w - 1) * size.gap,
    h: shape.h * size.cell + (shape.h - 1) * size.gap,
  };
  slot.classList.add('lifted');
  moveDrag(e.clientX, e.clientY);
});

function moveDrag(x, y) {
  const d = drag;
  // The piece floats above your finger so you can see where it's going,
  // and moves DRAG_SPEED times as far as your finger does
  const px = d.x0 + (x - d.x0) * DRAG_SPEED;
  const py = d.y0 + (y - d.y0) * DRAG_SPEED;
  const left = px - d.w / 2;
  const top = py - d.h - size.cell * 1.1;
  d.el.style.transform = `translate3d(${left}px,${top}px,0)`;

  const b = boardEl.getBoundingClientRect();
  const pitch = size.cell + size.gap;
  const c = Math.round((left - b.left - size.pad) / pitch);
  const r = Math.round((top - b.top - size.pad) / pitch);

  if (canPlace(state.grid, d.shape, r, c)) {
    if (r !== d.r || c !== d.c) {
      d.r = r; d.c = c;
      showPreview(d.piece, r, c);
    }
  } else if (d.r !== null) {
    d.r = d.c = null;
    renderBoard();
  }
}

function endDrag(e, cancelled) {
  if (!drag || e.pointerId !== drag.id) return;
  const d = drag;
  drag = null;

  if (!cancelled && d.r !== null) {
    d.el.remove();
    place(d.i, d.r, d.c);
    return;
  }
  // Not a valid spot: glide back to the tray
  renderBoard();
  const s = d.slot.getBoundingClientRect();
  d.el.classList.add('back');
  d.el.style.transform =
    `translate3d(${s.left + s.width / 2 - d.w / 2}px,${s.top + s.height / 2 - d.h / 2}px,0) scale(0.5)`;
  setTimeout(() => { d.el.remove(); d.slot.classList.remove('lifted'); }, 220);
}

document.addEventListener('pointermove', e => {
  if (drag && e.pointerId === drag.id) { e.preventDefault(); moveDrag(e.clientX, e.clientY); }
}, { passive: false });
document.addEventListener('pointerup', e => endDrag(e, false));
document.addEventListener('pointercancel', e => endDrag(e, true));

// ---------- Buttons ----------
$('again').addEventListener('click', () => { newGame(); renderAll(); });

// "new game" needs two taps so you can't wipe a run by accident
let restartArmed = null;
restartEl.addEventListener('click', () => {
  if (restartArmed) {
    clearTimeout(restartArmed);
    restartArmed = null;
    restartEl.textContent = 'new game';
    newGame();
    renderAll();
  } else {
    restartEl.textContent = 'tap again to restart';
    restartArmed = setTimeout(() => {
      restartArmed = null;
      restartEl.textContent = 'new game';
    }, 2500);
  }
});

// Stop iOS pinch-zoom and save whenever the app goes to the background
document.addEventListener('gesturestart', e => e.preventDefault());
document.addEventListener('visibilitychange', () => { if (document.hidden) save(); });
addEventListener('resize', layout);

// ---------- Start ----------
layout();
buildBoard();
restore();
renderAll();

if ('serviceWorker' in navigator) {
  // When a new version takes over, reload once to show it (the game is already saved)
  const hadController = !!navigator.serviceWorker.controller;
  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });
  navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then(reg => {
    // iPhone often resumes the app rather than restarting it, so check for updates on return
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) reg.update().catch(() => {});
    });
  }).catch(() => {});
}
