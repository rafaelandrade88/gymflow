import { addDoc, Timestamp, serverTimestamp } from 'firebase/firestore';
import { refSessions } from '../services/firebase';
import { State, persistActiveWorkout, clearPersistedWorkout, restoreActiveWorkout } from '../state';
import { $, esc, toast } from '../utils/dom';
import { fmtTime } from '../utils/format';
import { modal } from './modal';
import { navigate } from './navigation';
import { timer } from './timer';
import { loadSessions } from './data';
import { renderDashboard } from './dashboard';
import { renderHistory } from './history';

function startElapsedTicker(): void {
  if (State.workoutTimer) clearInterval(State.workoutTimer);
  State.workoutTimer = window.setInterval(() => {
    const el = document.getElementById('workoutElapsed');
    if (el && State.activeWorkout) {
      el.textContent = fmtTime(Date.now() - State.activeWorkout.startTime);
    }
  }, 1000);
}

// ── Wake Lock: a tela não apaga durante o treino ─────────────
let wakeLock: { release(): Promise<void> } | null = null;

async function acquireWakeLock(): Promise<void> {
  try {
    wakeLock = await (navigator as any).wakeLock?.request('screen') ?? null;
  } catch { /* não suportado ou negado — segue sem */ }
}

function releaseWakeLock(): void {
  wakeLock?.release().catch(() => {});
  wakeLock = null;
}

// O SO solta o wake lock quando o app vai para background; readquire ao voltar
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && State.activeWorkout) acquireWakeLock();
});

/** Séries concluídas do treino mais recente que contém este exercício. */
function lastPerformance(exName: string) {
  for (const s of State.sessions) {
    const ex = (s.exercises || []).find(e => e.name === exName);
    if (ex) {
      const done = (ex.series || []).filter(r => r.done);
      if (done.length > 0) return done;
    }
  }
  return null;
}

function serieRowHtml(
  exIdx: number, srIdx: number, sr: { done: boolean }, repsTarget: string,
  prev: { weight: unknown; reps: unknown } | null
): string {
  const prevTxt = prev ? `${esc(prev.weight)}kg × ${esc(prev.reps)}` : '';
  return `
    <td>
      <span class="series-num">Série ${srIdx + 1}</span>
      ${prevTxt ? `<span class="series-prev" title="Último treino">${prevTxt}</span>` : ''}
    </td>
    <td><input class="series-input" type="number" inputmode="decimal" placeholder="kg"
      data-ex="${exIdx}" data-sr="${srIdx}" data-field="weight" /></td>
    <td><input class="series-input" type="text" inputmode="numeric" placeholder="${esc(repsTarget) || 'reps'}"
      data-ex="${exIdx}" data-sr="${srIdx}" data-field="reps" /></td>
    <td>
      <button class="series-check${sr.done ? ' done' : ''}" id="chk-${exIdx}-${srIdx}"
        data-ex="${exIdx}" data-sr="${srIdx}" aria-label="Concluir série ${srIdx + 1}">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" width="18" height="18"><polyline points="20 6 9 17 4 12"/></svg>
      </button>
    </td>
  `;
}

function updateProgress(): void {
  const w = State.activeWorkout;
  const el = document.getElementById('workoutProgress');
  if (!w || !el) return;
  let done = 0, total = 0;
  w.exercises.forEach(ex => ex.series.forEach(sr => { total++; if (sr.done) done++; }));
  el.textContent = `${done}/${total} séries`;
}

function wireRow(tr: HTMLTableRowElement, exIdx: number, srIdx: number): void {
  const sr = State.activeWorkout!.exercises[exIdx].series[srIdx];
  tr.querySelectorAll<HTMLInputElement>('.series-input').forEach(input => {
    input.value = String(sr[input.dataset.field as 'weight' | 'reps'] ?? '');
    input.onclick = () => input.select();
    input.onchange = () => {
      workout.updateSerie(exIdx, srIdx, input.dataset.field as 'weight' | 'reps', input.value);
    };
  });
  tr.querySelector<HTMLButtonElement>('.series-check')!.onclick = () => workout.toggleSerie(exIdx, srIdx);
}

export const workout = {
  start(fichaId: string): void {
    const ficha = State.fichas.find(f => f.id === fichaId);
    if (!ficha) return toast('Ficha não encontrada.', 'error');
    State.pendingFichaId = fichaId;

    $('workoutConfirmTitle').textContent = `${ficha.emoji || '💪'} ${ficha.name}`;
    const exList = $('workoutConfirmExercises');
    exList.innerHTML = '';
    (ficha.exercises || []).forEach((ex, i) => {
      const el = document.createElement('div');
      el.className = 'workout-confirm-ex';
      el.innerHTML = `<div class="workout-confirm-num">${i + 1}</div>`
        + `<div><div class="workout-confirm-name">${esc(ex.name)}</div>`
        + `<div class="workout-confirm-meta">${esc(ex.sets)} séries · ${esc(ex.reps)} reps`
        + (ex.weight ? ` · ${esc(ex.weight)}kg` : '') + `</div></div>`;
      exList.appendChild(el);
    });
    modal.open('workoutConfirmModal');
  },

  confirmStart(): void {
    modal.close('workoutConfirmModal');
    const ficha = State.fichas.find(f => f.id === State.pendingFichaId);
    if (!ficha) return toast('Ficha não encontrada.', 'error');

    State.activeWorkout = {
      fichaId: ficha.id,
      fichaName: ficha.name,
      fichaEmoji: ficha.emoji || '🏋️',
      startTime: Date.now(),
      exercises: ficha.exercises.map(ex => ({
        ...ex,
        series: Array.from({ length: ex.sets }, (_, i) => ({
          id: i,
          weight: ex.weight || '',
          // Reps ficam vazias: a meta (ex.reps) vira placeholder — o valor
          // digitado é o resultado real, não a intenção.
          reps: '',
          done: false,
          isPR: false
        }))
      }))
    };
    persistActiveWorkout();
    workout.render();
    navigate('workout');
    startElapsedTicker();
    acquireWakeLock();
  },

  /** Retoma treino interrompido (refresh, app morto pelo SO etc.). */
  tryRestore(): boolean {
    const saved = restoreActiveWorkout();
    if (!saved) return false;
    State.activeWorkout = saved;
    workout.render();
    navigate('workout');
    startElapsedTicker();
    acquireWakeLock();
    timer.resume();
    toast('Treino em andamento recuperado 💪', 'info');
    return true;
  },

  render(): void {
    const w = State.activeWorkout;
    if (!w) return;
    $('workoutActiveName').textContent = `${w.fichaEmoji} ${w.fichaName}`;
    const body = $('workoutBody');
    body.innerHTML = '';

    w.exercises.forEach((ex, exIdx) => {
      const block = document.createElement('div');
      block.className = 'exercise-block';
      block.innerHTML = `
        <div class="exercise-block-header">
          <div class="exercise-block-name">${esc(ex.name)}</div>
          <span class="exercise-block-group">${esc(ex.group)}</span>
        </div>
        <table class="series-table">
          <thead><tr>
            <th style="width:30%">Série</th><th>kg</th><th>Reps</th><th aria-label="Concluída">✓</th>
          </tr></thead>
          <tbody id="tbody-${exIdx}"></tbody>
        </table>
        <button class="add-series-btn">+ Adicionar série</button>
      `;
      const tbody = block.querySelector('tbody')!;
      const prevSeries = lastPerformance(ex.name);
      ex.series.forEach((sr, srIdx) => {
        const tr = document.createElement('tr');
        tr.className = 'series-row' + (sr.done ? ' done-row' : '');
        tr.id = `sr-${exIdx}-${srIdx}`;
        tr.innerHTML = serieRowHtml(exIdx, srIdx, sr, String(ex.reps || ''), prevSeries?.[srIdx] ?? null);
        wireRow(tr, exIdx, srIdx);
        tbody.appendChild(tr);
      });
      block.querySelector<HTMLButtonElement>('.add-series-btn')!.onclick = () => workout.addSerie(exIdx);
      body.appendChild(block);
    });
    updateProgress();
  },

  updateSerie(exIdx: number, srIdx: number, field: 'weight' | 'reps', val: string): void {
    State.activeWorkout!.exercises[exIdx].series[srIdx][field] = val;
    persistActiveWorkout();
  },

  toggleSerie(exIdx: number, srIdx: number): void {
    const sr = State.activeWorkout!.exercises[exIdx].series[srIdx];
    sr.done = !sr.done;

    const row = $(`sr-${exIdx}-${srIdx}`);
    const chk = $(`chk-${exIdx}-${srIdx}`);
    if (sr.done) {
      row.classList.add('done-row');
      chk.classList.add('done');
      if (navigator.vibrate) navigator.vibrate(30);
      checkPR(exIdx, srIdx);
      timer.open(60);
    } else {
      row.classList.remove('done-row');
      chk.classList.remove('done');
      sr.isPR = false;
    }
    updateProgress();
    persistActiveWorkout();
  },

  addSerie(exIdx: number): void {
    const ex = State.activeWorkout!.exercises[exIdx];
    const last = ex.series[ex.series.length - 1];
    ex.series.push({ id: ex.series.length, weight: last?.weight || '', reps: last?.reps || '', done: false, isPR: false });
    persistActiveWorkout();

    const srIdx = ex.series.length - 1;
    const tr = document.createElement('tr');
    tr.className = 'series-row';
    tr.id = `sr-${exIdx}-${srIdx}`;
    const prevSeries = lastPerformance(ex.name);
    tr.innerHTML = serieRowHtml(exIdx, srIdx, ex.series[srIdx], String(ex.reps || ''), prevSeries?.[srIdx] ?? null);
    wireRow(tr, exIdx, srIdx);
    $(`tbody-${exIdx}`).appendChild(tr);
    updateProgress();
  },

  confirmCancel(): void { modal.open('cancelWorkoutModal'); },

  cancel(): void {
    modal.close('cancelWorkoutModal');
    cleanup();
    $('nav').classList.add('visible');
    navigate('dashboard');
  },

  async finish(): Promise<void> {
    const w = State.activeWorkout;
    if (!w) return;

    let doneSeries = 0;
    w.exercises.forEach(ex => ex.series.forEach(sr => { if (sr.done) doneSeries++; }));
    if (doneSeries === 0) {
      return toast('Complete ao menos uma série antes de finalizar.', 'error');
    }

    try {
      await addDoc(refSessions(), {
        fichaId: w.fichaId,
        fichaName: w.fichaName,
        fichaEmoji: w.fichaEmoji,
        startTime: Timestamp.fromMillis(w.startTime),
        endTime: Timestamp.now(),
        exercises: w.exercises.map(ex => ({ name: ex.name, group: ex.group, series: ex.series })),
        createdAt: serverTimestamp()
      });
      toast('Treino salvo! 💪', 'success');
      cleanup();
      $('nav').classList.add('visible');
      await loadSessions();
      renderDashboard();
      renderHistory();
      navigate('dashboard');
    } catch (e) {
      toast('Erro ao salvar treino.', 'error');
      console.error(e);
    }
  }
};

function checkPR(exIdx: number, srIdx: number): void {
  const ex = State.activeWorkout!.exercises[exIdx];
  const sr = ex.series[srIdx];
  const weight = parseFloat(String(sr.weight)) || 0;
  const reps = parseInt(String(sr.reps)) || 0;
  const volume = weight * reps;
  if (volume === 0) return;

  let maxVol = 0;
  State.sessions.forEach(s => {
    (s.exercises || []).filter(e => e.name === ex.name).forEach(e => {
      (e.series || []).filter(r => r.done).forEach(r => {
        maxVol = Math.max(maxVol, (parseFloat(String(r.weight)) || 0) * (parseInt(String(r.reps)) || 0));
      });
    });
  });

  if (volume > maxVol && maxVol > 0) {
    sr.isPR = true;
    toast(`🏆 PR em ${ex.name}! ${weight}kg × ${reps} reps`, 'success');
  }
}

function cleanup(): void {
  if (State.workoutTimer) clearInterval(State.workoutTimer);
  State.activeWorkout = null;
  clearPersistedWorkout();
  timer.close();
  releaseWakeLock();
}
