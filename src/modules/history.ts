import { State } from '../state';
import { $, esc } from '../utils/dom';
import { toDate, fmtDate, fmtDuration, fmtDateRelative, sessionTotals } from '../utils/format';
import { modal } from './modal';
import type { Session } from '../types';

function renderChart(): void {
  const chart = $('volumeChart');
  chart.innerHTML = '';
  const now = new Date();
  const days: { day: Date; vol: number; isToday: boolean }[] = [];
  for (let i = 13; i >= 0; i--) {
    const day = new Date(now);
    day.setDate(now.getDate() - i);
    day.setHours(0, 0, 0, 0);
    const next = new Date(day);
    next.setDate(day.getDate() + 1);
    let vol = 0;
    State.sessions.forEach(s => {
      const d = toDate(s.startTime);
      if (d >= day && d < next) vol += sessionTotals(s.exercises).volume;
    });
    days.push({ day, vol, isToday: i === 0 });
  }
  const maxVol = Math.max(...days.map(d => d.vol), 1);
  days.forEach(d => {
    const wrap = document.createElement('div');
    wrap.className = 'chart-bar-wrap';
    const bar = document.createElement('div');
    bar.className = 'chart-bar' + (d.isToday ? ' active' : '');
    bar.style.height = `${Math.max((d.vol / maxVol) * 72, d.vol > 0 ? 8 : 4)}px`;
    const label = document.createElement('div');
    label.className = 'chart-day';
    label.textContent = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'][d.day.getDay()];
    wrap.appendChild(bar);
    wrap.appendChild(label);
    chart.appendChild(wrap);
  });
}

function renderList(): void {
  const list = $('historyList');
  list.innerHTML = '';
  if (State.sessions.length === 0) {
    list.innerHTML = `<div class="history-empty">
      <div class="empty-icon">📋</div>
      <div>Nenhum treino registrado ainda.<br>Inicie uma ficha para começar.</div>
    </div>`;
    return;
  }

  const groups: Record<string, Session[]> = {};
  State.sessions.forEach(s => {
    const key = toDate(s.startTime).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' });
    (groups[key] ||= []).push(s);
  });

  Object.entries(groups).forEach(([month, sessions]) => {
    const group = document.createElement('div');
    group.className = 'history-date-group';
    group.innerHTML = `<div class="history-date-label">${esc(month)}</div>`;

    sessions.forEach(s => {
      const startD = toDate(s.startTime);
      const dur = s.endTime ? fmtDuration(toDate(s.endTime).getTime() - startD.getTime()) : '—';
      const t = sessionTotals(s.exercises);

      const item = document.createElement('div');
      item.className = 'history-item';
      item.onclick = () => history.openDetail(s);
      item.innerHTML = `
        <div class="history-row">
          <div>
            <div class="history-name">${esc(s.fichaEmoji || '🏋️')} ${esc(s.fichaName || 'Treino')} ${t.prs > 0 ? '<span class="pr-badge">🏆 PR</span>' : ''}</div>
            <div style="font-size:12px;color:var(--text-muted)">${fmtDateRelative(s.startTime)} · ${startD.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</div>
          </div>
          <div class="history-duration">${dur}</div>
        </div>
        <div class="history-stats">
          <div class="history-stat"><strong>${t.series}</strong> séries</div>
          <div class="history-stat"><strong>${(t.volume / 1000).toFixed(1)}t</strong> volume</div>
          <div class="history-stat"><strong>${(s.exercises || []).length}</strong> exerc.</div>
        </div>
      `;
      group.appendChild(item);
    });
    list.appendChild(group);
  });
}

export function renderHistory(): void {
  renderChart();
  renderList();
}

export const history = {
  openDetail(s: Session): void {
    State.lastDetailSession = s;
    const startD = toDate(s.startTime);
    const dur = s.endTime ? fmtDuration(toDate(s.endTime).getTime() - startD.getTime()) : '—';

    let html = `
      <div class="detail-header">
        <div class="detail-title">${esc(s.fichaEmoji || '🏋️')} ${esc(s.fichaName || 'Treino')}</div>
        <div class="detail-sub">${fmtDate(s.startTime)} · ${dur}</div>
      </div>
    `;
    (s.exercises || []).forEach(ex => {
      const doneSeries = (ex.series || []).filter(sr => sr.done);
      if (doneSeries.length === 0) return;
      html += `<div class="detail-section">
        <div class="detail-section-title">${esc(ex.name)} <span style="color:var(--text-dim);font-size:10px">${esc(ex.group)}</span></div>
        <div class="detail-series-list">
          ${doneSeries.map(sr => `
            <div class="detail-serie-badge${sr.isPR ? ' pr' : ''}">
              ${sr.isPR ? '🏆 ' : ''}${esc(sr.weight)}kg × ${esc(sr.reps)}
            </div>
          `).join('')}
        </div>
      </div>`;
    });

    $('historyDetailContent').innerHTML = html;
    modal.open('historyDetailModal');
  },

  closeDetail(): void { modal.close('historyDetailModal'); },

  openLast(): void {
    if (State.sessions.length === 0) return;
    history.openDetail(State.sessions[0]);
  }
};
