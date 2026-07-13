// Modo demo (dev-only): popula o app com dados fictícios, sem Firebase.
// Ative com http://localhost:5173/?demo=1 — nunca incluído em produção.
import { State } from './state';
import type { Ficha, Session, Serie } from './types';
import SEED_FICHAS from './data/seedFichas.json';
import { $ } from './utils/dom';
import { renderDashboard } from './modules/dashboard';
import { renderHistory } from './modules/history';
import { renderProfile } from './modules/profile';
import { fichas } from './modules/fichas';
import { workout } from './modules/workout';

function demoSeries(weight: number, reps: number, count: number, pr = false): Serie[] {
  return Array.from({ length: count }, (_, i) => ({
    id: i, weight, reps, done: true, isPR: pr && i === count - 1
  }));
}

function demoSessions(fichasList: Ficha[]): Session[] {
  const out: Session[] = [];
  const days = [0, 1, 3, 4, 6, 8, 10, 11, 13];
  days.forEach((d, i) => {
    const f = fichasList[i % fichasList.length];
    const start = new Date();
    start.setDate(start.getDate() - d);
    start.setHours(7, 30, 0, 0);
    const end = new Date(start.getTime() + (55 + (i % 4) * 10) * 60000);
    out.push({
      id: `demo-${i}`,
      fichaId: f.id,
      fichaName: f.name,
      fichaEmoji: f.emoji,
      startTime: start,
      endTime: end,
      exercises: f.exercises.slice(0, 5).map((ex, j) => ({
        name: ex.name,
        group: ex.group,
        series: demoSeries(20 + j * 10 + i, 10, ex.sets, i === 0 && j === 0)
      }))
    });
  });
  return out;
}

export function isDemoMode(): boolean {
  return import.meta.env.DEV && new URLSearchParams(location.search).has('demo');
}

export function bootDemo(): void {
  State.user = {
    uid: 'demo',
    displayName: 'Rafael',
    email: 'demo@gymflow.app',
    emailVerified: true
  } as unknown as typeof State.user;

  State.fichas = SEED_FICHAS.map((f, i) => ({ ...f, id: `demo-ficha-${i}` })) as Ficha[];
  State.sessions = demoSessions(State.fichas);

  fichas.render();
  renderDashboard();
  renderHistory();
  renderProfile();

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  $('splash').style.display = 'none';
  if (workout.tryRestore()) {
    console.log('[GymFlow] Modo demo — treino restaurado.');
    return;
  }
  $('screen-dashboard').classList.add('active');
  $('nav-dashboard').classList.add('active');
  $('nav').classList.add('visible');
  $('splash').style.display = 'none';
  console.log('[GymFlow] Modo demo ativo — nenhum dado real é lido ou gravado.');
}
