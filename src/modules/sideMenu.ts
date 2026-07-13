import { State } from '../state';
import { $ } from '../utils/dom';
import { navigate, type Screen } from './navigation';
import { APP_VERSION } from '../version';

export const sideMenu = {
  open(): void {
    $('sideMenuUser').textContent = State.user?.email || '';
    const badge = document.getElementById('appVersionBadge');
    if (badge) badge.textContent = 'v' + APP_VERSION;
    $('sideMenu').classList.add('open');
    $('sideMenuOverlay').classList.add('open');
  },
  close(): void {
    $('sideMenu').classList.remove('open');
    $('sideMenuOverlay').classList.remove('open');
  },
  go(screen: Screen): void {
    sideMenu.close();
    setTimeout(() => navigate(screen), 180);
  }
};
