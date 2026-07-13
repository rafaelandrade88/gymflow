import type { FirestoreDate } from '../types';

export function toDate(ts: FirestoreDate): Date {
  if (ts instanceof Date) return ts;
  if (typeof ts === 'object' && 'toDate' in ts) return ts.toDate();
  return new Date(ts);
}

export function fmtDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h > 0) return `${h}h ${String(m % 60).padStart(2, '0')}min`;
  if (m > 0) return `${m} min`;
  return `${s}s`;
}

export function fmtTime(ms: number): string {
  const s = Math.floor(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  return `${String(h).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

export function fmtDate(ts: FirestoreDate | null | undefined): string {
  if (!ts) return '—';
  return toDate(ts).toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateRelative(ts: FirestoreDate): string {
  const d = toDate(ts);
  const diff = Math.floor((Date.now() - d.getTime()) / 86400000);
  if (diff === 0) return 'Hoje';
  if (diff === 1) return 'Ontem';
  if (diff < 7) return `${diff} dias atrás`;
  return fmtDate(ts);
}

export function timeAgo(ts: FirestoreDate | null | undefined): string {
  if (!ts) return '—';
  const diff = Math.floor((Date.now() - toDate(ts).getTime()) / 1000);
  if (diff < 60) return 'agora';
  if (diff < 3600) return `${Math.floor(diff / 60)}min atrás`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h atrás`;
  return fmtDate(ts);
}

/** Volume (kg) e séries concluídas de uma lista de exercícios de sessão. */
export function sessionTotals(exercises: { series?: { done?: boolean; isPR?: boolean; weight: unknown; reps: unknown }[] }[] | undefined) {
  let volume = 0, series = 0, prs = 0;
  (exercises || []).forEach(ex => (ex.series || []).forEach(sr => {
    if (sr.done) {
      series++;
      volume += (parseFloat(String(sr.weight)) || 0) * (parseInt(String(sr.reps)) || 0);
    }
    if (sr.isPR) prs++;
  }));
  return { volume, series, prs };
}
