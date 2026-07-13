export function $(id: string): HTMLElement {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Elemento #${id} não encontrado`);
  return el;
}

export function $maybe(id: string): HTMLElement | null {
  return document.getElementById(id);
}

export function inputValue(id: string): string {
  return ($(id) as HTMLInputElement).value;
}

/** Escapa conteúdo controlado pelo usuário antes de interpolar em innerHTML. */
export function esc(s: unknown): string {
  return String(s ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function toast(msg: string, type: 'info' | 'success' | 'error' = 'info'): void {
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = msg;
  $('toast-container').appendChild(el);
  setTimeout(() => el.remove(), 2600);
}
