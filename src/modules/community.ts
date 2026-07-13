import {
  onSnapshot, query, orderBy, limit, addDoc, updateDoc, deleteDoc, doc,
  getDocs, collection, writeBatch, serverTimestamp,
  arrayUnion, arrayRemove, increment, type Unsubscribe
} from 'firebase/firestore';
import { db, refCommunity, uid } from '../services/firebase';
import { State } from '../state';
import type { Post, Session } from '../types';
import { $, esc, toast } from '../utils/dom';
import { toDate, fmtDuration, fmtDateRelative, timeAgo, sessionTotals } from '../utils/format';
import { modal, openConfirm } from './modal';
import { uploadToCloudinary } from '../services/cloudinary';

let selectedSession: { s: Session; series: number; vol: string; dur: string } | null = null;
let imageFile: File | null = null;
let posts: Post[] = [];
let unsubscribe: Unsubscribe | null = null;

/** Texto de post/comentário: escapa e converte quebras de linha. */
function escMultiline(s: string): string {
  return esc(s).replaceAll('\n', '<br>');
}

export const community = {
  startFeed(): void {
    community.stopFeed();
    unsubscribe = onSnapshot(
      query(refCommunity(), orderBy('createdAt', 'desc'), limit(30)),
      snap => {
        posts = snap.docs.map(d => ({ id: d.id, ...d.data() }) as Post);
        renderFeed();
      },
      err => console.error('[Community] Feed error:', err)
    );
  },

  stopFeed(): void {
    unsubscribe?.();
    unsubscribe = null;
  },

  openPostModal(): void {
    selectedSession = null;
    imageFile = null;
    $('postImagePreview').style.display = 'none';
    $('uploadAreaContent').style.display = 'flex';
    $('uploadArea').classList.remove('has-image');
    ($('postCaption') as HTMLTextAreaElement).value = '';
    ($('postImageInput') as HTMLInputElement).value = '';

    const list = $('postSessionList');
    list.innerHTML = '';
    if (State.sessions.length === 0) {
      list.innerHTML = '<div class="text-muted" style="font-size:13px">Nenhum treino recente.</div>';
    } else {
      State.sessions.slice(0, 5).forEach(s => {
        const el = document.createElement('div');
        el.className = 'post-session-select';
        const dur = s.endTime ? fmtDuration(toDate(s.endTime).getTime() - toDate(s.startTime).getTime()) : '—';
        const t = sessionTotals(s.exercises);
        el.innerHTML = `
          <div class="pss-label">${fmtDateRelative(s.startTime)}</div>
          <div class="pss-value">${esc(s.fichaEmoji || '🏋️')} ${esc(s.fichaName)} · ${dur} · ${t.series} séries</div>
        `;
        el.onclick = () => {
          document.querySelectorAll('.post-session-select').forEach(e => e.classList.remove('selected'));
          el.classList.toggle('selected');
          selectedSession = el.classList.contains('selected')
            ? { s, series: t.series, vol: (t.volume / 1000).toFixed(1) + 't', dur }
            : null;
        };
        list.appendChild(el);
      });
    }
    modal.open('postModal');
  },

  closePostModal(): void { modal.close('postModal'); },

  previewImage(input: HTMLInputElement): void {
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) return toast('Imagem muito grande. Máximo 10MB.', 'error');
    imageFile = file;
    const reader = new FileReader();
    reader.onload = e => {
      const img = $('postImagePreview') as HTMLImageElement;
      img.src = e.target!.result as string;
      img.style.display = 'block';
      $('uploadAreaContent').style.display = 'none';
      $('uploadArea').classList.add('has-image');
    };
    reader.readAsDataURL(file);
  },

  async submitPost(): Promise<void> {
    if (!imageFile) return toast('Adicione uma foto ao post.', 'error');
    const caption = ($('postCaption') as HTMLTextAreaElement).value.trim();

    $('uploadingText').textContent = 'Enviando foto...';
    $('uploadingOverlay').classList.add('open');
    try {
      const imageUrl = await uploadToCloudinary(imageFile);
      $('uploadingText').textContent = 'Publicando...';

      const postData: Record<string, unknown> = {
        userId: uid(),
        userName: State.user?.displayName || 'Atleta',
        imageUrl,
        caption,
        likes: [],
        createdAt: serverTimestamp()
      };
      if (selectedSession) {
        const { s, series, vol, dur } = selectedSession;
        postData.workout = {
          fichaName: s.fichaName,
          fichaEmoji: s.fichaEmoji || '🏋️',
          duration: dur,
          series,
          volume: vol
        };
      }
      await addDoc(refCommunity(), postData);
      community.closePostModal();
      toast('Post publicado! 🔥', 'success');
    } catch (e) {
      console.error('[Community] Post error:', e);
      toast('Erro ao publicar. Tente novamente.', 'error');
    } finally {
      $('uploadingOverlay').classList.remove('open');
    }
  },

  async toggleLike(postId: string): Promise<void> {
    const me = uid();
    if (!me) return toast('Faça login para curtir.', 'error');
    const post = posts.find(p => p.id === postId);
    if (!post) return;
    const myLike = (post.likes || []).includes(me);
    try {
      await updateDoc(doc(refCommunity(), postId), {
        likes: myLike ? arrayRemove(me) : arrayUnion(me)
      });
    } catch (e) {
      toast('Erro ao curtir. Tente novamente.', 'error');
      console.error('[Like]', e);
    }
  },

  toggleComments(postId: string): void {
    const list = document.getElementById('comments-' + postId);
    const inputRow = document.getElementById('comment-input-' + postId);
    if (!list || !inputRow) return;
    if (!list.classList.contains('open')) {
      list.classList.add('open');
      inputRow.style.display = 'flex';
      community.loadComments(postId);
    } else {
      list.classList.remove('open');
      inputRow.style.display = 'none';
    }
  },

  async loadComments(postId: string): Promise<void> {
    const list = document.getElementById('comments-' + postId);
    if (!list) return;
    list.innerHTML = '<div style="padding:10px 14px;font-size:13px;color:var(--text-muted)">Carregando...</div>';
    try {
      const snap = await getDocs(query(
        collection(db, 'community', postId, 'comments'),
        orderBy('createdAt', 'asc'), limit(50)
      ));
      list.innerHTML = '';
      if (snap.empty) {
        list.innerHTML = '<div style="padding:10px 14px;font-size:12px;color:var(--text-dim)">Nenhum comentário ainda.</div>';
        return;
      }
      snap.docs.forEach(d => {
        const c = d.data();
        const item = document.createElement('div');
        item.className = 'comment-item';
        item.innerHTML = `
          <div class="comment-avatar">${esc((c.userName || 'A').charAt(0).toUpperCase())}</div>
          <div class="comment-body">
            <div class="comment-author">${esc(c.userName || 'Atleta')}</div>
            <div class="comment-text">${escMultiline(c.text || '')}</div>
            <div class="comment-time">${timeAgo(c.createdAt)}</div>
          </div>
        `;
        list.appendChild(item);
      });
    } catch {
      list.innerHTML = '<div style="padding:10px 14px;font-size:12px;color:var(--danger)">Erro ao carregar comentários.</div>';
    }
  },

  async sendComment(postId: string): Promise<void> {
    const input = document.getElementById('comment-text-' + postId) as HTMLInputElement | null;
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    if (!uid()) return toast('Faça login para comentar.', 'error');
    input.value = '';
    try {
      const batch = writeBatch(db);
      batch.set(doc(collection(db, 'community', postId, 'comments')), {
        userId: uid(),
        userName: State.user?.displayName || 'Atleta',
        text,
        createdAt: serverTimestamp()
      });
      batch.update(doc(refCommunity(), postId), { commentCount: increment(1) });
      await batch.commit();
      community.loadComments(postId);
    } catch {
      toast('Erro ao enviar comentário.', 'error');
    }
  },

  deletePost(postId: string): void {
    openConfirm({
      title: 'Excluir este post?',
      confirmLabel: 'Excluir',
      danger: true,
      onConfirm: async () => {
        try {
          await deleteDoc(doc(refCommunity(), postId));
          toast('Post excluído.', 'info');
        } catch {
          toast('Erro ao excluir post.', 'error');
        }
      }
    });
  }
};

function renderFeed(): void {
  const feed = $('communityFeed');
  if (posts.length === 0) {
    feed.innerHTML = `<div class="community-empty">
      <div class="empty-icon">🏋️</div>
      <div>Nenhum post ainda.<br>Seja o primeiro a postar!</div>
    </div>`;
    return;
  }
  feed.innerHTML = '';
  posts.forEach(post => {
    const el = document.createElement('div');
    el.className = 'post-card';
    const me = uid();
    const myLike = (post.likes || []).includes(me || '');
    const likeCount = (post.likes || []).length;
    const commentCount = post.commentCount || 0;
    const isOwner = post.userId === me;

    let workoutHtml = '';
    if (post.workout) {
      workoutHtml = `<div class="post-workout-summary">
        <div class="post-workout-name">${esc(post.workout.fichaEmoji || '🏋️')} ${esc(post.workout.fichaName || '')}</div>
        <div class="post-workout-stats">
          <div class="post-workout-stat"><strong>${esc(post.workout.duration)}</strong> dur.</div>
          <div class="post-workout-stat"><strong>${esc(post.workout.series)}</strong> séries</div>
          <div class="post-workout-stat"><strong>${esc(post.workout.volume)}</strong> vol.</div>
        </div></div>`;
    }
    const heart = myLike
      ? '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>'
      : '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg>';
    const likeTxt = likeCount > 0 ? `${likeCount} ${likeCount === 1 ? 'curtida' : 'curtidas'}` : 'Curtir';
    const cmtTxt = commentCount > 0 ? `${commentCount} coment.` : 'Comentar';

    el.innerHTML = `
      <div class="post-header">
        <div class="post-avatar">${esc((post.userName || 'A').charAt(0).toUpperCase())}</div>
        <div style="flex:1">
          <div class="post-user-name">${esc(post.userName || 'Atleta')}</div>
          <div class="post-time">${timeAgo(post.createdAt)}</div>
        </div>
        ${isOwner ? `<button class="post-delete-btn" data-action="delete" title="Excluir">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/></svg>
        </button>` : ''}
      </div>
      ${post.imageUrl
        ? `<img class="post-img" loading="lazy" alt="Foto do treino" />`
        : '<div class="post-img-placeholder">📷</div>'}
      <div class="post-body">
        ${post.caption ? `<div class="post-caption">${escMultiline(post.caption)}</div>` : ''}
        ${workoutHtml}
      </div>
      <div class="post-actions">
        <button class="like-btn ${myLike ? 'liked' : ''}" data-action="like">${heart} ${likeTxt}</button>
        <button class="like-btn" data-action="comments">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg> ${cmtTxt}
        </button>
      </div>
      <div class="comments-section">
        <div class="comments-list" id="comments-${post.id}"></div>
        <div class="comment-input-row" id="comment-input-${post.id}" style="display:none">
          <input class="comment-input" type="text" placeholder="Comente..." id="comment-text-${post.id}" />
          <button class="comment-send" data-action="send">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
          </button>
        </div>
      </div>
    `;
    // URL da imagem atribuída via propriedade — nunca interpolada
    if (post.imageUrl) (el.querySelector('.post-img') as HTMLImageElement).src = post.imageUrl;
    el.querySelector<HTMLElement>('[data-action="like"]')!.onclick = () => community.toggleLike(post.id);
    el.querySelector<HTMLElement>('[data-action="comments"]')!.onclick = () => community.toggleComments(post.id);
    el.querySelector<HTMLElement>('[data-action="delete"]')?.addEventListener('click', () => community.deletePost(post.id));
    el.querySelector<HTMLElement>('[data-action="send"]')!.onclick = () => community.sendComment(post.id);
    el.querySelector<HTMLInputElement>('.comment-input')!.addEventListener('keydown', e => {
      if (e.key === 'Enter') community.sendComment(post.id);
    });
    feed.appendChild(el);
  });
}
