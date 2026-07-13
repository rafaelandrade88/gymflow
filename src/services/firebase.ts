import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore, persistentLocalCache, persistentSingleTabManager,
  collection, doc, type CollectionReference, type DocumentReference
} from 'firebase/firestore';
import { State } from '../state';

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
});

export const auth = getAuth(app);

// Cache offline: fichas e sessões ficam disponíveis (e graváveis) sem rede.
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentSingleTabManager(undefined) })
});

export function uid(): string | undefined {
  return State.user?.uid;
}

export function refFichas(): CollectionReference {
  return collection(db, 'users', uid()!, 'fichas');
}
export function refSessions(): CollectionReference {
  return collection(db, 'users', uid()!, 'sessions');
}
export function refProfile(): DocumentReference {
  return doc(db, 'users', uid()!);
}
export function refCommunity(): CollectionReference {
  return collection(db, 'community');
}
