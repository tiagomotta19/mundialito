// Ferramenta de desenvolvimento — NÃO faz parte do app.
// Sanidade do motor: simula copas SÓ com as 48 seleções da IA e reporta quem
// vence. O "time do usuário" passado ao simulateFullTournament é a própria
// seleção mais fraca do grupo A reconstruída com buildNationalTeam (isUser
// false → sem coesão e sem underdog), então a copa é 100% IA.
//
// Uso: node scripts/ai-cup.js [n]   (n = copas, padrão 1000)
import { registerHooks } from 'node:module'

registerHooks({
  resolve(specifier, context, nextResolve) {
    let result
    try {
      result = nextResolve(specifier, context)
    } catch (err) {
      if (err.code === 'ERR_MODULE_NOT_FOUND' && specifier.startsWith('.')) {
        result = nextResolve(`${specifier}.js`, context)
      } else {
        throw err
      }
    }
    if (result.url?.endsWith('.json')) {
      return { ...result, importAttributes: { type: 'json' } }
    }
    return result
  },
})

const { simulateFullTournament, buildNationalTeam, getGroup, PEDIGREE } = await import(
  '../src/engine/simulator.js'
)

const RUNS = Number(process.argv[2]) || 1000

const TIERS = [
  { mult: 1.03, label: 'Lendas (1.03)' },
  { mult: 1.02, label: 'Campeãs e finalistas (1.02)' },
  { mult: 1.01, label: 'Tradição sólida (1.01)' },
  { mult: 1.0, label: 'Regulares (1.00)' },
  { mult: 0.98, label: 'Pouca/nenhuma história (0.98)' },
]

const champions = {}
const finalists = {}

const start = Date.now()
for (let i = 0; i < RUNS; i++) {
  // Grupo A com a seleção mais fraca de volta no lugar do "usuário"
  const userTeam = buildNationalTeam(getGroup('A').weakest)
  const tournament = simulateFullTournament(userTeam, 'A')

  champions[tournament.champion.name] = (champions[tournament.champion.name] || 0) + 1
  const final = tournament.knockout.results.final
  ;[final.home.name, final.away.name].forEach((name) => {
    finalists[name] = (finalists[name] || 0) + 1
  })
}

console.log(`\nMundialito — copa só com a IA (${RUNS} copas, ${((Date.now() - start) / 1000).toFixed(1)}s)\n`)

const pct = (n) => ((100 * n) / RUNS).toFixed(1).padStart(5)

console.log('== Campeões ==\n')
Object.entries(champions)
  .sort(([, a], [, b]) => b - a)
  .forEach(([name, count]) => {
    console.log(`  ${name.padEnd(18)} ${String(count).padStart(4)} títulos  ${pct(count)}%  [pedigree ${PEDIGREE[name] ?? 1.0}]`)
  })

console.log('\n== Finalistas (presenças na final) ==\n')
Object.entries(finalists)
  .sort(([, a], [, b]) => b - a)
  .slice(0, 16)
  .forEach(([name, count]) => {
    console.log(`  ${name.padEnd(18)} ${String(count).padStart(4)} finais   ${pct(count)}%`)
  })

console.log('\n== Títulos por faixa de pedigree ==\n')
TIERS.forEach(({ mult, label }) => {
  const teams = Object.entries(PEDIGREE).filter(([, m]) => m === mult)
  const titles = teams.reduce((sum, [name]) => sum + (champions[name] || 0), 0)
  console.log(
    `  ${label.padEnd(32)} ${String(titles).padStart(4)} títulos  ${pct(titles)}%  (${teams.length} seleções)`
  )
})
console.log('')
