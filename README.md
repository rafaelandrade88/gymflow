# 🏋️ GymFlow — PWA de Treinos na Academia

App PWA single-file para controle de treinos com Firebase, timer de descanso, detecção de PRs e histórico.

---

## 📁 Estrutura

```
gymflow/
├── index.html              ← Markup das telas
├── vite.config.ts          ← Build + PWA (vite-plugin-pwa gera manifest e SW)
├── netlify/functions/
│   └── analyze-pdf.mjs     ← Proxy seguro para a API da Anthropic
└── src/
    ├── main.ts             ← Boot, auth listener, registro do SW
    ├── state.ts            ← Estado global + persistência do treino ativo
    ├── types.ts            ← Tipos (Ficha, Session, ActiveWorkout...)
    ├── styles/main.css     ← Design tokens + estilos
    ├── data/seedFichas.json
    ├── services/           ← firebase, cloudinary, pdfImport
    ├── utils/              ← dom (esc/toast), format
    └── modules/            ← auth, dashboard, fichas, workout, timer,
                              history, profile, community, sideMenu
```

## 🛠 Desenvolvimento

```bash
npm install
npm run dev      # localhost:5173
npm run build    # typecheck + build em dist/
```

Variáveis de ambiente (`.env` local / Netlify UI):
- `VITE_FIREBASE_*` e `VITE_CLOUDINARY_*` (ver `.env`)
- `ANTHROPIC_API_KEY` — **somente no Netlify**, usada pela function `analyze-pdf`

---

## 🔥 Setup Firebase

### 1. Criar projeto Firebase
1. Acesse https://console.firebase.google.com
2. Crie um novo projeto: `gymflow`
3. Ative **Authentication** → Email/Password + Google
4. Ative **Firestore Database** → modo produção

### 2. Regras do Firestore
No console Firebase → Firestore → Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

### 3. Configurar credenciais no index.html
Substitua o bloco `FIREBASE_CONFIG` no `index.html`:

```javascript
const FIREBASE_CONFIG = {
  apiKey:            "SUA_API_KEY",
  authDomain:        "SEU_PROJECT.firebaseapp.com",
  projectId:         "SEU_PROJECT_ID",
  storageBucket:     "SEU_PROJECT.appspot.com",
  messagingSenderId: "SEU_SENDER_ID",
  appId:             "SEU_APP_ID"
};
```

Você encontra esses valores em:
Firebase Console → Configurações do projeto → Seus apps → Config

---

## 🚀 Deploy no GitHub Pages

```bash
# 1. Criar repo no GitHub
git init
git remote add origin https://github.com/SEU_USER/gymflow.git

# 2. Gerar ícones (use https://realfavicongenerator.net ou Figma)
# Salve icon-72.png, icon-192.png, icon-512.png na raiz

# 3. Push
git add .
git commit -m "feat: GymFlow PWA inicial"
git push -u origin main

# 4. No GitHub → Settings → Pages → Source: main branch / root
```

App ficará em: `https://SEU_USER.github.io/gymflow/`

**Ajuste o `start_url` no manifest.json se o app não estiver na raiz:**
```json
"start_url": "/gymflow/",
```

---

## ✨ Funcionalidades

### Dashboard
- Saudação personalizada por horário
- Stats da semana/mês: treinos, volume (toneladas), séries, PRs
- Barra de frequência dos últimos 7 dias (streak)
- Último treino com resumo
- Acesso rápido às fichas

### Fichas de Treino
- Criar/editar/deletar fichas ilimitadas
- Configurar: nome, emoji, exercícios
- Por exercício: nome, grupo muscular, séries, reps, carga base, observação
- Visualizar exercícios em accordion

### Treino Ativo
- Cronômetro em tempo real
- Tabela de séries por exercício (carga + reps editáveis)
- Checkbox de conclusão por série
- Detecção automática de PR (recorde pessoal)
- Timer de descanso automático ao marcar série
- Adicionar séries extras durante o treino
- Finalização com salvamento no Firebase

### Timer de Descanso
- Abre automaticamente ao completar uma série
- Presets: 30s / 1min / 1:30 / 2min
- Anel SVG animado com contagem regressiva
- Vibração ao finalizar (mobile)

### Histórico
- Gráfico de volume por dia (14 dias)
- Listado por mês com duração, volume, séries
- Badge de PR na sessão
- Detalhe completo por treino (todas as séries)

### Perfil
- Stats totais: treinos, séries, PRs
- Editar nome
- Logout

---

## 🔧 Estrutura Firestore

```
users/
  {uid}/
    name: string
    email: string
    fichas/
      {fichaId}/
        name: string
        emoji: string
        exercises: [{ name, group, sets, reps, weight, obs }]
        createdAt, updatedAt
    sessions/
      {sessionId}/
        fichaId, fichaName, fichaEmoji
        startTime, endTime
        exercises: [{ name, group, series: [{ weight, reps, done, isPR }] }]
        createdAt
```

---

## 📱 Instalação PWA

### Android (Chrome)
1. Abra o app no Chrome
2. Menu → "Adicionar à tela inicial"
3. Confirmar

### iOS (Safari)
1. Abra no Safari
2. Botão compartilhar → "Adicionar à tela de início"

---

## 🎨 Design Tokens

| Token       | Valor     | Uso               |
|-------------|-----------|-------------------|
| `--bg`      | `#0a0a0f` | Background geral  |
| `--surface` | `#1c1c27` | Cards             |
| `--accent`  | `#5b4fff` | Indigo — primário |
| `--lime`    | `#c8ff00` | PRs e timer       |
| `--danger`  | `#ff4757` | Ações destrutivas |
| `--success` | `#2ed573` | Confirmações      |

Fontes: **Bebas Neue** (display/números) + **Inter** (body/UI)
