import { $ } from '../utils/dom';

// Timer de descanso compacto. Conta por timestamp absoluto (endsAt),
// então sobrevive a reload e a abas em background sem drift.
const STORE_KEY = 'gf_rest_timer';

let endsAt = 0;
let total = 0;
let interval: number | null = null;

function fmt(secs: number): string {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function render(): void {
  const remaining = Math.max(0, Math.ceil((endsAt - Date.now()) / 1000));
  $('restBarTime').textContent = fmt(remaining);
  const pct = total > 0 ? Math.max(0, Math.min(1, remaining / total)) : 0;
  $('restBarFill').style.width = `${pct * 100}%`;
  if (remaining <= 0) finish();
}

function finish(): void {
  stopTicking();
  if (navigator.vibrate) navigator.vibrate([200, 100, 200]);
  const bar = $('restBar');
  bar.classList.add('done');
  $('restBarTime').textContent = '0:00';
  setTimeout(() => {
    bar.classList.remove('open', 'done');
  }, 1600);
  localStorage.removeItem(STORE_KEY);
}

function stopTicking(): void {
  if (interval) {
    clearInterval(interval);
    interval = null;
  }
}

function save(): void {
  localStorage.setItem(STORE_KEY, JSON.stringify({ endsAt, total }));
}

function startTicking(): void {
  stopTicking();
  render();
  interval = window.setInterval(render, 250);
}

export const timer = {
  open(secs: number): void {
    total = secs;
    endsAt = Date.now() + secs * 1000;
    save();
    const bar = $('restBar');
    bar.classList.remove('done');
    bar.classList.add('open');
    startTicking();
  },

  add(secs: number): void {
    if (!$('restBar').classList.contains('open')) return;
    endsAt += secs * 1000;
    total += secs;
    save();
    render();
  },

  skip(): void {
    timer.close();
  },

  close(): void {
    stopTicking();
    $('restBar').classList.remove('open', 'done');
    localStorage.removeItem(STORE_KEY);
  },

  /** Reabre a contagem se um descanso estava em andamento (pós-reload). */
  resume(): void {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      const data = JSON.parse(raw) as { endsAt: number; total: number };
      if (data.endsAt > Date.now()) {
        endsAt = data.endsAt;
        total = data.total;
        $('restBar').classList.add('open');
        startTicking();
      } else {
        localStorage.removeItem(STORE_KEY);
      }
    } catch {
      localStorage.removeItem(STORE_KEY);
    }
  }
};
