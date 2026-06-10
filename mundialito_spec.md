# Mundialito — Especificação de Produto

**Versão:** 1.0  
**Stack:** React + Vite + Tailwind CSS + Supabase + Vercel  
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

## 2. Stack Técnica

| Camada | Tecnologia |
|---|---|
| Frontend | React + Vite |
| Estilo | Tailwind CSS |
| Banco de dados | Supabase (PostgreSQL) |
| Deploy | Vercel |
| Assets | JSON estático (jogadores, grupos, chaveamento) |

**Arquivos de dados incluídos no repositório:**
- `squads_final.json` — 1.248 jogadores com `name`, `ovr`, `position`, `club`, `league`, `source`
- `groups.json` — 12 grupos com seleções, força média e time mais fraco de cada grupo
- `bracket.json` — chaveamento completo dos 16-avos até a final

---

## 3. Fluxo do Usuário

```
Tela Inicial
    → Escolha do Modo (Rápido / Clássico)
    → Escolha da Formação
    → Sorteio do Grupo
    → Montagem do Time (sorteio de jogadores)
    → Copa — Fase de Grupos (3 jogos)
    → [se classificar] 16-avos → Oitavas → Quartas → Semi → Final
    → Tela de Resultado (campeão ou eliminado)
    → Compartilhar / Jogar de novo
```

---

## 4. Tela Inicial

**Layout (mobile, sem scroll):**
- Topbar: `[Seletor de idioma PT▾]` à esquerda · `[Retrô ⇄ / Moderno ⇄]` à direita
- Logo: MUNDIALITO (tipografia bold, destaque na segunda parte)
- Tagline: "Monte seu time. Dispute a copa."
- Mini campinho decorativo animado (bola se movendo, sem jogadores)
- Seção "Como jogar" com 3 passos:
  1. Sorteie jogadores entre as seleções que vão disputar a copa
  2. Entre na Copa do Mundo 2026
  3. Vença jogo a jogo e tente ser campeão do mundo!
- Botão principal: **"Montar o time"**

**Sem botão "Como funciona em detalhes".**

---

## 5. Modos de Jogo

### Modo Rápido
- Sem substituições
- Fatores ocultos mínimos (sem fadiga, sem entrosamento setorial)
- Animação de jogo: apenas placar + barra de progresso + feed de eventos
- Jogo inteiro em ~3 segundos
- Chance de ser campeão ligeiramente maior (~6-8% com time bom)

### Modo Clássico
- Substituições manuais disponíveis **entre jogos** (não durante)
- Todos os fatores ocultos ativos
- Animação de jogo: campinho com pontinhos animados + feed de eventos
- Tempo de jogo: ~15-20 segundos por partida
- Chance de ser campeão menor (~4-5% com time bom)

---

## 6. Formações Disponíveis

- 4-3-3
- 4-4-2
- 3-5-2
- 4-2-3-1
- 5-3-2

A formação define quantas vagas existem em cada setor (DEF / MID / FWD) durante o sorteio de jogadores.

---

## 7. Sorteio do Grupo

1. Um dos 12 grupos da Copa 2026 é sorteado — com peso inverso pela força média do grupo (grupos mais difíceis têm ligeiramente mais chance de ser sorteados).
2. O time do usuário substitui a seleção mais fraca do grupo sorteado (definida pela menor média de OVR).
3. O grupo sorteado é exibido com as 3 seleções adversárias e suas bandeiras.

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

## 8. Montagem do Time

### Fluxo de sorteio

1. Uma seleção é sorteada (animação de roleta entre bandeiras)
2. O campinho exibe **todas as posições ainda vazias iluminadas**
3. A lista exibe os jogadores da seleção sorteada agrupados por posição
4. O usuário toca na posição que quer preencher no campinho → a lista filtra para mostrar só os jogadores daquela posição
5. O usuário escolhe o jogador → ele entra na posição selecionada no campinho
6. Repete até completar o time titular (11 jogadores)

**Autonomia de posição:** o usuário pode preencher qualquer posição ainda vaga na ordem que quiser. Se vem uma seleção com um atacante excelente, ele pode preencher o ataque primeiro mesmo que ainda faltem defensores.

**Posições já completas:** jogadores de posições já preenchidas aparecem na lista com opacity reduzida e sem interação. O usuário entende visualmente que aquelas vagas não estão mais disponíveis.

### Pulo de seleção

Cada montagem de time tem **1 pulo disponível**. Se a seleção sorteada não for interessante, o usuário pode descartar e sortear uma nova. O pulo é consumido e não renova. Aparece como um indicador visível durante o sorteio ("1 pulo disponível" → "pulo usado").

A tensão de decisão — "guardo o pulo para uma posição mais importante ou uso agora?" — é intencional e parte da experiência.

### Reservas (Modo Clássico apenas)

Após completar o titular, o usuário sorteia mais 3 reservas — 1 DEF, 1 MID, 1 FWD — pelo mesmo processo, com 1 pulo adicional disponível para as reservas.

### Regras do sorteio
- Cada seleção pode ser sorteada mais de uma vez — o usuário pode ter 2 ou 3 jogadores do mesmo país
- Jogadores já escolhidos são removidos da lista de disponíveis daquela seleção

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

## 10. Fase de Grupos

- 3 jogos: time do usuário enfrenta cada adversário do grupo uma vez
- Os outros jogos do grupo são **simulados em segundo plano** pelo mesmo motor
- A tabela do grupo é atualizada após cada rodada (pontos, saldo de gols, gols marcados)
- **Classificação:** 2 primeiros de cada grupo + 8 melhores terceiros avançam para os 16-avos

**Critérios de desempate (padrão FIFA):**
1. Pontos
2. Saldo de gols
3. Gols marcados
4. Confronto direto

### Entre jogos (Modo Clássico)
Após cada jogo da fase de grupos, antes do próximo, exibir:
- OVR atual de cada jogador com seta (↑↓ comparado ao jogo anterior)
- Botão de substituição disponível (1 substituição por jogo, máximo 3 na copa)
- Reservas disponíveis com seus OVRs

---

## 11. Chaveamento do Mata-mata

Seguir o chaveamento oficial da Copa 2026 (arquivo `bracket.json`).

**Fases:**
- 16-avos (Round of 32): 16 jogos
- Oitavas: 8 jogos
- Quartas: 4 jogos
- Semifinais: 2 jogos
- Final: 1 jogo

**Total para ser campeão: 8 jogos** (3 grupos + 5 mata-mata)

Todos os confrontos do mata-mata que não envolvem o time do usuário são simulados em segundo plano para montar o chaveamento correto.

---

## 12. Animação de Jogo

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

### Lógica de animação do campinho (Modo Clássico)

O resultado do jogo é pré-calculado pelo motor. A animação é uma encenação.

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

Eventos possíveis e seus ícones:
- ⚽ Gol (nome do jogador + time)
- 🟨 Cartão amarelo
- 🟥 Cartão vermelho
- 📺 VAR (gol anulado ou confirmado)
- 🔄 Substituição (Modo Clássico)

Eventos são gerados consistentemente com o resultado pré-calculado. O timing dentro do jogo é distribuído aleatoriamente mas coerente (gols não aparecem todos no mesmo minuto).

---

## 13. Tela de Resultado

### Após cada jogo (Modo Clássico)
- Placar final
- Destaque do jogo (jogador com melhor performance)
- OVR atual de cada jogador com indicadores de oscilação
- Botão de substituição (se ainda disponível)
- Botão "Próximo jogo →"

### Eliminação
- Placar do jogo que eliminou
- Time completo exibido no campinho na formação escolhida, com nomes e OVRs ao lado
- Estatísticas da campanha: jogos disputados, gols feitos/sofridos, fase alcançada
- Botão "Salvar imagem" — gera PNG do campinho com o time
- Botão "Jogar de novo"

### Campeão
- Tela comemorativa com confetes (animação simples)
- Placar da final
- Time posicionado no campinho com nomes
- Estatísticas completas da campanha
- Botão "Salvar imagem"
- Botão "Jogar de novo"

### Compartilhamento
- "Salvar imagem" gera um PNG com:
  - Logo Mundialito
  - Resultado ("Fui campeão!" / "Cheguei até as quartas")
  - Time no campinho com nomes e OVRs
  - URL do jogo
- Formato otimizado para Stories (9:16) e feed quadrado

---

## 14. Persistência (Supabase)

### Tabela `copa_sessions`
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

### URL de compartilhamento
`mundialito.vercel.app/copa/[share_id]`

Exibe o time e o resultado da copa do usuário em modo somente leitura.

---

## 15. Visual e Temas

### Tema Retrô
- Fundo: `#061204` (preto esverdeado)
- Texto principal: `#c8f060` (verde neon)
- Texto secundário: `#6ab840`
- Texto mudo: `#4a8a2a`
- Bordas: `#2a5a1a`
- Campo: `#1a5a0a` com listras `#185408`
- Tipografia: `'Courier New', monospace`
- Botão primário: fundo `#2a6a10`, texto `#c8f060`, borda `#4a9a1a`
- Botão secundário: transparente, borda `#1a4010`, texto `#4a8a2a`
- Cantos: `border-radius: 2px` (quase retos)
- Letras: CAIXA ALTA nos títulos

### Tema Moderno
- Fundo: `#f7f7f5` (branco quente)
- Texto principal: `#1a1a1a`
- Texto secundário: `#888`
- Texto mudo: `#bbb`
- Bordas: `#e0e0d8`
- Campo: `#2e7d32` com listras sutis
- Tipografia: sistema (`var(--font-sans)`)
- Botão primário: fundo `#2e7d32`, texto `#fff`
- Botão secundário: transparente, borda `#e0e0d8`, texto `#888`
- Cantos: `border-radius: 10px` (arredondados)
- Letras: sentence case

### Cores dos jogadores no campinho
| | Retrô | Moderno |
|---|---|---|
| Time do usuário | `#f0e840` (amarelo) | `#fff176` (amarelo suave) |
| Time adversário | `#e83030` (vermelho) | `#ef5350` (vermelho suave) |
| Bola | `#ffffff` | `#ffffff` |

### Alternância de tema
- Botão no topbar: mostra o tema oposto ("Moderno ⇄" quando em Retrô)
- Preferência salva em `localStorage`
- Aplica-se a todas as telas

---

## 16. Idiomas

Todas as strings de interface em PT, EN e ES.  
Seletor no topbar (dropdown discreto).  
Preferência salva em `localStorage`.

**Strings principais:**

| Chave | PT | EN | ES |
|---|---|---|---|
| btn_play | Montar o time | Build your team | Armar el equipo |
| step_1 | Sorteie jogadores entre as seleções que vão disputar a copa | Draft players from World Cup squads | Sortea jugadores entre las selecciones del Mundial |
| step_2 | Entre na Copa do Mundo 2026 | Enter the 2026 World Cup | Entra al Mundial 2026 |
| step_3 | Vença jogo a jogo e tente ser campeão do mundo! | Win match by match and try to be world champion! | ¡Gana partido a partido e intenta ser campeón del mundo! |
| how_to | Como jogar | How to play | Cómo jugar |
| mode_fast | Modo Rápido | Quick Mode | Modo Rápido |
| mode_classic | Modo Clássico | Classic Mode | Modo Clásico |

---

## 17. Roadmap

### v1 — MVP (lançamento)
- Tela inicial com tema e idioma
- Escolha de modo e formação
- Sorteio de grupo
- Montagem do time (titular)
- Fase de grupos completa com simulação em segundo plano
- Mata-mata completo até a final
- Animação Modo Rápido
- Animação Modo Clássico com campinho
- Tela de resultado com campinho e time
- Salvar imagem para compartilhamento
- Persistência básica no Supabase
- Calibragem do motor via simulações (1.000+ copas automáticas)

### v2 — Pós-lançamento
- Reservas e substituições no Modo Clássico
- Fadiga e memória de oscilação
- Fator sede (EUA, México, Canadá)
- Ranking global ("quem está na final hoje?")
- URL de compartilhamento com copa do usuário
- Modo com grupos aleatórios

---

## 18. Arquivos de Dados

Os três arquivos JSON devem estar em `src/data/`:

- `squads_final.json` — jogadores de todas as 48 seleções
- `groups.json` — grupos com força média e time mais fraco
- `bracket.json` — chaveamento completo dos 16-avos à final

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
