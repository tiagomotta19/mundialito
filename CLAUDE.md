# Mundialito — Instruções para o Claude Code

## Sobre o projeto
Jogo mobile-first de simulação da Copa do Mundo 2026 em React + Vite + Tailwind CSS.
A especificação completa está em mundialito_spec.md na raiz do projeto.

## Comportamento esperado
- Leia sempre a spec antes de implementar qualquer tela ou funcionalidade
- Faça perguntas antes de avançar em decisões importantes de arquitetura
- Confirme antes de deletar ou sobrescrever arquivos existentes
- Nunca use Playwright ou screenshot testing — o resultado é verificado no browser
- Rode npm run build após cada conjunto de mudanças para garantir que compila

## Stack
- React + Vite
- Tailwind CSS (configurado via @tailwindcss/vite)
- Dados em src/data/ (squads_final.json, groups.json, bracket.json)
- Sem backend por enquanto — tudo client-side

## Estrutura
- src/screens/ — telas do jogo
- src/components/ — componentes reutilizáveis
- src/engine/ — motor de simulação
- src/i18n/ — traduções PT/EN/ES

## Temas
- Moderno (padrão): fundo #f7f7f5, texto #1a1a1a, fonte sistema
- Retrô: fundo #061204, texto #c8f060, fonte Courier New

## Fluxo do jogo
Tela inicial → Escolha de modo → Sorteio do grupo → Montagem do time → Copa → Resultado
