// Correção única do squads_final.json:
// 1. league null com clube conhecido → liga do clube
// 2. aliases de liga (nomes de patrocinador) → nome canônico
// 3. copas (Libertadores/Sudamericana) no campo league → liga doméstica do clube
// 4. league e club nulos em seleções de base doméstica → liga nacional
const fs = require('fs')
const path = require('path')

const FILE = path.join(__dirname, '..', 'src', 'data', 'squads_final.json')

const CLUB_LEAGUE = {
  PSV: 'Eredivisie', Ajax: 'Eredivisie', Feyenoord: 'Eredivisie', 'Heracles Almelo': 'Eredivisie',
  'Real Madrid': 'La Liga', 'Real Sociedad': 'La Liga', 'Valencia CF': 'La Liga', 'Real Betis': 'La Liga',
  'Atlético de Madrid': 'La Liga', 'Girona FC': 'La Liga',
  'Real Zaragoza': 'La Liga 2',
  'Manchester City': 'Premier League', Wolves: 'Premier League', 'Crystal Palace': 'Premier League',
  Bournemouth: 'Premier League', 'Man Utd': 'Premier League', 'West Ham': 'Premier League',
  Everton: 'Premier League', Spurs: 'Premier League',
  'Leicester City': 'Championship', 'Derby County': 'Championship', Norwich: 'Championship',
  'Hull City': 'Championship', 'Sheffield Wed': 'Championship',
  'Rotherham Utd': 'EFL League One',
  'Fenerbahçe': 'Süper Lig', Galatasaray: 'Süper Lig', Trabzonspor: 'Süper Lig', 'Eyüpspor': 'Süper Lig',
  Sassuolo: 'Serie A', Fiorentina: 'Serie A', Torino: 'Serie A', 'AS Roma': 'Serie A', Udinese: 'Serie A',
  'Bergamo Calcio': 'Serie A', 'Lombardia FC': 'Serie A', 'Milano FC': 'Serie A',
  'OGC Nice': 'Ligue 1', Nice: 'Ligue 1', 'RC Lens': 'Ligue 1', Strasbourg: 'Ligue 1', 'Paris SG': 'Ligue 1',
  'AS Monaco': 'Ligue 1', 'LOSC Lille': 'Ligue 1', 'Olympique Marseille': 'Ligue 1',
  Montpellier: 'Ligue 2', 'AS Nancy Lorraine': 'Ligue 2',
  'VfB Stuttgart': 'Bundesliga', Frankfurt: 'Bundesliga', 'FC Bayern München': 'Bundesliga',
  'FC Augsburg': 'Bundesliga', "M'gladbach": 'Bundesliga', 'Borussia Dortmund': 'Bundesliga',
  '1. FSV Mainz 05': 'Bundesliga', 'VfL Wolfsburg': 'Bundesliga', 'TSG Hoffenheim': 'Bundesliga',
  'SC Freiburg': 'Bundesliga', 'Hamburger SV': 'Bundesliga',
  'FC Schalke 04': 'Bundesliga 2', 'Karlsruher SC': 'Bundesliga 2',
  'SL Benfica': 'Liga Portugal', 'SC Braga': 'Liga Portugal',
  'Viktoria Plzeň': 'Česká Liga',
  'BSC Young Boys': 'Swiss Super League',
  'Brøndby IF': 'Danish Superliga', 'Randers FC': 'Danish Superliga', 'FC Midtjylland': 'Danish Superliga',
  'USM Alger': 'Ligue 1 Algérie', 'JS Kabylie': 'Ligue 1 Algérie',
  'Al Qadsiah': 'Saudi Pro League', 'Al Hilal': 'Saudi Pro League', 'Al Ahli': 'Saudi Pro League',
  Ulsan: 'K League 1',
  'Toronto FC': 'MLS', 'FC Dallas': 'MLS', 'Sounders FC': 'MLS', 'Orlando City': 'MLS',
  'FC Univ. Cluj': 'SuperLiga Romena',
  'RB Salzburg': 'Austrian Bundesliga', LASK: 'Austrian Bundesliga',
  'Club Brugge': 'Belgian Pro League',
  'Espérance Tunis': 'Ligue 1 Tunisie',
  Gyor: 'Magyar Liga',
  Talleres: 'Liga Profesional', "Newell's": 'Liga Profesional', 'Ind. Rivadavia': 'Liga Profesional',
  'Al-Duhail': 'Qatar Stars League',
  'PAOK FC': 'Super League Greece',
}

const LEAGUE_ALIASES = {
  "Ligue 1 McDonald's": 'Ligue 1',
  'LALIGA EA SPORTS': 'La Liga',
  'LALIGA HYPERMOTION': 'La Liga 2',
  'Serie A Enilive': 'Serie A',
  'Serie BKT': 'Serie B',
  'Trendyol Süper Lig': 'Süper Lig',
  'EFL Championship': 'Championship',
  'ROSHN Saudi League': 'Saudi Pro League',
  'Scottish Prem': 'Scottish Premiership',
  'Ö. Bundesliga': 'Austrian Bundesliga',
  'Brack Super League': 'Swiss Super League',
  '3F Superliga': 'Danish Superliga',
  '1A Pro League': 'Belgian Pro League',
  'Liga Hrvatska': 'HNL',
  'Ligue 2 BKT': 'Ligue 2',
  'Hellas Liga': 'Super League Greece',
  LPF: 'Liga Profesional',
}

// Copas no campo league → liga doméstica do clube
const CUP_CLUB_LEAGUE = {
  'Guaraní': 'Liga Paraguaya', Olimpia: 'Liga Paraguaya', 'Cerro Porteño': 'Liga Paraguaya',
  'LDU Quito': 'LigaPro', IDV: 'LigaPro', 'U. Católica': 'LigaPro',
  'Alianza Lima': 'Liga 1 Peru',
  'Atl. Nacional': 'Liga BetPlay',
  Nacional: 'Primera División Uruguaya',
}

// Seleções cujos jogadores sem clube/liga são de base doméstica
const DOMESTIC_LEAGUE = {
  'Catar': 'Qatar Stars League',
  'Jordânia': 'Jordanian Pro League',
  'Irã': 'Persian Gulf Pro League',
  'Uzbequistão': 'Uzbekistan Super League',
  'Iraque': 'Iraq Stars League',
  'Egito': 'Egyptian Premier League',
  'África do Sul': 'Premier Soccer League',
  'Arábia Saudita': 'Saudi Pro League',
}

const data = JSON.parse(fs.readFileSync(FILE, 'utf8'))
const stats = { clubFill: 0, alias: 0, cup: 0, domestic: 0, stillNull: 0 }

Object.entries(data).forEach(([team, players]) => {
  players.forEach((p) => {
    if (p.league && LEAGUE_ALIASES[p.league]) {
      p.league = LEAGUE_ALIASES[p.league]
      stats.alias++
    }
    if ((p.league === 'Libertadores' || p.league === 'Sudamericana') && CUP_CLUB_LEAGUE[p.club]) {
      p.league = CUP_CLUB_LEAGUE[p.club]
      stats.cup++
    }
    if (!p.league && p.club && CLUB_LEAGUE[p.club]) {
      p.league = CLUB_LEAGUE[p.club]
      stats.clubFill++
    }
    if (!p.league && !p.club && DOMESTIC_LEAGUE[team]) {
      p.league = DOMESTIC_LEAGUE[team]
      stats.domestic++
    }
    if (!p.league) stats.stillNull++
  })
})

fs.writeFileSync(FILE, JSON.stringify(data, null, 2) + '\n', 'utf8')
console.log('Corrigidos por clube:', stats.clubFill)
console.log('Aliases normalizados:', stats.alias)
console.log('Copas -> liga domestica:', stats.cup)
console.log('Preenchidos por selecao domestica:', stats.domestic)
console.log('Ainda null:', stats.stillNull)
