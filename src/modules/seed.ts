import { getDocs, query, limit, writeBatch, doc, serverTimestamp } from 'firebase/firestore';
import { db, refFichas } from '../services/firebase';
import SEED_FICHAS from '../data/seedFichas.json';

/** Popula as fichas iniciais apenas no primeiro acesso (coleção vazia). */
export async function seedFichasIfEmpty(): Promise<void> {
  const snap = await getDocs(query(refFichas(), limit(1)));
  if (!snap.empty) return;

  const batch = writeBatch(db);
  const now = serverTimestamp();
  SEED_FICHAS.forEach(ficha => {
    batch.set(doc(refFichas()), { ...ficha, createdAt: now, updatedAt: now });
  });
  await batch.commit();
  console.log('[GymFlow] Fichas iniciais semeadas.');
}
