import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/bebas-neue/400.css';
import './styles/main.css';

import { onAuthStateChanged } from 'firebase/auth';
import { registerSW } from 'virtual:pwa-register';
import { auth } from './services/firebase';
import { State, clearPersistedWorkout } from './state';
import { $ } from './utils/dom';
import { authModule } from './modules/auth';
import { navigate } from './modules/navigation';
import { modal, setupModals } from './modules/modal';
import { loadAll } from './modules/data';
import { fichas } from './modules/fichas';
import { workout } from './modules/workout';
import { timer } from './modules/timer';
import { history, renderHistory } from './modules/history';
import { renderDashboard } from './modules/dashboard';
import { renderProfile, profile } from './modules/profile';
import { community } from './modules/community';
import { sideMenu } from './modules/sideMenu';
import { seedFichasIfEmpty } from './modules/seed';

// ── Atualização do PWA (vite-plugin-pwa) ─────────────────────
const updateSW = registerSW({
  onNeedRefresh() {
    $('updateBanner').style.display = 'flex';
  }
});

const update = {
  apply(): void {
    $('updateBanner').style.display = 'none';
    updateSW(true);
  },
  dismiss(): void {
    $('updateBanner').style.display = 'none';
  }
};

// O HTML usa handlers inline (onclick="App.x.y()"). Expor o agregado
// mantém o markup existente funcionando durante a migração.
(window as any).App = {
  auth: authModule,
  navigate,
  modal,
  fichas,
  workout,
  timer,
  history,
  profile,
  community,
  sideMenu,
  update
};

// ── Boot ─────────────────────────────────────────────────────
import { isDemoMode, bootDemo } from './demo';

setupModals();

if (isDemoMode()) {
  bootDemo();
} else {
onAuthStateChanged(auth, async user => {
  State.user = user;

  if (user) {
    try {
      await seedFichasIfEmpty();
      await loadAll();
    } catch (e) {
      console.error('[Boot] Erro ao carregar dados:', e);
    }
    renderProfile();

    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    $('splash').style.display = 'none';

    // Havia um treino em andamento quando o app foi fechado? Recupera.
    if (!workout.tryRestore()) {
      $('screen-dashboard').classList.add('active');
      $('nav-dashboard').classList.add('active');
      $('nav').classList.add('visible');
    }
  } else {
    State.fichas = [];
    State.sessions = [];
    State.activeWorkout = null;
    clearPersistedWorkout();
    if (State.workoutTimer) clearInterval(State.workoutTimer);

    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    $('screen-auth').classList.add('active');
    $('nav').classList.remove('visible');
    $('splash').style.display = 'none';
  }
});
}

// Enter no formulário de login
$('loginPass').addEventListener('keydown', e => {
  if ((e as KeyboardEvent).key === 'Enter') authModule.login();
});

// Recalcula dashboard/histórico ao voltar do background (datas "hoje/ontem")
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && State.user && !State.activeWorkout) {
    renderDashboard();
    renderHistory();
  }
});
