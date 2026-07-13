import { State } from '../state';
import { $, $maybe } from '../utils/dom';
import { community } from './community';

export type Screen = 'auth' | 'dashboard' | 'fichas' | 'workout' | 'community' | 'history' | 'profile';

export function navigate(screen: Screen): void {
  if (screen === 'workout' && !State.activeWorkout) return;

  const prev = document.querySelector('.screen.active')?.id?.replace('screen-', '');
  if (prev === 'community' && screen !== 'community') community.stopFeed();

  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  $maybe(`screen-${screen}`)?.classList.add('active');
  $maybe(`nav-${screen}`)?.classList.add('active');

  if (screen === 'workout') {
    $('nav').classList.remove('visible');
  } else if (State.user) {
    $('nav').classList.add('visible');
  }

  if (screen === 'community') community.startFeed();

  document.querySelector('.screen.active')?.scrollTo(0, 0);
}
