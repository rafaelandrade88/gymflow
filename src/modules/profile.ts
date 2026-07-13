import { updateProfile } from 'firebase/auth';
import { setDoc } from 'firebase/firestore';
import { refProfile } from '../services/firebase';
import { State } from '../state';
import { $, toast } from '../utils/dom';
import { sessionTotals } from '../utils/format';
import { openPrompt } from './modal';
import { renderDashboard } from './dashboard';

export function renderProfile(): void {
  const u = State.user;
  const name = u?.displayName || 'Atleta';
  $('profileName').textContent = name;
  $('profileEmail').textContent = u?.email || '—';
  $('profileAvatar').textContent = name.charAt(0).toUpperCase();

  $('psTotalTreinos').textContent = String(State.sessions.length);
  let totalSr = 0, totalPR = 0;
  State.sessions.forEach(s => {
    const t = sessionTotals(s.exercises);
    totalSr += t.series;
    totalPR += t.prs;
  });
  $('psTotalSeries').textContent = String(totalSr);
  $('psTotalPR').textContent = String(totalPR);
}

export const profile = {
  editName(): void {
    openPrompt({
      title: 'Editar nome',
      label: 'Como você quer ser chamado?',
      value: State.user?.displayName || '',
      onConfirm: async (novo) => {
        if (!novo.trim() || !State.user) return;
        await updateProfile(State.user, { displayName: novo.trim() });
        await setDoc(refProfile(), { name: novo.trim() }, { merge: true });
        toast('Nome atualizado!', 'success');
        renderProfile();
        renderDashboard();
      }
    });
  }
};
