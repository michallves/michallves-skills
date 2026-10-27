---
name: fluxo-dev
description: Use ao criar branch, fazer commit, push ou abrir Pull Request, seguindo um fluxo de desenvolvimento padrão (branch com id da task, commits [ID][TIPO] e versionamento SemVer automático), ajustável ao tamanho do time.
---

# Fluxo de desenvolvimento (genérico e flexível)

Fluxo padrão para qualquer projeto: da task no board até o Pull Request, com versionamento SemVer automático a partir dos commits. Use ao criar branch, commitar, fazer push ou abrir PR. Responda no idioma do usuário; título e mensagem de commit em inglês.

## Princípio: padrão, não regra rígida
Este fluxo é o **caminho padrão**, não uma lei. Quem lidera o projeto (tech lead) pode pular ou adaptar etapas quando fizer sentido (hotfix, repositório pessoal, mudança trivial, time pequeno).
- Se o usuário pedir para pular uma etapa, pule sem resistir e sem sermão. No máximo uma frase curta dizendo o que deixa de valer (ex.: "sem rebase, o PR pode abrir com conflito").
- Se algo fugir do padrão por aparente descuido (ex.: commit sem tipo), avise uma vez e siga o que o usuário decidir.
- A única trava fixa é de segurança: pedir ok antes de push e de abrir PR (o usuário pode dispensar dizendo "pode mandar direto") e nunca fazer merge sem ele pedir.

## O tamanho do time muda o rigor
Pergunte o tamanho do time se não souber e ajuste. Os valores são ponto de partida; o usuário pode definir outros por projeto.

| Time | Reviewers por PR | Aprovações mínimas | Observação |
|---|---|---|---|
| Solo | 0 | 0 | merge direto; PR opcional |
| Pequeno (2 a 4 pessoas) | 1 | 1 | review leve, SLA curto |
| Médio (5 a 10) | 2 | 2 | padrão original do fluxo |
| Grande (11+) | 3 | 2 ou 3 | considere CODEOWNERS e revisor da área |

## 0. Antes de começar
- Descubra o **id da task** do board (ex.: `BR-0001`). O prefixo muda por projeto. Se não souber, pergunte; sem board, use um slug curto.
- Confirme o repositório e a branch base (`develop` neste guia; use a principal do projeto se for outra).

## 1. Branch
- Nome da branch = id da task (ex.: `BR-0001`).
- A partir da base atualizada:
  ```
  git checkout develop
  git pull origin develop
  git checkout -b BR-0001
  ```

## 2. Implementação e testes
- Implemente só o que a task pede.
- Escreva testes unitários e rode antes de commitar (em hotfix ou mudança trivial, a critério do usuário).

## 3. Commit
- Título (1ª linha): `[ID_DA_TASK][TIPO] short summary`.
- Corpo: bullets técnicos com `-` detalhando as ações.
- Exemplo:
  ```
  git commit -m "[BR-0001][FEAT] integrate address validation" -m "- Created authentication middleware for JWT validation;
  - Integrated ViaCEP API for automatic address lookup;
  - Handled API exception for invalid zip codes."
  ```

### Tipos e impacto no versionamento (SemVer MAJOR.MINOR.PATCH)
| Tipo | Impacto |
|---|---|
| `[MAJOR]` | MAJOR (quebra de compatibilidade) |
| `[FEAT]` | MINOR (nova funcionalidade) |
| `[FIX]` | PATCH (correção de bug) |
| `[PERF]` | PATCH (performance) |
| `[CHORE]` | PATCH (setup, dependências, tarefas administrativas) |
| `[REFACTOR]` | nenhum (limpeza de código) |
| `[DEVOPS]` | nenhum (automação, GitHub Actions) |
| `[DOCS]` | nenhum (documentação) |
| `[TEST]` | nenhum (adição ou alteração de testes) |
| `[STYLE]` | nenhum (formatação/lint, sem mudar lógica) |

Automação usa `[DEVOPS]` (não `[CI]`). Se o projeto tratar algum tipo diferente (ex.: `[CHORE]` como "nenhum"), siga o do projeto.

Uma GitHub Action lê esses tipos quando o líder faz merge na `develop`: sobe MAJOR se houver `[MAJOR]`, senão MINOR se houver `[FEAT]`, senão PATCH, e gera o release com changelog. Ninguém cria tag manualmente. Se o projeto não tiver essa Action, os tipos continuam úteis como convenção de histórico.

## 4. Push
- Antes do push, rebase na base: `git fetch origin && git rebase origin/develop`.
- Resolva conflitos, commite e `git push origin BR-0001`.
- Se a branch já estava publicada e o rebase reescreveu o histórico, use `git push --force-with-lease origin BR-0001` (nunca `--force` puro).

## 5. Pull Request
- Base: `develop`. Compare: a branch da task.
- Título: o do último commit, ex.: `[BR-0001][FEAT] add address validation`.
- Descrição: consolide os bullets dos commits da branch.
- Assignee: o próprio autor. Reviewers: conforme a tabela de tamanho do time (nunca invente nomes; pergunte).
- Merge: **evite Squash and Merge** (apaga os tipos dos commits e quebra a Action de versionamento). Prefira *Create a merge commit*. Pode marcar *Delete source branch*.
- Aprovações e CI conforme a tabela do time. O merge é do líder; o dev só pede o merge.
- Mensagem para o time depois de abrir o PR (quando houver reviewers):
  ```
  Novo PR para Review
  Task: [link da task no board]
  PR: [link do GitHub]
  Reviewers: @membro1 @membro2
  ```
- Branch desatualizada ou com conflito: `git checkout develop && git pull origin develop`, depois `git checkout sua-branch && git rebase develop`, resolva e `git push --force-with-lease origin sua-branch`.

## Regras de execução
- Pode executar localmente: criar branch, commits, rebase.
- Peça o ok do usuário antes de push e antes de abrir o PR, a menos que ele já tenha dispensado.
- Não faça merge sem ele pedir.
- Nunca invente o id da task nem os reviewers.
- Se o repositório tiver `CLAUDE.md` ou template de PR próprio, eles complementam este fluxo; em conflito, avise uma vez e siga o que o usuário decidir.
