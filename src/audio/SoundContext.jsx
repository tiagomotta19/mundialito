import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { useTheme } from '../components/ThemeContext'
import { playSound, unlockAudio } from './sfx'

const SoundContext = createContext(null)

const STORAGE_KEY = 'mundialito_sound'

// Provider de efeitos sonoros. Lê o tema atual (via ThemeContext) para escolher
// o timbre certo, então as telas só chamam play('goal') sem saber de síntese.
// Estado ligado/desligado persistido no localStorage; ligado por padrão.
export function SoundProvider({ children }) {
  const { theme } = useTheme()
  const [enabled, setEnabled] = useState(() => localStorage.getItem(STORAGE_KEY) !== 'off')

  // Refs para o play() ser estável e sempre ler tema/estado atuais sem
  // recriar callbacks nem disparar re-renders nos consumidores.
  const themeRef = useRef(theme)
  const enabledRef = useRef(enabled)
  useEffect(() => {
    themeRef.current = theme
  }, [theme])
  useEffect(() => {
    enabledRef.current = enabled
    localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off')
  }, [enabled])

  // Destrava o AudioContext no primeiro gesto do usuário (regra dos browsers)
  useEffect(() => {
    const unlock = () => unlockAudio()
    window.addEventListener('pointerdown', unlock, { once: true })
    window.addEventListener('keydown', unlock, { once: true })
    return () => {
      window.removeEventListener('pointerdown', unlock)
      window.removeEventListener('keydown', unlock)
    }
  }, [])

  // Estável (deps vazias); lê tema/estado via refs só no momento da chamada,
  // nunca durante o render.
  const play = useCallback((name, opts) => {
    if (!enabledRef.current) return
    playSound(name, themeRef.current, opts)
  }, [])

  const toggle = () =>
    setEnabled((v) => {
      const next = !v
      // Toca a confirmação ao LIGAR (driblando o gate de enabled, que ainda
      // refletiria o estado anterior neste tick).
      if (next) playSound('toggle', themeRef.current)
      return next
    })

  return (
    <SoundContext.Provider value={{ enabled, toggle, play }}>
      {children}
    </SoundContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSound() {
  return useContext(SoundContext)
}
