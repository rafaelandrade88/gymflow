import type { User } from 'firebase/auth';
import type { ActiveWorkout, Ficha, Session } from './types';

export const State: {
  user: User | null;
  fichas: Ficha[];
  sessions: Session[];
  activeWorkout: ActiveWorkout | null;
  workoutTimer: number | null;
  selectedEmoji: string;
  editingFichaId: string | null;
  pendingFichaId: string | null;
  lastDetailSession: Session | null;
} = {
  user: null,
  fichas: [],
  sessions: [],
  activeWorkout: null,
  workoutTimer: null,
  selectedEmoji: '🏋️',
  editingFichaId: null,
  pendingFichaId: null,
  lastDetailSession: null
};

// ── Persistência do treino ativo ─────────────────────────────
// Se o PWA for recarregado/morto no meio do treino, nada se perde.
const WORKOUT_KEY = 'gf_active_workout';

export function persistActiveWorkout(): void {
  if (State.activeWorkout) {
    localStorage.setItem(WORKOUT_KEY, JSON.stringify(State.activeWorkout));
  } else {
    localStorage.removeItem(WORKOUT_KEY);
  }
}

export function restoreActiveWorkout(): ActiveWorkout | null {
  try {
    const raw = localStorage.getItem(WORKOUT_KEY);
    if (!raw) return null;
    const w = JSON.parse(raw) as ActiveWorkout;
    if (!w.fichaId || !Array.isArray(w.exercises)) return null;
    return w;
  } catch {
    return null;
  }
}

export function clearPersistedWorkout(): void {
  localStorage.removeItem(WORKOUT_KEY);
}
