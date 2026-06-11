// Layouts de formação no campinho (viewBox 0 0 105 68), defesa à esquerda,
// ataque à direita. Compartilhados entre DraftScreen, MatchPlay e ResultScreen.

export const POSITION_ORDER = ['GK', 'DEF', 'MID', 'FWD']

export const ROLE_TO_POSITION = {
  GK: 'GK',
  LB: 'DEF', RB: 'DEF', CB: 'DEF', LWB: 'DEF', RWB: 'DEF',
  CM: 'MID', LM: 'MID', RM: 'MID', CDM: 'MID', LAM: 'MID', CAM: 'MID', RAM: 'MID',
  ST: 'FWD', LW: 'FWD', RW: 'FWD',
}

export const POSITION_COLOR = {
  GK: 'var(--color-pos-gk)',
  DEF: 'var(--color-pos-def)',
  MID: 'var(--color-pos-mid)',
  FWD: 'var(--color-pos-fwd)',
}

export const FORMATION_LAYOUTS = {
  '4-3-3': [
    { role: 'GK', x: 6, y: 34 },
    { role: 'LB', x: 22, y: 8 },
    { role: 'CB', x: 22, y: 26 },
    { role: 'CB', x: 22, y: 42 },
    { role: 'RB', x: 22, y: 60 },
    { role: 'CM', x: 50, y: 14 },
    { role: 'CM', x: 50, y: 34 },
    { role: 'CM', x: 50, y: 54 },
    { role: 'LW', x: 86, y: 8 },
    { role: 'ST', x: 86, y: 34 },
    { role: 'RW', x: 86, y: 60 },
  ],
  '4-4-2': [
    { role: 'GK', x: 6, y: 34 },
    { role: 'LB', x: 22, y: 8 },
    { role: 'CB', x: 22, y: 26 },
    { role: 'CB', x: 22, y: 42 },
    { role: 'RB', x: 22, y: 60 },
    { role: 'LM', x: 52, y: 8 },
    { role: 'CM', x: 52, y: 26 },
    { role: 'CM', x: 52, y: 42 },
    { role: 'RM', x: 52, y: 60 },
    { role: 'ST', x: 88, y: 24 },
    { role: 'ST', x: 88, y: 44 },
  ],
  '3-5-2': [
    { role: 'GK', x: 6, y: 34 },
    { role: 'CB', x: 22, y: 18 },
    { role: 'CB', x: 22, y: 34 },
    { role: 'CB', x: 22, y: 50 },
    { role: 'LM', x: 52, y: 6 },
    { role: 'CM', x: 52, y: 22 },
    { role: 'CM', x: 52, y: 34 },
    { role: 'CM', x: 52, y: 46 },
    { role: 'RM', x: 52, y: 62 },
    { role: 'ST', x: 88, y: 24 },
    { role: 'ST', x: 88, y: 44 },
  ],
  '4-2-3-1': [
    { role: 'GK', x: 6, y: 34 },
    { role: 'LB', x: 22, y: 8 },
    { role: 'CB', x: 22, y: 26 },
    { role: 'CB', x: 22, y: 42 },
    { role: 'RB', x: 22, y: 60 },
    { role: 'CDM', x: 42, y: 24 },
    { role: 'CDM', x: 42, y: 44 },
    { role: 'LAM', x: 66, y: 10 },
    { role: 'CAM', x: 66, y: 34 },
    { role: 'RAM', x: 66, y: 58 },
    { role: 'ST', x: 92, y: 34 },
  ],
  '5-3-2': [
    { role: 'GK', x: 6, y: 34 },
    { role: 'LWB', x: 24, y: 4 },
    { role: 'CB', x: 24, y: 20 },
    { role: 'CB', x: 24, y: 34 },
    { role: 'CB', x: 24, y: 48 },
    { role: 'RWB', x: 24, y: 64 },
    { role: 'CM', x: 52, y: 14 },
    { role: 'CM', x: 52, y: 34 },
    { role: 'CM', x: 52, y: 54 },
    { role: 'ST', x: 88, y: 24 },
    { role: 'ST', x: 88, y: 44 },
  ],
}
