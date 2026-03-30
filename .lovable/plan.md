

# Migração Pendente — O que falta do Aura OS

## Diagnóstico

Comparando os dois projetos, existem **4 categorias** de itens ainda não migrados:

---

### 1. Assets (imagens, logos, ícones) — 24 arquivos
Nenhum asset foi copiado ainda. Isso explica a logo e imagens quebradas.

**public/**
- `favicon.png`, `og-image.png`
- `icons/icon-192.png`, `icons/icon-512.png`

**src/assets/**
- `influlab-logo.png`, `influlab-logo-horizontal.png`
- `auth-bg.png`, `hero-illustration.png`
- 11 ícones de nicho em `src/assets/niches/` (fitness, beleza, moda, etc.)

### 2. Componentes faltando — 3 arquivos
- `src/components/landing/HeroMockup.tsx` — mockup visual do hero da landing
- `src/components/PushNotificationButton.tsx` — botão de ativar/desativar notificações push
- `src/components/TaskChecklist.tsx` — checklist de tarefas diárias com confetti

### 3. Componente desatualizado — 1 arquivo
- `src/components/NicheIcon.tsx` — versão atual usa apenas emoji fallback; a versão do Aura OS importa as imagens dos nichos

### 4. Edge Functions — 13 functions
Nenhuma Edge Function foi copiada. São elas:
- `admin-dashboard`, `ai-chat`, `auth-email-hook`
- `create-asaas-subscription`
- `generate-audience-profile`, `generate-daily-guide`, `generate-personalized-matrix`, `generate-script`, `generate-tools-content`
- `process-email-queue`, `scheduled-push`, `send-push`
- `transcribe-media`
- `_shared/email-templates/`

---

## Plano de Execução

### Etapa 1: Copiar todos os assets (24 arquivos)
Copiar do Aura OS usando `cross_project--copy_project_asset`:
- 4 arquivos public (`favicon.png`, `og-image.png`, `icon-192.png`, `icon-512.png`)
- 4 assets principais (`influlab-logo.png`, `influlab-logo-horizontal.png`, `auth-bg.png`, `hero-illustration.png`)
- 11 ícones de nicho

### Etapa 2: Copiar componentes faltantes (3 arquivos)
- Criar `HeroMockup.tsx`, `PushNotificationButton.tsx`, `TaskChecklist.tsx` com o código exato do Aura OS

### Etapa 3: Atualizar NicheIcon.tsx
- Substituir pela versão completa que importa as imagens dos nichos

### Etapa 4: Copiar e deploy das Edge Functions
- Copiar os 13 diretórios de Edge Functions + `_shared/email-templates`
- Deploy das functions

## Observação
As Edge Functions dependem de secrets (API keys do OpenAI, Asaas, VAPID, etc.) que precisarão ser configurados separadamente no painel do Supabase.

