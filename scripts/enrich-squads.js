// Ferramenta de desenvolvimento — NÃO faz parte do app.
// Enriquece src/data/squads_final.json com dados do EA FC 26
// (data-sources/EAFC26-Men-selected-columns-v2.csv): roles reais, posições
// alternativas, pênaltis, ligas, e redistribui OVRs dos jogadores estimados.
//
// Uso:
//   node scripts/enrich-squads.js           → só imprime o relatório (não escreve nada)
//   node scripts/enrich-squads.js --apply   → backup + grava squads_final.json e groups.json
import { readFileSync, writeFileSync, copyFileSync } from 'node:fs'

const APPLY = process.argv.includes('--apply')

const squadsUrl = new URL('../src/data/squads_final.json', import.meta.url)
const groupsUrl = new URL('../src/data/groups.json', import.meta.url)
const backupUrl = new URL('../src/data/squads_final.backup.json', import.meta.url)
const csvUrl = new URL('../data-sources/EAFC26-Men-selected-columns-v2.csv', import.meta.url)

const squads = JSON.parse(readFileSync(squadsUrl, 'utf8'))
const groups = JSON.parse(readFileSync(groupsUrl, 'utf8'))

// ---------------------------------------------------------------------------
// CSV
// ---------------------------------------------------------------------------

function parseLine(line) {
  const fields = []
  let cur = ''
  let inQuotes = false
  for (const ch of line) {
    if (ch === '"') inQuotes = !inQuotes
    else if (ch === ',' && !inQuotes) {
      fields.push(cur)
      cur = ''
    } else cur += ch
  }
  fields.push(cur)
  return fields
}

const csvLines = readFileSync(csvUrl, 'utf8').split(/\r?\n/).filter(Boolean)
const header = parseLine(csvLines[0])
const COL = Object.fromEntries(header.map((h, i) => [h, i]))

const csvRows = csvLines.slice(1).map((line) => {
  const f = parseLine(line)
  return {
    name: f[COL.Name],
    ovr: Number(f[COL.OVR]),
    penalties: Number(f[COL.Penalties]),
    role: f[COL.Position],
    altRoles: f[COL['Alternative positions']].match(/[A-Z]{2,3}/g) || [],
    nation: f[COL.Nation],
    league: f[COL.League],
  }
})

// ---------------------------------------------------------------------------
// Matching nome + nação (normalizando acentos e variações)
// ---------------------------------------------------------------------------

// Nomes das seleções (PT) → Nation do CSV. "Catar" não existe no CSV
// (EA FC 26 não licencia o Qatar) — fica mapeado mas nunca casa.
const NATION_MAP = {
  'México': 'Mexico',
  'África do Sul': 'South Africa',
  'Coreia do Sul': 'Korea Republic',
  'República Tcheca': 'Czech Republic',
  'Canadá': 'Canada',
  'Bósnia': 'Bosnia and Herzegovina',
  'Catar': 'Qatar',
  'Suíça': 'Switzerland',
  'Brasil': 'Brazil',
  'Marrocos': 'Morocco',
  'Haiti': 'Haiti',
  'Escócia': 'Scotland',
  'Estados Unidos': 'United States',
  'Paraguai': 'Paraguay',
  'Austrália': 'Australia',
  'Turquia': 'Turkey',
  'Alemanha': 'Germany',
  'Curaçao': 'Curaçao',
  'Costa do Marfim': "Côte d'Ivoire",
  'Equador': 'Ecuador',
  'Holanda': 'Holland',
  'Japão': 'Japan',
  'Suécia': 'Sweden',
  'Tunísia': 'Tunisia',
  'Bélgica': 'Belgium',
  'Egito': 'Egypt',
  'Irã': 'Iran',
  'Nova Zelândia': 'New Zealand',
  'Espanha': 'Spain',
  'Cabo Verde': 'Cape Verde Islands',
  'Arábia Saudita': 'Saudi Arabia',
  'Uruguai': 'Uruguay',
  'França': 'France',
  'Senegal': 'Senegal',
  'Iraque': 'Iraq',
  'Noruega': 'Norway',
  'Argentina': 'Argentina',
  'Argélia': 'Algeria',
  'Áustria': 'Austria',
  'Jordânia': 'Jordan',
  'Portugal': 'Portugal',
  'Colômbia': 'Colombia',
  'RD Congo': 'Congo DR',
  'Uzbequistão': 'Uzbekistan',
  'Inglaterra': 'England',
  'Croácia': 'Croatia',
  'Gana': 'Ghana',
  'Panamá': 'Panama',
}

const missingNations = Object.keys(squads).filter((t) => !NATION_MAP[t])
if (missingNations.length) {
  console.error('Seleções sem mapeamento de nação:', missingNations.join(', '))
  process.exit(1)
}

// Grafias do squads → nome usado no CSV (typos e apelidos do EA)
const ALIASES = {
  'Uruguai|Frederico Valverde': 'Federico Valverde',
  'Brasil|Vinicius Junior': 'Vini Jr.',
  'Argentina|Nicolás Paz': 'Nico Paz', // o "Nicolás Paz" do CSV é um zagueiro homônimo
  'Escócia|Andy Robertson': 'Andrew Robertson',
}

// Jogadores que NÃO estão no EA FC 26 (clubes fora do jogo: Flamengo, Zenit,
// Botafogo) mas têm homônimos/nomes parecidos no CSV — bloqueia falso positivo.
const NO_MATCH = new Set([
  'Brasil|Danilo',
  'Brasil|Danilo Santos',
  'Brasil|Alex Sandro',
  'Brasil|Douglas Santos',
])

// OVR corrigido manualmente em jogadores COM match: estimativas antigas do
// squads claramente erradas — o dado do EA é a fonte.
const OVR_FIXES = {
  'Argentina|Nicolás Paz': 79, // squads tinha 70; EA FC 26 dá 79 (Como)
}

// Correções manuais de dados do squads, independentes do CSV.
// Emiliano Martínez do Uruguai é o volante uruguaio (Rayo Vallecano), que
// herdou por engano OVR/clube do goleiro argentino homônimo.
const DATA_FIXES = {
  'Uruguai|Emiliano Martínez': { ovr: 75, position: 'MID', league: 'LALIGA EA SPORTS' },
}

// Caracteres que o NFD não decompõe em base + acento
const CHAR_MAP = { 'ø': 'o', 'ı': 'i', 'đ': 'd', 'ł': 'l', 'ß': 'ss', 'æ': 'ae', 'œ': 'oe', 'ð': 'd', 'þ': 'th' }

function normalizeName(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // remove acentos
    .replace(/[øıđłßæœðþ]/g, (ch) => CHAR_MAP[ch])
    .replace(/[-'.]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// Tokens ordenados: casa "Son Heung-min" com "Heung Min Son"
const tokenKey = (name) => normalizeName(name).split(' ').sort().join(' ')
// Tokens ordenados sem separador: casa "Son Heungmin" com "Heung Min Son"
const joinKey = (name) => normalizeName(name).split(' ').sort().join('')
// Anagrama: último recurso para segmentação diferente ("Kim Minjae" vs "Min Jae Kim")
const anagramKey = (name) => [...normalizeName(name).replaceAll(' ', '')].sort().join('')

function addToIndex(index, key, row) {
  const list = index.get(key)
  if (list) list.push(row)
  else index.set(key, [row])
}

const byExact = new Map()
const byTokens = new Map()
const byJoin = new Map()
const byAnagram = new Map()
const byNation = new Map()
const byExactGlobal = new Map()
const byTokensGlobal = new Map()
csvRows.forEach((row) => {
  addToIndex(byExact, `${normalizeName(row.name)}|${row.nation}`, row)
  addToIndex(byTokens, `${tokenKey(row.name)}|${row.nation}`, row)
  addToIndex(byJoin, `${joinKey(row.name)}|${row.nation}`, row)
  addToIndex(byAnagram, `${anagramKey(row.name)}|${row.nation}`, row)
  addToIndex(byNation, row.nation, row)
  addToIndex(byExactGlobal, normalizeName(row.name), row)
  addToIndex(byTokensGlobal, tokenKey(row.name), row)
})

// Homônimos (ex.: vários "Danilo" no Brasil): desempata pelo OVR mais próximo do atual
function closestByOvr(list, ovr) {
  if (!list?.length) return null
  return list.reduce((a, b) => (Math.abs(b.ovr - ovr) < Math.abs(a.ovr - ovr) ? b : a))
}

const isSubset = (a, b) => [...a].every((t) => b.has(t))

function findInCsv(playerName, nation, ovr, allowGlobal = false) {
  const tries = [
    ['exact', byExact.get(`${normalizeName(playerName)}|${nation}`)],
    ['tokens', byTokens.get(`${tokenKey(playerName)}|${nation}`)],
    ['join', byJoin.get(`${joinKey(playerName)}|${nation}`)],
    ['anagram', byAnagram.get(`${anagramKey(playerName)}|${nation}`)],
  ]
  for (const [method, list] of tries) {
    const row = closestByOvr(list, ovr)
    if (row) return { row, method }
  }

  // Mononônimos / nomes parciais dentro da nação: "Courtois" ⊂ "Thibaut Courtois",
  // "Grimaldo" (CSV) ⊂ "Álex Grimaldo". OVR a até 5 pontos de distância, para não
  // casar homônimos parciais (ex.: "Santos" ovr 59 ⊄ "Douglas Santos" ovr 72).
  const myTokens = new Set(normalizeName(playerName).split(' '))
  const candidates = (byNation.get(nation) || []).filter((r) => {
    const csvTokens = new Set(normalizeName(r.name).split(' '))
    return isSubset(myTokens, csvTokens) || isSubset(csvTokens, myTokens)
  })
  const subsetRow = closestByOvr(candidates, ovr)
  if (subsetRow && Math.abs(subsetRow.ovr - ovr) <= 5) return { row: subsetRow, method: 'subset' }

  // Dupla nacionalidade: jogadores com source "eafc" existem no jogo, mas o CSV
  // pode registrá-los sob outra nação (Issa Diop → France). Aceita match global
  // se o nome for único no CSV inteiro e o OVR estiver próximo.
  if (allowGlobal) {
    const list = byExactGlobal.get(normalizeName(playerName)) || byTokensGlobal.get(tokenKey(playerName))
    if (list?.length === 1 && Math.abs(list[0].ovr - ovr) <= 5) {
      return { row: list[0], method: 'global' }
    }
  }

  return null
}

// ---------------------------------------------------------------------------
// Setores
// ---------------------------------------------------------------------------

const ROLE_TO_SECTOR = {
  GK: 'GK',
  CB: 'DEF', RB: 'DEF', LB: 'DEF',
  CDM: 'MID', CM: 'MID', CAM: 'MID', LM: 'MID', RM: 'MID',
  LW: 'FWD', RW: 'FWD', ST: 'FWD',
}

// ---------------------------------------------------------------------------
// RNG com seed fixa (reproduzível)
// ---------------------------------------------------------------------------

function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const rng = mulberry32(20260611)
const randInt = (min, max) => min + Math.floor(rng() * (max - min + 1)) // inclusivo

// ---------------------------------------------------------------------------
// Transformação
// ---------------------------------------------------------------------------

const stats = {
  total: 0,
  matched: 0,
  byMethod: {}, // método de matching → contagem
  nonExact: [], // matches por alias/tokens/anagrama/subset, para conferência
  unmatched: [], // { team, name, ovr, source }
  sectorChanged: [],
  wingersPromoted: [], // LM/RM com alternativa FWD → setor principal FWD
  dataFixes: [],
  gainedAltRoles: 0,
  crossSectorAlt: 0,
  leagueOutra: 0,
  ovrBefore: {}, // team → [ovrs]
  ovrAfter: {},
}

const dataFixed = new Set() // não entram na redistribuição de OVR
const newSquads = {}

Object.entries(squads).forEach(([team, players]) => {
  const nation = NATION_MAP[team]
  stats.ovrBefore[team] = players.map((p) => p.ovr)

  const enriched = players.map((p) => {
    stats.total++

    const fix = DATA_FIXES[`${team}|${p.name}`]
    if (fix) {
      const fixed = {
        name: p.name,
        ovr: fix.ovr,
        position: fix.position,
        altPositions: [],
        role: null,
        altRoles: [],
        penalties: null,
        league: fix.league,
        source: 'estimated',
      }
      dataFixed.add(fixed)
      stats.dataFixes.push({ team, name: p.name, before: `${p.position} ovr ${p.ovr}`, after: `${fix.position} ovr ${fix.ovr}` })
      return fixed
    }

    const lookupName = ALIASES[`${team}|${p.name}`] || p.name
    const found = NO_MATCH.has(`${team}|${p.name}`)
      ? null
      : findInCsv(lookupName, nation, p.ovr, p.source === 'eafc')

    if (found) {
      const { row } = found
      const method = lookupName !== p.name ? 'alias' : found.method
      stats.matched++
      stats.byMethod[method] = (stats.byMethod[method] || 0) + 1
      if (method !== 'exact') {
        const csvLabel = method === 'global' ? `${row.name} [${row.nation}]` : row.name
        stats.nonExact.push({ team, name: p.name, ovr: p.ovr, csv: csvLabel, csvOvr: row.ovr, method })
      }

      const naturalSector = ROLE_TO_SECTOR[row.role]
      if (!naturalSector) throw new Error(`Role desconhecido "${row.role}" (${p.name})`)
      const altSectors = row.altRoles.map((r) => ROLE_TO_SECTOR[r]).filter(Boolean)

      // Ponteiros LM/RM com alternativa de ataque são atacantes na percepção do
      // jogador (Salah, Yamal): setor principal FWD, MID vai para altPositions.
      // Exceção: quem também tem alternativa de DEF é lateral ofensivo
      // (Grimaldo LM [LB, LW], Preciado RM [RB, RW]) — fica no setor natural.
      let sector = naturalSector
      if ((row.role === 'LM' || row.role === 'RM') && altSectors.includes('FWD') && !altSectors.includes('DEF')) {
        sector = 'FWD'
        stats.wingersPromoted.push({ team, name: p.name, role: row.role })
      }

      if (sector !== p.position) stats.sectorChanged.push({ team, name: p.name, from: p.position, to: sector, role: row.role })

      const altPositions = [...new Set([...altSectors, naturalSector])].filter((s) => s !== sector)
      if (row.altRoles.length) stats.gainedAltRoles++
      if (altPositions.length) stats.crossSectorAlt++

      const ovrFix = OVR_FIXES[`${team}|${p.name}`]
      if (ovrFix) {
        stats.dataFixes.push({ team, name: p.name, before: `ovr ${p.ovr}`, after: `ovr ${ovrFix}` })
      }

      return {
        name: p.name,
        ovr: ovrFix ?? p.ovr, // com match, OVR só muda via OVR_FIXES
        position: sector,
        altPositions,
        role: row.role,
        altRoles: row.altRoles,
        penalties: row.penalties,
        league: row.league,
        source: 'eafc26',
      }
    }

    // Sem match: mantém setor e liga atuais (ou "Outra"); OVR redistribuído depois.
    stats.unmatched.push({ team, name: p.name, ovr: p.ovr, source: p.source })
    const league = p.league && String(p.league).trim() ? p.league : 'Outra'
    if (league === 'Outra') stats.leagueOutra++
    return {
      name: p.name,
      ovr: p.ovr,
      position: p.position,
      altPositions: [],
      role: null,
      altRoles: [],
      penalties: null,
      league,
      source: 'estimated',
    }
  })

  // Redistribuição de OVR dos estimados: maioria +0..+4, 2-3 destaques +6..+8.
  const estimated = enriched.filter((p) => p.source === 'estimated' && !dataFixed.has(p))
  if (estimated.length) {
    const nHighlights = Math.min(randInt(2, 3), estimated.length)
    const shuffled = [...estimated]
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1))
      ;[shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]]
    }
    const highlights = new Set(shuffled.slice(0, nHighlights))
    estimated.forEach((p) => {
      const delta = highlights.has(p) ? randInt(6, 8) : randInt(0, 4)
      p.ovr = Math.min(99, p.ovr + delta)
    })
  }

  newSquads[team] = enriched
  stats.ovrAfter[team] = enriched.map((p) => p.ovr)
})

// ---------------------------------------------------------------------------
// groups.json: recalcula avg_strength / weakest / weakest_strength
// (fórmula validada contra os valores atuais: média de OVR do elenco completo)
// ---------------------------------------------------------------------------

const round1 = (v) => Math.round(v * 10) / 10
const squadAvg = (team) => round1(stats.ovrAfter[team].reduce((s, v) => s + v, 0) / stats.ovrAfter[team].length)

const newGroups = {}
Object.entries(groups).forEach(([id, g]) => {
  const strengths = g.teams.map((t) => ({ t, s: squadAvg(t) }))
  const weakest = strengths.reduce((a, b) => (b.s < a.s ? b : a))
  newGroups[id] = {
    ...g,
    avg_strength: round1(strengths.reduce((s, x) => s + x.s, 0) / strengths.length),
    weakest: weakest.t,
    weakest_strength: weakest.s,
  }
})

// ---------------------------------------------------------------------------
// Relatório
// ---------------------------------------------------------------------------

const f1 = (v) => v.toFixed(1)
const dist = (ovrs) => {
  const avg = ovrs.reduce((s, v) => s + v, 0) / ovrs.length
  return { min: Math.min(...ovrs), avg, max: Math.max(...ovrs) }
}

console.log('== Matching ==\n')
console.log(`Total de jogadores:        ${stats.total}`)
console.log(`Match no CSV:              ${stats.matched}`)
Object.entries(stats.byMethod).forEach(([method, count]) => console.log(`  ${method.padEnd(8)} ${count}`))
console.log(`Sem match (estimados):     ${stats.unmatched.length}`)

console.log('\n== Matches não exatos (conferir se casaram com a pessoa certa) ==\n')
stats.nonExact.forEach((m) =>
  console.log(`  [${m.method}] ${m.name} (${m.team}, ovr ${m.ovr}) → ${m.csv} (CSV ovr ${m.csvOvr})`)
)

console.log('\n== Correções manuais de dados ==\n')
stats.dataFixes.forEach((d) => console.log(`  ${d.name} (${d.team}): ${d.before} → ${d.after}`))

console.log('\n== Jogadores sem match (conferir grafia) ==\n')
let lastTeam = null
stats.unmatched.forEach((u) => {
  if (u.team !== lastTeam) {
    console.log(`${u.team}:`)
    lastTeam = u.team
  }
  console.log(`  ${u.name} (ovr ${u.ovr}, source ${u.source})`)
})

console.log('\n== Mudanças de setor (position derivado do role real) ==\n')
console.log(`Total: ${stats.sectorChanged.length}`)
stats.sectorChanged.forEach((c) => console.log(`  ${c.name} (${c.team}): ${c.from} → ${c.to} [${c.role}]`))

console.log('\n== Ponteiros LM/RM promovidos a FWD ==\n')
console.log(`Total: ${stats.wingersPromoted.length}`)
stats.wingersPromoted.forEach((w) => console.log(`  ${w.name} (${w.team}) [${w.role}]`))

console.log('\n== Roles alternativos ==\n')
console.log(`Jogadores com altRoles:                      ${stats.gainedAltRoles}`)
console.log(`Jogadores com altPositions de outro setor:   ${stats.crossSectorAlt}`)

console.log('\n== Ligas ==\n')
const semLiga = Object.values(newSquads).flat().filter((p) => !p.league || !String(p.league).trim())
console.log(`Jogadores sem liga: ${semLiga.length}${semLiga.length === 0 ? ' ✓ (todos têm liga válida)' : ' ✗'}`)
console.log(`Jogadores com liga "Outra": ${stats.leagueOutra}`)

console.log('\n== OVR antes/depois — 10 seleções mais fracas ==\n')
const weakestTeams = Object.keys(squads)
  .map((t) => ({ t, avg: stats.ovrBefore[t].reduce((s, v) => s + v, 0) / stats.ovrBefore[t].length }))
  .sort((a, b) => a.avg - b.avg)
  .slice(0, 10)
console.log('Seleção'.padEnd(18) + 'antes (mín/méd/máx)'.padStart(22) + 'depois (mín/méd/máx)'.padStart(24))
weakestTeams.forEach(({ t }) => {
  const b = dist(stats.ovrBefore[t])
  const a = dist(stats.ovrAfter[t])
  console.log(
    t.padEnd(18) +
      `${b.min} / ${f1(b.avg)} / ${b.max}`.padStart(22) +
      `${a.min} / ${f1(a.avg)} / ${a.max}`.padStart(24)
  )
})

console.log('\n== groups.json recalculado ==\n')
Object.entries(groups).forEach(([id, g]) => {
  const n = newGroups[id]
  const weakestChanged = g.weakest !== n.weakest ? `  (weakest: ${g.weakest} → ${n.weakest})` : ''
  console.log(`${id}: avg ${g.avg_strength} → ${n.avg_strength}${weakestChanged}`)
})

// ---------------------------------------------------------------------------
// Aplicação
// ---------------------------------------------------------------------------

if (APPLY) {
  copyFileSync(squadsUrl, backupUrl)
  writeFileSync(squadsUrl, JSON.stringify(newSquads, null, 2) + '\n', 'utf8')
  writeFileSync(groupsUrl, JSON.stringify(newGroups, null, 2) + '\n', 'utf8')
  console.log('\n✔ Aplicado: squads_final.json e groups.json atualizados (backup em squads_final.backup.json)')
} else {
  console.log('\n(Relatório apenas — nada foi escrito. Use --apply para aplicar.)')
}
