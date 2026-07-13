import { State } from '../state';
import { $, esc } from '../utils/dom';
import { toDate, fmtDuration, fmtDateRelative, sessionTotals } from '../utils/format';
import { workout } from './workout';

export function renderDashboard(): void {
  const name = State.user?.displayName?.split(' ')[0] || 'Atleta';
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Bom dia' : hour < 18 ? 'Boa tarde' : 'Boa noite';
  $('greetingName').innerHTML = `${greeting}, <span>${esc(name)}</span>`;

  const now = new Date();
  const sessions = State.sessions;

  // Semana atual
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay());
  weekStart.setHours(0, 0, 0, 0);
  $('statTreinosSemana').textContent = String(
    sessions.filter(s => toDate(s.startTime) >= weekStart).length
  );

  // Mês atual
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthSessions = sessions.filter(s => toDate(s.startTime) >= monthStart);
  let totalVolume = 0, totalSeries = 0, prs = 0;
  monthSessions.forEach(s => {
    const t = sessionTotals(s.exercises);
    totalVolume += t.volume;
    totalSeries += t.series;
    prs += t.prs;
  });
  $('statSeries').textContent = String(totalSeries);
  $('statVolume').textContent = (totalVolume / 1000).toFixed(1);
  $('statPRs').textContent = String(prs);

  // Frequência últimos 7 dias
  const streakEl = $('streakDays');
  streakEl.innerHTML = '';
  const dayNames = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];
  let streak = 0;
  for (let i = 6; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(now.getDate() - i);
    day.setHours(0, 0, 0, 0);
    const nextDay = new Date(day);
    nextDay.setDate(day.getDate() + 1);
    const hasTreino = sessions.some(s => {
      const d = toDate(s.startTime);
      return d >= day && d < nextDay;
    });
    const dot = document.createElement('div');
    dot.className = 'streak-dot' + (hasTreino ? ' done' : '') + (i === 0 && !hasTreino ? ' today' : '');
    dot.textContent = dayNames[day.getDay()];
    streakEl.appendChild(dot);
    if (hasTreino) streak++;
  }
  $('streakCount').textContent = String(streak);

  // Último treino
  if (sessions.length > 0) {
    const last = sessions[0];
    $('lastWorkoutEmpty').style.display = 'none';
    $('lastWorkoutInfo').style.display = 'block';
    $('lastWorkoutName').textContent = last.fichaName || 'Treino';
    $('lastWorkoutDate').textContent = fmtDateRelative(last.startTime);
    $('lastWorkoutDuration').textContent = last.endTime && last.startTime
      ? fmtDuration(toDate(last.endTime).getTime() - toDate(last.startTime).getTime())
      : '—';
    const chips = $('lastWorkoutChips');
    chips.innerHTML = '';
    (last.exercises || []).slice(0, 4).forEach(ex => {
      const c = document.createElement('span');
      c.className = 'chip';
      c.textContent = ex.name;
      chips.appendChild(c);
    });
    if ((last.exercises || []).length > 4) {
      const c = document.createElement('span');
      c.className = 'chip accent';
      c.textContent = `+${last.exercises.length - 4}`;
      chips.appendChild(c);
    }
  } else {
    $('lastWorkoutEmpty').style.display = 'block';
    $('lastWorkoutInfo').style.display = 'none';
  }

  // Fichas rápidas
  const quickList = $('quickList');
  quickList.innerHTML = '';
  if (State.fichas.length === 0) {
    quickList.innerHTML = '<div class="text-muted text-center" style="padding:20px">Crie sua primeira ficha na aba Fichas.</div>';
    return;
  }
  State.fichas.slice(0, 4).forEach(f => {
    const item = document.createElement('div');
    item.className = 'quick-item';
    item.onclick = () => workout.start(f.id);
    item.innerHTML = `
      <div class="quick-icon">${esc(f.emoji || '🏋️')}</div>
      <div class="quick-info">
        <div class="quick-name">${esc(f.name)}</div>
        <div class="quick-meta">${(f.exercises || []).length} exercício(s)</div>
      </div>
      <svg class="quick-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>
    `;
    quickList.appendChild(item);
  });
}
