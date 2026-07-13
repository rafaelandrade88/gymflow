import { signInWithEmailAndPassword, sendPasswordResetEmail, signOut } from 'firebase/auth';
import { auth } from '../services/firebase';
import { inputValue, toast } from '../utils/dom';
import { openConfirm } from './modal';

function validEmail(email: string): boolean {
  const atIdx = email.indexOf('@');
  const dotIdx = email.lastIndexOf('.');
  return atIdx > 0 && dotIdx > atIdx + 1 && dotIdx < email.length - 2;
}

function msg(code: string): string {
  const map: Record<string, string> = {
    'auth/user-not-found': 'Usuário não encontrado.',
    'auth/wrong-password': 'Senha incorreta.',
    'auth/invalid-credential': 'E-mail ou senha incorretos.',
    'auth/invalid-email': 'E-mail inválido.',
    'auth/too-many-requests': 'Muitas tentativas. Aguarde alguns minutos.',
    'auth/network-request-failed': 'Sem conexão. Verifique sua internet.',
    'auth/requires-recent-login': 'Sessão expirada. Faça login novamente.',
    'auth/user-disabled': 'Esta conta foi desativada.'
  };
  return map[code] || `Erro: ${code}`;
}

export const authModule = {
  async login(): Promise<void> {
    const email = inputValue('loginEmail').trim();
    const pass = inputValue('loginPass');
    if (!email || !pass) return toast('Preencha e-mail e senha.', 'error');
    if (!validEmail(email)) return toast('Informe um e-mail válido.', 'error');
    try {
      const cred = await signInWithEmailAndPassword(auth, email, pass);
      if (!cred.user.emailVerified) {
        await signOut(auth);
        toast('Confirme seu e-mail antes de entrar. Verifique sua caixa de entrada.', 'error');
      }
    } catch (e: any) {
      toast(msg(e.code), 'error');
    }
  },

  async forgotPassword(): Promise<void> {
    const email = inputValue('loginEmail').trim();
    if (!email) return toast('Informe seu e-mail no campo acima.', 'error');
    if (!validEmail(email)) return toast('Informe um e-mail válido.', 'error');
    try {
      await sendPasswordResetEmail(auth, email);
      toast('E-mail de redefinição enviado! Verifique sua caixa de entrada.', 'success');
    } catch (e: any) {
      toast(msg(e.code), 'error');
    }
  },

  logout(): void {
    openConfirm({
      title: 'Sair da conta?',
      body: 'Você precisará fazer login novamente para acessar seus treinos.',
      confirmLabel: 'Sair',
      danger: true,
      onConfirm: () => signOut(auth)
    });
  }
};
