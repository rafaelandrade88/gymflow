import { getDocs, query, orderBy, limit } from 'firebase/firestore';
import { refFichas, refSessions } from '../services/firebase';
import { State } from '../state';
import type { Ficha, Session } from '../types';
import { fichas } from './fichas';
import { renderDashboard } from './dashboard';
import { renderHistory } from './history';

export async function loadFichas(): Promise<void> {
  const snap = await getDocs(query(refFichas(), orderBy('createdAt', 'desc')));
  State.fichas = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Ficha);
  fichas.render();
}

export async function loadSessions(): Promise<void> {
  const snap = await getDocs(query(refSessions(), orderBy('startTime', 'desc'), limit(60)));
  State.sessions = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Session);
}

export async function loadAll(): Promise<void> {
  await loadFichas();
  await loadSessions();
  renderDashboard();
  renderHistory();
}
