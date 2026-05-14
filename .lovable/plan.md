# Fix: "Invalid key" no upload de vídeo/áudio

## Causa

`src/pages/Tools.tsx` monta o caminho do Storage com o nome original do arquivo:

```ts
const filePath = `${user.id}/${Date.now()}-${uploadName}`;
```

O Supabase Storage só aceita um conjunto restrito de caracteres na key. Qualquer acento (`ã`, `ç`, `é`), emoji, ou caractere especial fora do regex permitido derruba o upload com `Invalid key`. Nome típico de vídeo do celular brasileiro (`Vídeo do WhatsApp.mp4`, `Reels Final (1).mov`) já quebra.

## Correção

Sanitizar `uploadName` antes de compor o `filePath`:

```ts
const sanitize = (name: string) =>
  name
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^a-zA-Z0-9._-]/g, '_')                 // troca tudo que não é seguro
    .replace(/_+/g, '_')                              // colapsa _ repetidos
    .slice(0, 80);                                    // limita tamanho

const safeName = sanitize(uploadName) || 'media';
const filePath = `${user.id}/${Date.now()}-${safeName}`;
```

Aplicar em **`src/pages/Tools.tsx`** dentro de `handleFileUpload`, logo antes da linha do `supabase.storage.from('media-uploads').upload(...)`.

## Escopo

- 1 arquivo, ~5 linhas. Sem mudança de schema, edge function, RLS ou deploy de VPS.
- Frontend → Vercel auto-deploy assim que o commit subir.

## Out of scope

- Não mexe no fluxo de transcrição em si.
- Não muda limite de tamanho nem tipos aceitos.
