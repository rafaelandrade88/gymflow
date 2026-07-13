import { $, esc } from '../utils/dom';

export const modal = {
  open(id: string): void {
    $(id).classList.add('open');
    // Foca o primeiro campo/botão para leitores de tela e teclado
    const focusable = $(id).querySelector<HTMLElement>('input, textarea, select, button:not(.modal-handle)');
    if (focusable) setTimeout(() => focusable.focus(), 80);
  },
  close(id: string): void { $(id).classList.remove('open'); }
};

/** Semântica de dialog + fechamento por Esc para todos os modais. */
export function setupModals(): void {
  document.querySelectorAll<HTMLElement>('.modal-overlay').forEach(overlay => {
    const box = overlay.querySelector<HTMLElement>('.modal');
    if (box) {
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-modal', 'true');
    }
    // Toque no backdrop fecha
    overlay.addEventListener('click', e => {
      if (e.target === overlay) overlay.classList.remove('open');
    });
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const open = [...document.querySelectorAll<HTMLElement>('.modal-overlay.open')].pop();
    if (open) open.classList.remove('open');
  });
}

interface ConfirmOptions {
  title: string;
  body?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
}

// Substitui window.confirm()/prompt() por um modal consistente com o app.
export function openConfirm(opts: ConfirmOptions): void {
  $('confirmTitle').textContent = opts.title;
  $('confirmBody').textContent = opts.body || '';
  $('confirmBody').style.display = opts.body ? 'block' : 'none';
  const okBtn = $('confirmOkBtn') as HTMLButtonElement;
  okBtn.textContent = opts.confirmLabel || 'Confirmar';
  okBtn.className = 'btn ' + (opts.danger ? 'btn-danger' : 'btn-primary');
  ($('confirmCancelBtn') as HTMLButtonElement).textContent = opts.cancelLabel || 'Cancelar';
  okBtn.onclick = () => {
    modal.close('confirmModal');
    opts.onConfirm();
  };
  modal.open('confirmModal');
}

interface PromptOptions {
  title: string;
  label?: string;
  value?: string;
  placeholder?: string;
  confirmLabel?: string;
  onConfirm: (value: string) => void;
}

export function openPrompt(opts: PromptOptions): void {
  $('promptTitle').textContent = opts.title;
  $('promptLabel').innerHTML = esc(opts.label || '');
  const input = $('promptInput') as HTMLInputElement;
  input.value = opts.value || '';
  input.placeholder = opts.placeholder || '';
  const okBtn = $('promptOkBtn') as HTMLButtonElement;
  okBtn.textContent = opts.confirmLabel || 'Salvar';
  okBtn.onclick = () => {
    modal.close('promptModal');
    opts.onConfirm(input.value);
  };
  modal.open('promptModal');
  setTimeout(() => input.focus(), 80);
}
