---
name: gravar-video
description: Planejar, gravar, verificar e entregar vídeos de demo ou tutorial de qualquer sistema web com Playwright, com ou sem narração pt-BR (edge-tts, voz Thalita), balões "Passo guiado", legendas .srt e volume normalizado, e subir para o Google Drive em pastas por sistema e tema (opcional, via rclone). Use quando o usuário pedir uma demo, um tutorial em vídeo, um passo a passo gravado, um GIF de fluxo ou para regravar um vídeo existente.
---

# Gravar vídeo (demo ou tutorial) de qualquer sistema web

Uma skill só, um kit só (`toolkit/`), dois modos. Escolha pelo pedido; na dúvida, pergunte uma vez.

| Modo | Quando | O que sai |
|---|---|---|
| **narrado** (padrão para tutorial) | passo a passo explicado, público novato | mp4 com voz (Thalita), balões, cartões de capítulo, volume normalizado e `.srt` |
| **silencioso** (demo curta, GIF) | mostrar um fluxo com legendas na tela, sem voz | mp4 sem áudio, com os balões como legenda, e `.srt` |

## O kit (`toolkit/`, na pasta desta skill)

| Comando | Para quê |
|---|---|
| `toolkit/bin/setup.sh [pasta-do-projeto]` | prepara o kit (npm, venv do edge-tts, Chromium da versão certa) e, se passar uma pasta, o projeto: `out/`, `work/`, `.gitignore` e um `roteiro.yaml` modelo |
| `node toolkit/bin/gravar.mjs roteiro.yaml saida.mp4` | grava (rode na pasta do projeto). Env: `MODO=silencioso`, `CAPS=2,3`, `TTS_VOZ`, `TTS_RATE`, `RASCUNHO=1`, `SEM_CACHE=1` |
| `node toolkit/bin/verificar.mjs out/saida.mp4 [--silencioso] [--res 1280x720] [--erros work/<nome>/erros.txt]` | confere codec, resolução, duração, áudio, volume (LUFS), tela preta, imagem parada e falhas de passo; sai com 1 se reprovar |
| `python3 toolkit/bin/entregar.py --sistema S --tema T arquivos... [--simular]` | (opcional) cria as pastas no Drive e sobe os arquivos, devolvendo o link de visualização. Precisa de `rclone` configurado e de `GRAVAR_DRIVE_REMOTE` |

Já embutido no `gravar.mjs`: **cache das falas** (só regera o que mudou), **dicionário de pronúncia** (`toolkit/pronuncia.json` + `pronuncia:` do roteiro;
lê IPs e versões como "192 ponto 0 ponto 2...", expande siglas), **loudnorm** (-16 LUFS) e **legendas `.srt`** ao lado do mp4.

### Velocidade
- **Rascunho** (`RASCUNHO=1`): 720p, slowMo e digitação rápidos, pausas curtas; grava `out/<saida>-rascunho.mp4`. Use para validar roteiro e seletores
  antes do take final (verifique com `--res 1280x720`). A duração da narração continua sendo o piso do tempo.
- **Falas em paralelo + cache**: as falas novas são geradas 5 por vez; as que já existem vêm do cache em `work/cache-falas/`.
- **Cache por capítulo** (`cache: capitulos` no roteiro): cada capítulo vira um segmento que **começa em `base`** (não herda o estado do anterior),
  é guardado em `work/cache-capitulos/` e só é regravado se mudar (roteiro, voz, pronúncia ou overlay); o vídeo final é a junção.
  Só use se os capítulos forem independentes. Capítulo com falha de passo não entra no cache. `SEM_CACHE=1` força regravar tudo.
- Sem `cache: capitulos`, a gravação é contínua (um capítulo herda o estado do outro), útil quando um capítulo depende do que o anterior criou.

### Roteiro (YAML)
Modelo completo: `toolkit/exemplos/roteiro-exemplo.yaml` (com página de teste `index.html`). Campos: `base`, `modo`, `viewport`, `sessao`
(storageState do login do usuário), `aquecer`, `prontoQuando`, `pronuncia`, `capitulos[]` com `passos[]`:
`say` (fala), `balao` (texto do balão/legenda), `alvo` (seletor Playwright), `pos` (abaixo/acima/direita/esquerda/topo), `pausa` (silencioso),
`antes`/`depois` (ações: `goto`, `click`, `type: [sel, texto, atraso]`, `press`, `scroll`, `espera`, `aguardar`, `mover`).
Para interfaces complexas (ExtJS, MUI), use roteiro `.mjs` exportando `capitulos` com funções em `antes`/`depois`/`alvo`
(ajudantes em `toolkit/lib/ui-extjs.mjs`). Sem `say` num passo, ele usa `pausa`.

## Perfil de quem executa
Engenheiro sênior de testes E2E (Playwright/TypeScript). Código limpo, esperas por estado (não por tempo cego),
seletores estáveis (papel, rótulo, texto), sem `sleep` mágico fora das pausas de leitura.

## Antes de tudo: perguntar (uma vez)
1. Qual sistema, e ele é real ou sandbox? Escrita real é permitida? Em qual prefixo/escopo (ex.: só recursos `tutorial-*`)?
2. Modo (narrado ou silencioso), público (novato/avançado) e duração alvo. Um vídeo longo com capítulos ou vários curtos.
3. Voz (padrão `pt-BR-ThalitaMultilingualNeural`; alternativas `FranciscaNeural` (mais robótica), `AntonioNeural`). Troca por env, sem editar o script.
4. Vai subir ao Drive? Em qual sistema/tema se encaixa (ver "Entrega no Drive").

## Regras que não mudam
- **Nunca escrever no ambiente real** sem autorização explícita; criar só o que o roteiro permite e **limpar tudo no fim**.
- **Login é do usuário.** Credenciais nunca passam pela IA: nunca leia `.env`, nunca digite nem peça senha no chat. O usuário faz o login
  num script próprio que guarda só ticket/cookie/sessão com modo 600 e você aponta `sessao:` para o arquivo (storageState do Playwright).
  Se a sessão expirar, peça novo login.
- **Dados fictícios têm que parecer reais**; nada de "teste", "demo", "mock", "lorem" visível na tela. Mostrar só dados que o sistema já exibe;
  mascarar segredos (cobrir com o destaque ou desfocar).
- Só o vídeo final em `out/`; intermediários e cache em `work/` (o `setup.sh` já põe no `.gitignore`).

## Fluxo
1. **Planejar** (antes de qualquer código): objetivo, público, cada passo (*Tela* e *Fala*/legenda), duração alvo e dados necessários,
   no `roteiro.yaml`. Confirme nomes de menu, versões e IPs no sistema real.
2. **Preparar**: `toolkit/bin/setup.sh <pasta-do-projeto>`.
3. **Explorar antes de gravar**: script que abre cada tela, tira screenshot e lista os rótulos. Abra as imagens e confirme o conteúdo
   certo (permissão insuficiente deixa a tela em branco: veja erros `pageerror`). Use `aquecer: true` em SPAs com permissão limitada.
4. **Escrever o roteiro** e gravar um capítulo de teste (`CAPS=1`); depois o vídeo todo.
5. **Verificar**: `verificar.mjs` (automático) e, além dele, olhar de verdade: extrair quadros (`ffmpeg -ss T -frames:v 1`) ou folha de contato
   (`ffmpeg -vf "fps=1/3,scale=560:-1,tile=4x4"`). Conferir cartões, balão sobre o alvo certo, cursor fora dos cartões, dados coerentes.
6. **Entregar**: enviar o arquivo ao usuário e relatar duração, o que o vídeo cobre, onde ficou (pasta local ou Drive), o que foi
   criado/limpo e qualquer comportamento do produto que pareceu bug.

## Entrega no Drive (opcional)
Configure uma vez: `rclone config` (remote do Google Drive) e `export GRAVAR_DRIVE_REMOTE="meu-drive:"`. Opcional: `GRAVAR_DRIVE_RAIZ` (pasta mãe,
padrão `Vídeos - Demos e Tutoriais`). O `entregar.py` cria pastas conforme o conteúdo:

```
<pasta mãe>/
  <Sistema>/                           <- ex.: Painel de Vendas, Proxmox, OpenProject
    <Tema ou número + tema>/           <- ex.: 01 Criar projeto
      <tema>_<nn>_<slug>.mp4 (+ .srt)
```

- Sistema e tema vêm do conteúdo do vídeo. Não invente pastas por data ou por tipo; o tipo vai no nome do arquivo quando precisar (`demo_`, `tutorial_`).
- O `entregar.py` cria as pastas em sequência e reaproveita as que existem (chamadas paralelas duplicam pasta no Drive). Rode antes com `--simular`.
- Diga ao final a conta e o caminho. Não crie link público sem pedido (`rclone link`); para devolver link, monte
  `https://drive.google.com/file/d/<ID>/view` com o ID de `rclone lsjson`.

## Armadilhas já vistas
- Algumas interfaces exigem permissões no nível raiz (ex.: Proxmox 9 pede `/` e `/mapping`), senão o painel fica em branco.
- Combos ExtJS: clique no campo e depois no `.x-boundlist-item`; listas vazias = falta permissão de leitura.
- Popups (console noVNC) abrem outra página e saem do vídeo: use a aba embutida na própria página.
- O vídeo do Playwright começa na criação da página; o kit já corta o carregamento inicial e desloca o áudio igual.
- Ticket/sessão vale de 1 a 2 h em muitos sistemas: planeje a gravação para caber, ou peça novo login.
- `networkidle` nunca chega em SPAs (o kit usa `load` + `prontoQuando`); textos em caixa alta costumam ser CSS; modais MUI sem `role=dialog`.
- A versão do Playwright do kit é fixa (1.63.0) para casar com o Chromium em `~/.cache/ms-playwright`; ao atualizar, rode `setup.sh`.
