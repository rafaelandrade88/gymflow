import { addDoc, updateDoc, deleteDoc, doc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db, refFichas } from '../services/firebase';
import { State } from '../state';
import type { Exercise } from '../types';
import { $, esc, toast, inputValue } from '../utils/dom';
import { modal, openConfirm } from './modal';
import { loadFichas } from './data';
import { renderDashboard } from './dashboard';
import { workout } from './workout';
import { analyzePdfWithAI, type PdfFicha } from '../services/pdfImport';
import { icon } from '../utils/icons';

const EMOJIS = ['🏋️', '💪', '🦵', '🫀', '🤸', '🏃', '⚡', '🔥', '🥊', '🎯'];
const GROUPS = ['Peito', 'Costas', 'Ombro', 'Bíceps', 'Tríceps', 'Perna', 'Glúteo', 'Abdômen', 'Cardio', 'Outro'];

let pdfFile: File | null = null;
let pdfFichas: PdfFicha[] = [];

export const fichas = {
  render(): void {
    const list = $('fichaList');
    list.innerHTML = '';
    if (State.fichas.length === 0) {
      list.innerHTML = '<div class="text-muted text-center" style="padding:40px 20px">Nenhuma ficha ainda.<br>Crie a primeira!</div>';
      return;
    }
    State.fichas.forEach(f => {
      const exCount = (f.exercises || []).length;
      const card = document.createElement('div');
      card.className = 'ficha-card';
      card.innerHTML = `
        <button class="ficha-header" data-action="toggle" aria-expanded="false">
          <div class="ficha-emoji">${esc(f.emoji || '🏋️')}</div>
          <div class="ficha-info">
            <div class="ficha-name">${esc(f.name)}</div>
            <div class="ficha-meta">${exCount} ${exCount === 1 ? 'exercício' : 'exercícios'}</div>
          </div>
          <span class="ficha-chevron">${icon('chevron-down')}</span>
        </button>
        <div class="ficha-body">
          ${(f.exercises || []).map((ex, i) => `
            <div class="exercicio-item">
              <div class="exercicio-num">${i + 1}</div>
              <div>
                <div class="exercicio-name">${esc(ex.name)}</div>
                <div class="exercicio-meta">${esc(ex.sets)}x${esc(ex.reps)} — ${esc(ex.group)}</div>
              </div>
            </div>
          `).join('')}
        </div>
        <div class="ficha-footer">
          <button class="btn btn-primary ficha-start" data-action="start">${icon('play', 16)} Iniciar treino</button>
          <button class="ficha-icon-btn" data-action="edit" aria-label="Editar ficha">${icon('pencil')}</button>
          <button class="ficha-icon-btn danger" data-action="delete" aria-label="Deletar ficha">${icon('trash')}</button>
        </div>
      `;
      const header = card.querySelector<HTMLButtonElement>('[data-action="toggle"]')!;
      header.onclick = () => {
        const open = card.querySelector('.ficha-body')!.classList.toggle('open');
        card.classList.toggle('open', open);
        header.setAttribute('aria-expanded', String(open));
      };
      card.querySelector<HTMLElement>('[data-action="start"]')!.onclick = () => workout.start(f.id);
      card.querySelector<HTMLElement>('[data-action="edit"]')!.onclick = () => fichas.openModal(f.id);
      card.querySelector<HTMLElement>('[data-action="delete"]')!.onclick = () => fichas.delete(f.id);
      list.appendChild(card);
    });
  },

  openModal(fichaId: string | null = null): void {
    State.editingFichaId = fichaId;
    $('fichaModalTitle').textContent = fichaId ? 'Editar Ficha' : 'Nova Ficha';

    const emojiGroup = $('fichaEmojiGroup');
    emojiGroup.innerHTML = '';
    EMOJIS.forEach(e => {
      const tag = document.createElement('span');
      tag.className = 'tag' + (e === State.selectedEmoji ? ' selected' : '');
      tag.textContent = e;
      tag.onclick = () => {
        State.selectedEmoji = e;
        emojiGroup.querySelectorAll('.tag').forEach(t => t.classList.remove('selected'));
        tag.classList.add('selected');
      };
      emojiGroup.appendChild(tag);
    });

    const nameInput = $('fichaName') as HTMLInputElement;
    $('exerciciosEditor').innerHTML = '';
    if (fichaId) {
      const f = State.fichas.find(x => x.id === fichaId);
      if (!f) return;
      nameInput.value = f.name;
      State.selectedEmoji = f.emoji || '🏋️';
      emojiGroup.querySelectorAll('.tag').forEach(t =>
        t.classList.toggle('selected', t.textContent === State.selectedEmoji));
      (f.exercises || []).forEach(ex => addExRow(ex));
    } else {
      nameInput.value = '';
      State.selectedEmoji = '🏋️';
    }
    modal.open('fichaModal');
  },

  closeModal(): void { modal.close('fichaModal'); },

  addExercise(): void { addExRow(); },

  async save(): Promise<void> {
    const name = inputValue('fichaName').trim();
    if (!name) return toast('Informe o nome da ficha.', 'error');
    const exercises = collectExercises();
    if (exercises.length === 0) return toast('Adicione ao menos um exercício.', 'error');
    const data = { name, emoji: State.selectedEmoji, exercises, updatedAt: serverTimestamp() };
    try {
      if (State.editingFichaId) {
        await updateDoc(doc(refFichas(), State.editingFichaId), data);
        toast('Ficha atualizada!', 'success');
      } else {
        await addDoc(refFichas(), { ...data, createdAt: serverTimestamp() });
        toast('Ficha criada!', 'success');
      }
      fichas.closeModal();
      await loadFichas();
      renderDashboard();
    } catch (e) {
      toast('Erro ao salvar ficha.', 'error');
      console.error(e);
    }
  },

  delete(id: string): void {
    openConfirm({
      title: 'Deletar esta ficha?',
      body: 'Os treinos já registrados no histórico não serão afetados.',
      confirmLabel: 'Deletar',
      danger: true,
      onConfirm: async () => {
        await deleteDoc(doc(refFichas(), id));
        toast('Ficha removida.', 'info');
        await loadFichas();
        renderDashboard();
      }
    });
  },

  // ── Importação de PDF via IA (proxy Netlify Function) ──────
  openPdfModal(): void {
    fichas.pdfReset();
    modal.open('pdfImportModal');
  },

  closePdfModal(): void {
    modal.close('pdfImportModal');
    fichas.pdfReset();
  },

  pdfReset(): void {
    pdfFile = null;
    pdfFichas = [];
    $('pdfStep1').style.display = 'block';
    $('pdfStep2').style.display = 'none';
    $('pdfStep3').style.display = 'none';
    $('pdfStepError').style.display = 'none';
    $('pdfUploadArea').classList.remove('has-file');
    $('pdfStatus').textContent = 'Máximo 10MB';
    ($('pdfAnalyzeBtn') as HTMLButtonElement).disabled = true;
    ($('pdfFileInput') as HTMLInputElement).value = '';
  },

  pdfSelected(input: HTMLInputElement): void {
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 50 * 1024 * 1024) return toast('PDF muito grande. Máximo 50MB.', 'error');
    if (file.type !== 'application/pdf') return toast('Selecione um arquivo PDF.', 'error');
    pdfFile = file;
    $('pdfUploadArea').classList.add('has-file');
    $('pdfStatus').textContent = `✅ ${file.name} (${(file.size / 1024).toFixed(0)}KB)`;
    ($('pdfAnalyzeBtn') as HTMLButtonElement).disabled = false;
  },

  async analyzePdf(): Promise<void> {
    if (!pdfFile) return;
    $('pdfStep1').style.display = 'none';
    $('pdfStep2').style.display = 'block';
    try {
      pdfFichas = await analyzePdfWithAI(pdfFile);
      $('pdfStep2').style.display = 'none';
      $('pdfStep3').style.display = 'block';
      const previewList = $('pdfPreviewList');
      previewList.innerHTML = '';
      pdfFichas.forEach(f => {
        const el = document.createElement('div');
        el.className = 'pdf-ficha-preview';
        el.innerHTML = `<div class="pdf-ficha-name">${esc(f.emoji || '🏋️')} ${esc(f.name)}</div>`
          + `<div class="pdf-ficha-exercises">`
          + (f.exercises || []).map((ex, i) => `${i + 1}. ${esc(ex.name)} — ${esc(ex.sets)}×${esc(ex.reps)}`).join('<br>')
          + `</div>`;
        previewList.appendChild(el);
      });
    } catch (e: any) {
      console.error('[PDF Import]', e);
      $('pdfStep2').style.display = 'none';
      $('pdfStepError').style.display = 'block';
      $('pdfErrorMsg').textContent = e.message || 'Erro inesperado. Tente novamente.';
    }
  },

  async pdfImportConfirm(): Promise<void> {
    if (pdfFichas.length === 0) return;
    try {
      const batch = writeBatch(db);
      const now = serverTimestamp();
      pdfFichas.forEach(f => {
        batch.set(doc(refFichas()), {
          name: f.name || 'Treino',
          emoji: f.emoji || '🏋️',
          exercises: (f.exercises || []).map(ex => ({
            name: ex.name || '',
            group: GROUPS.includes(ex.group) ? ex.group : 'Outro',
            sets: parseInt(String(ex.sets)) || 3,
            reps: String(ex.reps || '10'),
            weight: parseFloat(String(ex.weight)) || 0,
            obs: ex.obs || ''
          })),
          createdAt: now,
          updatedAt: now
        });
      });
      await batch.commit();
      toast(`${pdfFichas.length} ficha(s) importada(s) com sucesso! 🎉`, 'success');
      fichas.closePdfModal();
      await loadFichas();
      renderDashboard();
    } catch (e) {
      toast('Erro ao salvar fichas.', 'error');
      console.error('[PDF Import Save]', e);
    }
  }
};

function addExRow(ex: Partial<Exercise> = {}): void {
  const editor = $('exerciciosEditor');
  const row = document.createElement('div');
  row.className = 'ex-editor-row';
  row.style.cssText = 'background:var(--surface2);border-radius:var(--radius-sm);padding:12px;margin-bottom:10px;position:relative;';
  row.innerHTML = `
    <button class="ex-remove" style="position:absolute;top:8px;right:8px;background:transparent;border:none;color:var(--text-muted);cursor:pointer;font-size:16px;">✕</button>
    <div class="row">
      <div class="field"><label>Exercício</label><input type="text" class="ex-name" placeholder="Supino Reto" /></div>
      <div class="field"><label>Grupo muscular</label>
        <select class="ex-group">
          ${GROUPS.map(g => `<option value="${g}" ${ex.group === g ? 'selected' : ''}>${g}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="row">
      <div class="field"><label>Séries</label><input type="number" class="ex-sets" min="1" max="20" /></div>
      <div class="field"><label>Reps</label><input type="text" class="ex-reps" placeholder="10 ou 8-12" /></div>
      <div class="field"><label>Carga (kg)</label><input type="number" class="ex-weight" placeholder="0" /></div>
    </div>
    <div class="field"><label>Observação</label><input type="text" class="ex-obs" placeholder="Opcional" /></div>
  `;
  // Valores via propriedade (não interpolados no HTML) — imune a XSS
  row.querySelector<HTMLInputElement>('.ex-name')!.value = ex.name || '';
  row.querySelector<HTMLInputElement>('.ex-sets')!.value = String(ex.sets || 3);
  row.querySelector<HTMLInputElement>('.ex-reps')!.value = String(ex.reps || '10');
  row.querySelector<HTMLInputElement>('.ex-weight')!.value = ex.weight ? String(ex.weight) : '';
  row.querySelector<HTMLInputElement>('.ex-obs')!.value = ex.obs || '';
  row.querySelector<HTMLElement>('.ex-remove')!.onclick = () => row.remove();
  editor.appendChild(row);
}

function collectExercises(): Exercise[] {
  return Array.from($('exerciciosEditor').children).map(row => ({
    name: (row.querySelector('.ex-name') as HTMLInputElement).value.trim(),
    group: (row.querySelector('.ex-group') as HTMLSelectElement).value,
    sets: parseInt((row.querySelector('.ex-sets') as HTMLInputElement).value) || 3,
    reps: (row.querySelector('.ex-reps') as HTMLInputElement).value.trim() || '10',
    weight: parseFloat((row.querySelector('.ex-weight') as HTMLInputElement).value) || 0,
    obs: (row.querySelector('.ex-obs') as HTMLInputElement).value.trim()
  })).filter(ex => ex.name);
}
