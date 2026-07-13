import type { Timestamp } from 'firebase/firestore';

export interface Exercise {
  name: string;
  group: string;
  sets: number;
  reps: string;
  weight: number;
  obs: string;
}

export interface Ficha {
  id: string;
  name: string;
  emoji: string;
  exercises: Exercise[];
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

export interface Serie {
  id: number;
  weight: string | number;
  reps: string | number;
  done: boolean;
  isPR: boolean;
}

export interface SessionExercise {
  name: string;
  group: string;
  series: Serie[];
}

export type FirestoreDate = Timestamp | string | number | Date;

export interface Session {
  id: string;
  fichaId: string;
  fichaName: string;
  fichaEmoji: string;
  startTime: FirestoreDate;
  endTime: FirestoreDate;
  exercises: SessionExercise[];
}

export interface ActiveWorkout {
  fichaId: string;
  fichaName: string;
  fichaEmoji: string;
  startTime: number; // epoch ms — serializável para localStorage
  exercises: (Exercise & { series: Serie[] })[];
}

export interface Post {
  id: string;
  userId: string;
  userName: string;
  imageUrl?: string;
  caption?: string;
  likes?: string[];
  commentCount?: number;
  createdAt?: Timestamp;
  workout?: {
    fichaName: string;
    fichaEmoji: string;
    duration: string;
    series: number;
    volume: string;
  };
}
