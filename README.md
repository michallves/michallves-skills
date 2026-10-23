# michallves-skills

Skills para o [Claude Code](https://claude.com/claude-code) que eu uso no dia a dia. Cada skill fica numa pasta própria em `skills/`.

| Skill | O que faz |
|---|---|
| [`gravar-video`](skills/gravar-video/SKILL.md) | Planeja, grava, verifica e entrega vídeos de **demo** ou **tutorial** de qualquer sistema web, com ou sem narração em português |

## Instalar uma skill

Copie a pasta da skill para `~/.claude/skills/` (ou para `.claude/skills/` dentro de um projeto):

```bash
git clone https://github.com/michallves/michallves-skills.git
cp -r michallves-skills/skills/gravar-video ~/.claude/skills/
```

Na próxima sessão do Claude Code, a skill aparece na lista e é usada quando o pedido combina com a descrição
(por exemplo, "grave um tutorial em vídeo deste sistema").

## gravar-video

Um kit em Node + Python em `skills/gravar-video/toolkit/`. Você escreve um roteiro em YAML (ou `.mjs` para telas complexas) e o kit:

- grava a tela com Playwright, com cursor visível, balões "Passo guiado" e cartões de capítulo;
- narra com voz neural em pt-BR (`edge-tts`, voz Thalita por padrão) e mixa com o vídeo (`ffmpeg`);
- gera legendas `.srt` e normaliza o volume (-16 LUFS);
- reaproveita falas e capítulos já gravados (cache), tem modo **rascunho** (720p, rápido) e dicionário de pronúncia para siglas e IPs;
- verifica o resultado (resolução, áudio, volume, tela preta, imagem parada);
- opcionalmente sobe para o Google Drive em pastas por sistema e tema, via `rclone`.

### Pré-requisitos

`node` 20+, `python3` com `venv`, `ffmpeg` e `ffprobe`. O `rclone` só é necessário para a entrega no Drive.

### Teste rápido

```bash
cd skills/gravar-video/toolkit
bin/setup.sh ~/meu-projeto              # instala dependências e cria o projeto com um roteiro modelo
(cd exemplos && python3 -m http.server 8765 --bind 127.0.0.1 &)
cd ~/meu-projeto
node ~/.claude/skills/gravar-video/toolkit/bin/gravar.mjs roteiro.yaml teste.mp4
node ~/.claude/skills/gravar-video/toolkit/bin/verificar.mjs out/teste.mp4
```

O roteiro modelo grava a página de exemplo servida localmente. Troque `base` e os seletores pelo seu sistema.

### Cuidados

- **Login é seu.** O kit nunca guarda nem digita senha: você faz o login num script seu e aponta `sessao:` para o arquivo de sessão do Playwright.
- **Não grave em produção** sem saber o que o roteiro faz. Use um ambiente de teste e limpe o que criar.
- A narração usa o serviço online do `edge-tts`: o texto do roteiro é enviado para a Microsoft. Não coloque dados sensíveis nas falas.
- Versão do Playwright fixada em 1.63.0 (casa com o Chromium em cache); `setup.sh` instala o que faltar.

## Licença

[MIT](LICENSE). Use, copie e adapte à vontade. Se melhorar alguma skill, abra um PR ou issue.
