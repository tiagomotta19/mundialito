// Compatibilidade jogador ↔ slot da formação por papel real (EA FC).
//
// SLOT_COMPAT: para cada papel de slot, os papéis de jogador aceitos.
// Um jogador é compatível se QUALQUER papel dele (role + altRoles) está na
// lista do slot. Ajuste fino esperado: edite as listas abaixo à vontade —
// nada além deste mapa precisa mudar.
//
// Jogadores estimados (source "estimated", sem role) seguem a regra antiga:
// compatíveis com qualquer slot do seu setor (position).

export const SLOT_COMPAT = {
  GK: ['GK'],
  CB: ['CB'],
  LB: ['LB', 'LWB'],
  RB: ['RB', 'RWB'],
  LWB: ['LWB', 'LB', 'LM'],
  RWB: ['RWB', 'RB', 'RM'],
  CM: ['CM', 'CDM', 'CAM'],
  CDM: ['CDM', 'CM'],
  CAM: ['CAM', 'CM'],
  LM: ['LM', 'LW'],
  RM: ['RM', 'RW'],
  LW: ['LW', 'LM'],
  RW: ['RW', 'RM'],
  ST: ['ST', 'CF'],
  // Slots de meia ofensiva aberta do 4-2-3-1 (LAM/RAM não existem como papel
  // de jogador no EA FC — aceitam armadores e pontas do lado correspondente)
  LAM: ['CAM', 'LM', 'LW'],
  RAM: ['CAM', 'RM', 'RW'],
}

/** Setor (GK/DEF/MID/FWD) de cada papel de slot das formações. */
export const ROLE_TO_POSITION = {
  GK: 'GK',
  LB: 'DEF', RB: 'DEF', CB: 'DEF', LWB: 'DEF', RWB: 'DEF',
  CM: 'MID', LM: 'MID', RM: 'MID', CDM: 'MID', LAM: 'MID', CAM: 'MID', RAM: 'MID',
  ST: 'FWD', LW: 'FWD', RW: 'FWD',
}

/** Papéis do jogador (principal + alternativos); vazio para estimados sem role. */
export function playerRoles(player) {
  if (!player.role) return []
  return [player.role, ...(player.altRoles || [])]
}

export function isCompatible(player, slotRole) {
  const roles = playerRoles(player)
  // Estimado sem role: regra antiga, por setor
  if (!roles.length) return ROLE_TO_POSITION[slotRole] === player.position
  const accepted = SLOT_COMPAT[slotRole] || []
  return roles.some((r) => accepted.includes(r))
}
