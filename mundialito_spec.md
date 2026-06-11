# Mundialito — Especificação de Produto

**Versão:** 1.1 (atualizada em 2026-06-10 para refletir o estado atual da implementação)
**Stack:** React + Vite + Tailwind CSS (Supabase + Vercel planejados)
**Plataforma principal:** Mobile (360px). Desktop responsivo.
**Idiomas:** Português (padrão), Inglês, Espanhol

---

## 1. Visão Geral

Mundialito é um jogo casual de simulação de Copa do Mundo onde o usuário monta um time sorteando jogadores de seleções reais e disputa a Copa do Mundo 2026 com esse time. O objetivo é ser campeão — o que é genuinamente difícil, incentivando múltiplas tentativas.

**Princípios de design:**
- Sem login ou cadastro — zero fricção para começar
- Mobile-first — toda interface pensada para 360px
- Copa completa em menos de 5 minutos no Modo Rápido
- Dois temas visuais: Retrô e Moderno (alternável a qualquer momento)
- Três idiomas: PT / EN / ES

---

## 2. Estado da Implementação

| Área | Status |
|---|---|
| Tela inicial (tema, idioma, como jogar) | ✅ Implementada |
| Escolha de modo + formação (tela única) | ✅ Implementada |
| Montagem do time (titular, com pulo) | ✅ Implementada |
| Sorteio do grupo (animação + revelação) | ✅ Implementada |
| Motor de simulação (partida, grupos, copa completa) | ✅ Implementado em `src/engine/simulator.js` |
| Telas da Copa (animação de jogo, tabela do grupo, mata-mata) | ✅ Implementadas (`CupScreen`, `GroupStageScreen`, `KnockoutScreen`, `MatchPlay`) |
| Tela de resultado / campeão / eliminação | ✅ Implementada (`ResultScreen`, com confetes para campeão) |
| Reservas e substituições (Modo Clássico) | ⬜ Não implementadas (modo é escolhido mas ainda não afeta o gameplay) |
| Salvar imagem / compartilhamento | ⬜ Não implementado |
| Persistência (Supabase) | ⬜ Não implementada — tudo client-side, sem backend |

---

## 3. Stack Técnica

| Camada | Tecnologia | Status |
|---|---|---|
| Frontend | React + Vite | ✅ |
| Estilo | Tailwind CSS (via `@tailwindcss/vite`) + CSS custom properties para temas | ✅ |
| Banco de dados | Supabase (PostgreSQL) | planejado |
| Deploy | Vercel | planejado |
| Assets | JSON estático (jogadores, grupos, chaveamento) em `src/data/` | ✅ |

**Arquivos de dados incluídos no repositório (`src/data/`):**
- `squads_final.json` — objeto indexado por nome da seleção, com jogadores (`name`, `ovr`, `position`, `club`, `league`, `source`)
- `groups.json` — 12 grupos com seleções, força média e time mais fraco de cada grupo
- `bracket.json` — chaveamento completo dos 16-avos até a final (inclui disputa de 3º lugar)

**Estrutura do código:**
```
src/
  App.jsx              — shell do app: navegação por estado (sem router) e acúmulo do gameConfig
  index.css            — variáveis CSS dos dois temas + animações (bola, roleta, reveal, slide-in)
  screens/
    HomeScreen.jsx       — tela inicial
    ModeScreen.jsx       — escolha de modo + formação
    DraftScreen.jsx      — montagem do time (sorteio de jogadores + resumo)
    GroupScreen.jsx      — sorteio do grupo
    CupScreen.jsx        — orquestrador da copa (groups | knockout | result)
    GroupStageScreen.jsx — 3 jogos do grupo + tabela final
    KnockoutScreen.jsx   — preview de confronto + jogos do mata-mata
    ResultScreen.jsx     — campeão / vice / eliminado + estatísticas
  components/
    ThemeContext.jsx     — provider de tema (retro/moderno, localStorage)
    Flag.jsx             — bandeira de seleção via flagcdn.com (imagem PNG)
    MatchPlay.jsx        — animação de partida (Rápido/Clássico) + campinho simulado
    FieldPitch.jsx       — campinho com 11 slots (draft, resumo e resultado) + PitchLines
    formationLayouts.js  — layouts das formações, papéis e cores de posição
  i18n/
    LangContext.jsx    — provider de idioma (pt/en/es, localStorage, fallback para pt)
    translations.js    — todas as strings da interface
    flags.js           — códigos ISO 3166-1 alpha-2 por seleção (para o flagcdn)
  engine/
    simulator.js       — motor de simulação completo (ver seção 10)
    cup.js             — orquestração da copa do usuário: USER_TEAM_NAME, runTournament,
                         normalização de jogos (grupo = nomes, mata-mata = objetos),
                         campaignStats e stageLabelKey
  data/                — squads_final.json, groups.json, bracket.json
scripts/
  fix-leagues.cjs      — correção única do campo league em squads_final.json
```

> **Decisão técnica — bandeiras:** as bandeiras são imagens do flagcdn.com (`https://flagcdn.com/w40/{código}.png`, com `w80` para telas 2x), renderizadas pelo componente `Flag`. Emoji de bandeira não renderiza no Windows (Chrome/Edge mostram os códigos de texto "BR", "US"); Inglaterra e Escócia usam os códigos `gb-eng` / `gb-sct`. O time do usuário usa 🏳️ (emoji simples, renderiza em qualquer plataforma).

---

## 4. Fluxo do Usuário (atual)

> **Decisão de design:** a montagem do time acontece **antes** do sorteio do grupo (a spec original previa o inverso). O usuário monta o time sem saber quais adversários vai enfrentar — o sorteio do grupo funciona como revelação de desafio logo antes da copa começar.

```
Tela Inicial (home)
    → Escolha de Modo + Formação (mode) — uma tela única
    → Montagem do Time (draft) — sorteio de jogadores até completar o titular
    → Resumo do Time — campinho + estatísticas + lista dos 11
    → Sorteio do Grupo (group) — roleta + revelação dos adversários
    → Copa (cup) — fase de grupos (3 jogos + tabela)
        → [classificado] mata-mata: 16-avos → oitavas → quartas → semi → final
        → [eliminado] direto para o resultado
    → Resultado — campeão / vice / eliminado → "Jogar de novo" (reseta e volta à home)
```

A navegação é feita por estado local em `App.jsx` (`useState('home')`), sem react-router. Cada tela recebe `onBack`/`onContinue` e o `gameConfig` é acumulado progressivamente: `{ mode, formation }` → `{ ...players }` → `{ ...groupId }`.

---

## 5. Tela Inicial (`HomeScreen`)

**Layout (mobile, sem scroll):**
- Topbar: seletor de idioma (`<select>` PT/EN/ES) à esquerda · botão de alternância de tema à direita (mostra o nome do tema oposto + ⇄)
- Logo: MUNDI**ALITO** (duas partes, segunda com cor de destaque `--color-accent`; caixa alta no tema Retrô)
- Tagline: "Monte seu time. Dispute a copa."
- Mini campinho decorativo: SVG com linhas de campo (viewBox 105×68) + bola animada via keyframes CSS (`animate-ball`, loop de 6s), sem jogadores
- Seção "Como jogar" com 3 passos numerados:
  1. Sorteie jogadores entre as seleções que vão disputar a copa
  2. Entre na Copa do Mundo 2026
  3. Vença jogo a jogo e tente ser campeão do mundo!
- Botão principal: **"Montar o time"**

**Sem botão "Como funciona em detalhes".**

---

## 6. Escolha de Modo e Formação (`ModeScreen`)

> **Decisão de design:** modo e formação são escolhidos na **mesma tela** (a spec original previa duas etapas separadas).

- Header com botão voltar (←) e título "Como quer jogar?"
- Dois cards de modo (seleção destaca borda com `--color-accent` e fundo `--color-highlight-bg`):
  - ⚡ **Modo Rápido** — "Copa completa em minutos. Sem substituições."
  - 🏆 **Modo Clássico** — "Substitua jogadores entre jogos. Mais estratégia."
- Grid 3 colunas com as 5 formações (vindas de `FORMATIONS` no engine):
  - 4-3-3 · 4-4-2 · 3-5-2 · 4-2-3-1 · 5-3-2
- Botão "Continuar" só habilita com modo **e** formação selecionados

**Nota:** o modo escolhido é guardado no `gameConfig` mas ainda não altera o gameplay — as diferenças (substituições, fatores ocultos, animação) entram com as telas da copa.

### Comportamento esperado dos modos (a implementar nas telas da copa)

**Modo Rápido:** sem substituições, fatores ocultos mínimos, animação só com placar + barra de progresso + feed (~3s por jogo), chance de título ligeiramente maior (~6-8% com time bom).

**Modo Clássico:** substituições manuais entre jogos, todos os fatores ocultos ativos, animação com campinho + pontinhos + feed (~15-20s por jogo), chance de título menor (~4-5% com time bom).

---

## 7. Montagem do Time (`DraftScreen`)

A formação escolhida define um **layout fixo de 11 slots com papéis específicos** (ex.: 4-3-3 = GK, LB, CB, CB, RB, CM×3, LW, ST, RW), cada um com coordenadas no campinho (viewBox 105×68, defesa à esquerda). Os papéis mapeiam para 4 setores via `ROLE_TO_POSITION`: GK / DEF (LB, RB, CB, LWB, RWB) / MID (CM, LM, RM, CDM, LAM, CAM, RAM) / FWD (ST, LW, RW). A compatibilidade jogador↔slot é por **setor**, não por papel exato — qualquer DEF pode ocupar qualquer slot de defesa vago.

### Fluxo de sorteio (implementado)

1. O usuário toca em **"Sortear seleção"** — uma **roleta de slot machine**: fita horizontal de bandeiras que desacelera (rAF com ease-out cúbico, ~1,6s) até parar na seleção sorteada, dentro de uma janela com moldura central e máscaras de fade nas laterais
2. A seleção sorteada é revelada (bandeira + nome + dica contextual); qualquer uma das 48 seleções pode sair, com pesos iguais, e pode se repetir
3. A lista exibe o elenco completo da seleção, ordenado por posição (GK → DEF → MID → FWD) e por OVR decrescente; cada jogador com badge de posição colorido (cores por setor em variáveis CSS por tema), nome, clube · liga (com fallback "—" quando faltam dados) e OVR com cor por faixa (85+ accent, 75–84 normal, <75 secundário)
4. **O usuário toca primeiro no jogador** que quer — slots compatíveis vagos no campinho acendem com glow pulsante **na cor da posição**; slots incompatíveis ficam esmaecidos
5. O usuário toca no slot iluminado → o jogador entra na posição (pop de confirmação "{nome} escalado!")
6. **O próximo sorteio começa automaticamente** ~750ms após a escalação — o usuário só toca em "Sortear seleção" na primeira vez
7. Repete até completar os 11 titulares (contador "n/11" + barra de progresso no header)

### Completar automaticamente

Botão tracejado "⚡ Completar automaticamente" fica visível acima do campinho durante toda a montagem (exceto durante a roleta). Ao tocar, preenche todas as vagas restantes em sequência animada (uma a cada ~240ms): para cada vaga, sorteia uma seleção aleatória e escala **o melhor jogador disponível daquela posição** nessa seleção (com fallback para o melhor disponível global se a seleção sorteada não tiver ninguém da posição). Respeita os jogadores já usados e mantém o equilíbrio do sorteio — não monta um "time dos sonhos" determinístico.

> **Decisão de design:** a interação foi invertida em relação à spec original (que previa tocar na posição primeiro e filtrar a lista). Selecionar o jogador primeiro e iluminar os slots compatíveis se mostrou mais direto no mobile.

**Autonomia de posição:** o usuário preenche qualquer setor vago na ordem que quiser.

**Posições já completas:** jogadores de setores cheios (e jogadores já escolhidos) aparecem com opacity 0.35 e desabilitados.

### Pulo de seleção

Cada montagem tem **1 pulo**. O botão aparece ao lado da seleção revelada: "Pular (1x)" → ao usar, dispara novo sorteio imediatamente e vira "Pular (usado)" (desabilitado, opacity 0.4). Não renova.

A tensão de decisão — "guardo o pulo para uma posição mais importante ou uso agora?" — é intencional e parte da experiência.

### Regras do sorteio
- Cada seleção pode ser sorteada mais de uma vez — o usuário pode ter 2 ou 3 jogadores do mesmo país
- Jogadores já escolhidos são rastreados por `time::nome` e ficam indisponíveis se a mesma seleção voltar

### Resumo do time (ao completar os 11)

A própria `DraftScreen` troca para a visão de resumo:
- Título + chip com a formação escolhida
- Campinho com os 11 posicionados (bolinha amarela `--color-player-user` com OVR dentro e sobrenome em chip legível abaixo)
- 3 cards de estatística (entrada em cascata): **Geral** (média dos 11) · **Ataque** (média de MID+FWD) · **Defesa** (média de GK+DEF)
- Lista rolável dos 11 com badge de posição colorido, nome, **liga** (campo relevante para a coesão — não o clube) e OVR
- Botão "Continuar →" (leva ao sorteio do grupo)

### Reservas (Modo Clássico — não implementado)

Planejado: após o titular, sortear 3 reservas (1 DEF, 1 MID, 1 FWD) pelo mesmo processo, com 1 pulo adicional.

---

## 8. Sorteio do Grupo (`GroupScreen`)

Acontece **depois** da montagem do time, como última etapa antes da copa.

1. Ao entrar na tela, o sorteio já começa: uma **grade com as 12 fichas A–L** e um destaque que salta de ficha em ficha em sequência, desacelerando (cadeia única de timeouts com easing cúbico, ~2–3s) até **parar no grupo sorteado**, que pulsa em destaque antes da revelação
2. O grupo é sorteado por `pickGroup()` — **peso inverso pela força média** (`1 / avg_strength`): grupos mais difíceis têm ligeiramente mais chance
3. Revelação: "Grupo X" em destaque (`animate-reveal-pop`) + **chip de dificuldade colorido** (difícil = `--color-danger`, equilibrado = `--color-warn`, acessível = `--color-ok`) derivado da força média:
   - **Grupo difícil** — média > 74
   - **Grupo equilibrado** — média 72–74
   - **Grupo acessível** — média < 72
4. As 4 linhas do grupo entram em cascata (`animate-slide-in`). O time do usuário **substitui a seleção mais fraca** (`group.weakest`) e aparece destacado com bandeira 🏳️, badge "VOCÊ" e força "?" (oculta); os adversários aparecem com bandeira (imagem flagcdn via componente `Flag`), **barra de força animada** (`animate-bar-grow`, escala visual OVR 62–82) e o número
5. Nota explicativa: "Seu time entra no lugar de {seleção mais fraca}"
6. Botão "Começar a copa" — grava o `groupId` no `gameConfig` e navega para a `CupScreen`

**Grupos da Copa 2026:**

| Grupo | Seleções |
|---|---|
| A | México, África do Sul, Coreia do Sul, República Tcheca |
| B | Canadá, Bósnia, Catar, Suíça |
| C | Brasil, Marrocos, Haiti, Escócia |
| D | Estados Unidos, Paraguai, Austrália, Turquia |
| E | Alemanha, Curaçao, Costa do Marfim, Equador |
| F | Holanda, Japão, Suécia, Tunísia |
| G | Bélgica, Egito, Irã, Nova Zelândia |
| H | Espanha, Cabo Verde, Arábia Saudita, Uruguai |
| I | França, Senegal, Iraque, Noruega |
| J | Argentina, Argélia, Áustria, Jordânia |
| K | Portugal, RD Congo, Uzbequistão, Colômbia |
| L | Inglaterra, Croácia, Gana, Panamá |

---

## 9. Motor de Simulação

### 9.1 Cálculo de força por setor

Antes de cada jogo, o motor calcula a força de cada setor para os dois times:

```
Força de ataque  = média OVR dos atacantes titulares (com oscilação do dia)
Força de meio    = média OVR dos meias titulares (com oscilação do dia)
Força de defesa  = média OVR dos defensores + goleiro (com oscilação do dia)
```

O goleiro é incluído no setor defensivo para efeito de cálculo de força.

A força final de cada setor é multiplicada pelo coeficiente de coesão do time:

```
Força final = força do setor × coesão
```

### 9.2 Coesão do time

A coesão representa o entrosamento e é calculada por liga:

| Situação | Bônus |
|---|---|
| Time base (seleção real completa) | 100% |
| Time do usuário — base | 88% |
| +2 jogadores da mesma liga no mesmo setor | +3% |
| +3 jogadores da mesma liga no mesmo setor | +5% |
| Bônus máximo acumulável | até 97% |

As seleções reais têm coesão 100% por padrão.

### 9.3 Oscilação de OVR por jogo

A cada jogo, cada jogador recebe uma oscilação aleatória no OVR:

| Faixa de OVR | Range de oscilação | Chance de oscilar |
|---|---|---|
| 0–69 | -3 a +3 | 30% |
| 70–79 | -2 a +2 | 20% |
| 80–89 | -1 a +2 | 15% |
| 90–100 | -1 a +1 | 5% |

Jogadores bons têm leve assimetria positiva (range inclui +2 na faixa 80-89).  
O OVR exibido ao usuário no Modo Clássico reflete a oscilação do jogo atual, com seta indicando variação em relação ao jogo anterior.

### 9.4 Confronto entre times

```
Vantagem de ataque A = f(ataque_A, defesa_B)
Vantagem de ataque B = f(ataque_B, defesa_A)
Pressão de meio = diferença entre meios → bônus de 3-5% para o dominante
```

A vantagem usa rendimento decrescente para evitar placares absurdos:
```
vantagem_efetiva = log(1 + vantagem_bruta) × fator_escala
```

### 9.5 Geração de gols

Duas etapas separadas por time:

1. **Quantas oportunidades criou?** — função da vantagem de ataque vs defesa e pressão de meio
2. **Quantas converteu?** — fator separado, mais restritivo (~30-40% de conversão por oportunidade)

Isso produz placares realistas: 1×0, 2×1, 0×0 ocasional.

### 9.6 Empates e prorrogação

- **Fase de grupos:** empate é resultado válido (1 ponto cada)
- **Mata-mata:** empate leva à prorrogação. Se persistir, vai a pênaltis.

### 9.7 Pênaltis

Série de 5 cobranças por time. Para cada cobrança:

```
Chance de gol = 0.75 + (OVR_cobrador - OVR_goleiro) × 0.003
Chance mínima = 0.60 | Chance máxima = 0.92
```

Cobrador sempre favorito. Goleiro pode surpreender.

### 9.8 Fatores adicionais (Modo Clássico — v1)

**Substituição no momento certo:**  
Se um jogador oscilou negativamente em 2 jogos seguidos e o usuário o substitui pelo reserva da mesma posição, o substituto recebe bônus de +2 OVR no primeiro jogo ("frescor").

**Fadiga nas fases finais:**  
Jogadores que disputaram todos os jogos sem substituição acumulam -1 OVR nas semifinais e final.

**Fator sede (v2 — não implementar na v1):**  
EUA, México e Canadá recebem bônus escalonado pela força da seleção. Implementar após calibragem.

### 9.9 Dificuldade alvo (empírica)

Calibrar via simulações antes do lançamento. Metas orientativas:

| Time montado | Chance de ser campeão |
|---|---|
| Elite (melhores jogadores disponíveis) | ~12-15% |
| Bom | ~5-8% |
| Médio | ~2-4% |
| Fraco | ~0.5-1% |

---

## 10. API do Motor (`src/engine/simulator.js`)

O motor da seção 9 está implementado e exporta:

| Função | Descrição |
|---|---|
| `FORMATIONS` | Vagas por setor de cada formação (ex.: 4-3-3 = 1 GK, 4 DEF, 3 MID, 3 FWD) |
| `applyOscillation(ovr)` | Oscilação de OVR por jogo (9.3) |
| `getSquadPlayers(team)` / `getAllTeamNames()` | Acesso aos elencos de `squads_final.json` |
| `buildNationalTeam(team, formation)` | Monta o titular de uma seleção real (melhores OVRs por setor, padrão 4-3-3) |
| `getTeamStrength(team)` | Média de OVR do titular — usada na tela do grupo |
| `getGroupDifficulty(avg)` | Classifica o grupo em hard / balanced / easy |
| `calculateTeamStrengths(team)` | Força por setor com oscilação e coesão (9.1, 9.2) |
| `simulateMatch(a, b, { knockout })` | Partida completa: gols, prorrogação, pênaltis, eventos (9.4–9.7) |
| `simulatePenalties(a, b)` | Disputa de pênaltis com rodadas extras em caso de empate |
| `pickGroup()` / `getGroup(id)` / `getGroupOpponents(id)` | Sorteio ponderado e leitura dos grupos |
| `simulateGroupStage(groupId, userTeam)` | Fase de grupos do grupo do usuário (round-robin, tabela ordenada) |
| `simulateFullTournament(userTeam, groupId)` | Copa completa: 12 grupos + 8 melhores terceiros + mata-mata + final + 3º lugar |
| `getUserCampaign(tournament, userTeam)` | Resumo da campanha do usuário: jogos, fase alcançada, eliminado/campeão |
| `applyFreshnessBonus(player)` / `applyFatigue(player)` | Fatores do Modo Clássico (9.8) — ainda sem UI |

**Eventos de partida gerados:** gols (atribuídos a MID/FWD com peso pelo OVR), cartão amarelo (40% de chance por time), cartão vermelho (5%), distribuídos em minutos aleatórios e ordenados cronologicamente.

**Critérios de desempate na tabela (padrão FIFA):** pontos → saldo de gols → gols marcados → confronto direto.

**Classificação:** 2 primeiros de cada grupo + 8 melhores terceiros, alocados nos slots `3_XXXX` do `bracket.json` conforme os grupos de origem.

---

## 11. Fase de Grupos e Mata-mata (implementado)

A `CupScreen` chama `runTournament(gameConfig)` (`src/engine/cup.js`) **uma única vez ao montar**: a copa inteira (12 grupos + mata-mata) já está decidida antes da primeira animação — as telas apenas encenam o resultado. O time do usuário usa o nome interno fixo `__user__` (constante `USER_TEAM_NAME`), traduzido na exibição — comparações por nome no motor não podem depender do idioma.

### Fase de grupos (`GroupStageScreen`)
- 3 jogos do usuário, um por vez, com a animação de partida (`MatchPlay`, seção 12); rótulo "Fase de grupos · Rodada n"
- Botão "Próximo jogo →" entre os jogos, "Ver tabela →" após o 3º
- Tabela final do grupo: colunas P/J/V/E/D/SG/GP (ordenação FIFA já vem do motor), linha do usuário destacada, posição colorida (1–2 verde, 3 âmbar, 4 vermelho)
- Banner de status: "✅ Classificado para os 16-avos!" ou "❌ Eliminado na fase de grupos" — a classificação considera os 8 melhores terceiros
- Botão "Continuar →" (classificado) ou "Ver resultado →" (eliminado, vai direto à `ResultScreen`)

### Mata-mata (`KnockoutScreen`)
- Percorre só os jogos do usuário: 16-avos → oitavas → quartas → semi → final. **Total para ser campeão: 8 jogos**
- Entre jogos, tela de **preview do confronto**: chip com o nome da fase + cards "Seu Time vs {adversário}" (bandeira e força do adversário) + botão "Jogar →"
- Prorrogação e pênaltis: marcadores no feed ("⏱ Prorrogação", "🥅 Pênaltis — X–Y") e nota "{a}–{b} nos pênaltis" sob o placar
- Derrota → `ResultScreen` com a fase alcançada; vitória na final → `ResultScreen` com `champion = true`

### Pendente (Modo Clássico — v2)
- Entre jogos: OVR de cada jogador com seta ↑↓, botão de substituição (1 por jogo, máx. 3 na copa), reservas com OVRs

---

## 12. Animação de Jogo (implementada — `MatchPlay`)

Componente único para os dois modos: placar no topo (nomes + gols, atualizado conforme os eventos "acontecem"), rótulo da fase, barra de progresso com o minuto corrente, feed de eventos progressivo e botão de continuar ao fim. O relógio anima 0→90' (ou 120' com prorrogação) via `requestAnimationFrame` — **~3s no Rápido, ~16s no Clássico** — e há um botão "Pular ⏩" que salta para o fim. No Clássico, o campinho simulado (`PitchSim`) entra entre o placar e o feed. Cada evento do feed tem uma barrinha colorida indicando o lado (amarelo = usuário, vermelho = adversário).

### Modo Rápido
```
┌─────────────────────────────┐
│  SEU TIME  2 × 1  ALEMANHA  │  ← placar bold
│  Fase de Grupos · Rodada 1  │
├─────────────────────────────┤
│ ████████████░░░░░░░ 90'     │  ← barra de progresso (~3s)
├─────────────────────────────┤
│ ⚽ 23' Vinicius Jr          │
│ ⚽ 41' Musiala              │  ← feed de eventos
│ ⚽ 44' Neymar               │
└─────────────────────────────┘
```
Duração total: ~3 segundos. Sem campinho.

### Modo Clássico
```
┌─────────────────────────────┐
│  SEU TIME  2 × 1  ALEMANHA  │
│         67'  2º tempo       │
├─────────────────────────────┤
│                             │
│    [ campinho animado ]     │  ← SVG com pontinhos
│                             │
├─────────────────────────────┤
│ ⚽ 23' Vinicius Jr          │
│ ⚽ 41' Musiala              │  ← feed de eventos
│ ⚽ 44' Neymar               │
└─────────────────────────────┘
│ [Pausar]  (sub aparece só entre jogos)
```
Duração total: ~15-20 segundos por jogo.

### Lógica de animação do campinho (Modo Clássico — implementada em `PitchSim`)

O resultado do jogo é pré-calculado pelo motor. A animação é uma encenação: 11 pontinhos por time (formação do usuário de um lado, 4-3-3 espelhado para o adversário), tick de 300ms com transição CSS linear entre ticks. O estado de **oportunidade** é derivado dos gols pré-calculados (3 minutos antes de um gol, o time que vai marcar ganha a posse e converge para a área); no **gol**, o time marcador converge ao centro por ~2s e quem sofreu recomeça com a posse.

**Estados do campinho:**
- `posse_home` / `posse_away` — bola na metade do time com posse, jogadores do time avançam +10% em direção ao gol adversário
- `pressao` — 1-2 jogadores do time sem posse se aproximam da bola
- `oportunidade` — jogadores do time atacante convergem para a área
- `gol` — jogadores do time marcador convergem ao centro por 2 segundos, placar atualiza
- `transicao` — posse muda, posições se reorganizam

**Regras de movimento:**
- Cada jogador tem posição base definida pela formação
- A cada tick (300ms): move-se levemente em direção à posição base + ruído aleatório ±3%
- Jogadores próximos da bola (raio < 15% do campo): atraídos pela bola com pull proporcional à distância
- Goleiro permanece na sua área com variação mínima
- A bola se move em direção a um alvo dentro da metade do time com posse, mudando de alvo a cada 5-8 ticks
- Troca de posse: 15% de chance por tick

**Nota:** a animação é impressionista — transmite que um jogo está acontecendo, não simula física real.

### Feed de eventos (ambos os modos)

O motor gera ⚽ gol, 🟨 amarelo e 🟥 vermelho com minutos coerentes — exibidos progressivamente conforme o relógio, com marcadores de "⏱ Prorrogação" e "🥅 Pênaltis — X–Y". Planejados para a UI: 📺 VAR e 🔄 substituição (Modo Clássico).

---

## 13. Tela de Resultado (implementada — `ResultScreen`)

Três variações pelo mesmo layout: emoji + título, chip da fase alcançada, placar do último jogo (com bandeiras e nota de pênaltis), campinho com os 11 titulares (`FieldPitch`), grade "Sua campanha" com 6 estatísticas (jogos, vitórias, empates, derrotas, gols feitos, gols sofridos — via `campaignStats`) e botão "Jogar de novo" (reseta o `gameConfig` e volta à home).

- **Campeão:** 🏆 "Campeão do Mundo!" em destaque + chuva de confetes (40 partículas CSS, `animate-confetti`, cores das variáveis do tema)
- **Vice:** 🥈 "Vice-campeão do Mundo" (derrota na final — distinção além da spec original)
- **Eliminado:** ⚽ "Eliminado" + chip vermelho com a fase

### Pendente (v2)
- Destaque do jogo e OVRs com oscilação após cada partida (Modo Clássico)
- "Salvar imagem" — PNG com logo, resultado, time no campinho e URL, formato Stories (9:16) e feed quadrado

---

## 14. Persistência (Supabase — planejado, não implementado)

Hoje o jogo é 100% client-side; só tema e idioma persistem (em `localStorage`).

### Tabela `copa_sessions` (planejada)
```sql
id          uuid (PK)
created_at  timestamp
mode        text ('rapido' | 'classico')
theme       text ('retro' | 'moderno')
lang        text ('pt' | 'en' | 'es')
group_id    text (A-L)
formation   text
players     jsonb  -- array de jogadores com posição e OVR
result      text   -- fase alcançada
champion    boolean
share_id    text   -- ID curto para URL de compartilhamento
```

### URL de compartilhamento (planejada)
`mundialito.vercel.app/copa/[share_id]` — time e resultado em modo somente leitura.

---

## 15. Visual e Temas

**Implementação:** cada tema é uma classe (`theme-retro` / `theme-moderno`) aplicada ao shell do app, definindo CSS custom properties em `src/index.css`. Os componentes consomem só as variáveis (`var(--color-...)`, `var(--radius)`), então a troca de tema é instantânea em todas as telas. O shell tem `max-width: 360px` centralizado.

### Tema Retrô (`theme-retro`)
- Fundo: `#061204` (preto esverdeado)
- Texto principal / accent: `#c8f060` (verde neon)
- Texto secundário: `#6ab840` · Texto mudo: `#4a8a2a`
- Bordas: `#2a5a1a`
- Campo: `#1a5a0a` com listras `#185408`; linhas do campo em verde neon translúcido
- Tipografia: `'Courier New', monospace`
- Botão primário: fundo `#2a6a10`, texto `#c8f060`, borda `#4a9a1a`
- Botão secundário: transparente, borda `#1a4010`, texto `#4a8a2a`
- Cantos: `--radius: 2px` (quase retos)
- Letras: CAIXA ALTA nos títulos (aplicada condicionalmente nos componentes via `isRetro`)

### Tema Moderno (`theme-moderno`) — padrão
- Fundo: `#f7f7f5` (branco quente)
- Texto principal: `#1a1a1a` · Accent: `#2e7d32`
- Texto secundário: `#888` · Texto mudo: `#bbb`
- Bordas: `#e0e0d8`
- Campo: `#2e7d32` com listras `#2a712d`; linhas do campo em branco translúcido
- Tipografia: sistema (`system-ui, sans-serif`)
- Botão primário: fundo `#2e7d32`, texto `#fff`
- Botão secundário: transparente, borda `#e0e0d8`, texto `#888`
- Cantos: `--radius: 10px` (arredondados)
- Letras: sentence case

### Cores dos jogadores no campinho
| | Retrô | Moderno |
|---|---|---|
| Time do usuário | `#f0e840` (amarelo) | `#fff176` (amarelo suave) |
| Time adversário | `#e83030` (vermelho) | `#ef5350` (vermelho suave) |
| Bola | `#ffffff` | `#ffffff` |

### Alternância de tema
- Botão no topbar da tela inicial: mostra o tema oposto ("Moderno ⇄" quando em Retrô)
- `ThemeContext` (`src/components/ThemeContext.jsx`): padrão `moderno`, persistido em `localStorage` (`mundialito_theme`)
- Aplica-se a todas as telas

### Animações CSS disponíveis (`index.css`)
- `animate-ball` — bola percorrendo o mini campinho da home (6s, loop)
- `animate-reveal-pop` — pop de revelação (grupo sorteado, seleção sorteada, jogador escalado)
- `animate-slide-in` — entrada lateral em cascata (linhas do grupo)
- `animate-rise-in` — entrada de baixo com fade (chips, cards de estatística, botões)
- `animate-glow-pulse` — brilho pulsante via `currentColor` (slots compatíveis no campinho)
- `animate-bar-grow` — crescimento horizontal (barras de força do grupo)
- `reel-fade-left` / `reel-fade-right` — máscaras de gradiente da roleta de bandeiras

A roleta de bandeiras do draft é animada via `requestAnimationFrame` com ease-out cúbico (não CSS), para parar exatamente na seleção sorteada.

### Cores semânticas adicionais (variáveis por tema)
- `--color-pos-gk` / `--color-pos-def` / `--color-pos-mid` / `--color-pos-fwd` — badges e glow por setor
- `--color-ok` / `--color-warn` / `--color-danger` — chips de dificuldade do grupo

---

## 16. Idiomas

Implementado via `LangContext` (`src/i18n/LangContext.jsx`):
- Idiomas: PT (padrão) / EN / ES
- Seletor no topbar da tela inicial (dropdown)
- Persistido em `localStorage` (`mundialito_lang`)
- `t(key)` com fallback: idioma atual → PT → a própria chave

Todas as strings vivem em `src/i18n/translations.js` (telas inicial, modo, montagem, resumo e grupo já cobertas nos 3 idiomas). Bandeiras emoji por seleção em `src/i18n/flags.js`.

**Exemplos de strings:**

| Chave | PT | EN | ES |
|---|---|---|---|
| btn_play | Montar o time | Build your team | Armar el equipo |
| choose_mode_title | Como quer jogar? | How do you want to play? | (ver translations.js) |
| btn_draw_squad | Sortear seleção | Draw a nation | (ver translations.js) |
| btn_start_cup | Começar a copa | Start the cup | (ver translations.js) |

---

## 17. Roadmap

### v1 — MVP (lançamento)
- [x] Tela inicial com tema e idioma
- [x] Escolha de modo e formação (tela única)
- [x] Montagem do time (titular, com pulo e resumo)
- [x] Sorteio de grupo
- [x] Motor de simulação completo (partida, grupos, copa inteira, pênaltis, eventos)
- [x] Telas da copa: fase de grupos com tabela + simulação em segundo plano
- [x] Telas do mata-mata até a final
- [x] Animação Modo Rápido
- [x] Animação Modo Clássico com campinho
- [x] Tela de resultado com campinho e time
- [ ] Salvar imagem para compartilhamento
- [ ] Persistência básica no Supabase
- [ ] Calibragem do motor via simulações (1.000+ copas automáticas)

### v2 — Pós-lançamento
- Reservas e substituições no Modo Clássico (helpers de frescor/fadiga já existem no motor)
- Fadiga e memória de oscilação
- Fator sede (EUA, México, Canadá)
- Ranking global ("quem está na final hoje?")
- URL de compartilhamento com copa do usuário
- Modo com grupos aleatórios

---

## 18. Arquivos de Dados

Os três arquivos JSON estão em `src/data/`:

- `squads_final.json` — objeto indexado por nome da seleção (48 seleções), cada uma com seu array de jogadores
- `groups.json` — objeto indexado por letra do grupo (A–L), com força média e time mais fraco
- `bracket.json` — chaveamento completo: `round_of_32`, `round_of_16`, `quarterfinals`, `semifinals`, `final`, `third_place`; slots de terceiros colocados no formato `3_XXXX` (grupos elegíveis) e vencedores referenciados como `W_<matchId>`

**Qualidade do campo `league`:** o arquivo foi saneado por `scripts/fix-leagues.cjs` (executado em 2026-06-10): ligas inferidas pelo clube quando `league` era null, aliases com patrocinador normalizados para nomes canônicos ("LALIGA EA SPORTS" → "La Liga", "Serie A Enilive" → "Serie A" etc. — essencial porque o bônus de coesão compara strings de liga), copas continentais ("Libertadores"/"Sudamericana") trocadas pela liga doméstica do clube, e seleções de base doméstica (Catar, Irã, Egito, Iraque, Jordânia, Uzbequistão, África do Sul, Arábia Saudita) preenchidas com a liga nacional. Restam ~120 jogadores sem clube nem liga conhecidos (elencos de diáspora) — a UI exibe "—" nesses casos.

**Estrutura do jogador:**
```json
{
  "name": "Vinicius Junior",
  "ovr": 91,
  "position": "FWD",
  "club": "Real Madrid",
  "league": "La Liga",
  "source": "manual"
}
```

**Estrutura do grupo:**
```json
{
  "teams": ["Brasil", "Marrocos", "Haiti", "Escócia"],
  "avg_strength": 74.3,
  "weakest": "Haiti",
  "weakest_strength": 67.3
}
```
