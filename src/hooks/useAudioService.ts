import { useState, useEffect, useRef, useCallback } from 'react'
import type { AudioState, InstrumentType, AudioMode, AudioServiceControls } from '@/lib/types/audio'

// Extend window interface for legacy JS system
declare global {
  interface Window {
    app?: any
    container?: any
    Tone?: any
  }
}

/**
 * useAudioService Hook - Complete Audio Integration
 *
 * Integrates the existing vanilla JS audio system with React
 * Strategy: Load JS modules dynamically and provide React interface
 */
export function useAudioService(): AudioState & AudioServiceControls {
  const scriptLoadedRef = useRef(false)
  const updateIntervalRef = useRef<number | null>(null)

  const [audioState, setAudioState] = useState<AudioState>({
    isReady: false,
    isPlaying: false,
    currentInstrument: 'saxophone',
    currentMode: 'continuous',
    pitchData: null,
    latency: 0,
    status: 'Loading audio system...'
  })

  // Initialize audio system
  useEffect(() => {
    if (scriptLoadedRef.current) return
    scriptLoadedRef.current = true

    const init = async () => {
      try {
        setAudioState(prev => ({ ...prev, status: 'Loading audio libraries...' }))

        // Load Tone.js and Pitchfinder
        await loadScript('/js/lib/tone.js')
        await loadScript('/js/lib/pitchfinder-browser.js')

        // Wait for libraries to initialize
        await new Promise(resolve => setTimeout(resolve, 200))

        setAudioState(prev => ({ ...prev, status: 'Initializing audio system...' }))

        // Import main.js module (contains container setup)
        // @ts-ignore - Dynamic import of legacy JS module
        await import('/js/main.js')

        console.log('[Audio] main.js loaded')

        // Check if window.container and window.app exist
        // main.js creates these, but only after DOMContentLoaded
        // In React, we need to manually trigger initialization

        if (window.container && !window.app) {
          console.log('[Audio] Container exists, creating app manually...')
          const app = window.container.get('app')
          window.app = app
          await app.initialize()
        }

        // Wait for app to be ready
        let retries = 0
        while (!window.app && retries < 30) {
          await new Promise(resolve => setTimeout(resolve, 100))
          retries++
        }

        if (window.app) {
          setAudioState(prev => ({ ...prev, isReady: true, status: 'Ready - Click Start to begin' }))
          console.log('[Audio] System ready ✓')
        } else {
          throw new Error('Audio system failed to initialize (window.app not found)')
        }
      } catch (error) {
        console.error('[Audio] Load failed:', error)
        setAudioState(prev => ({ ...prev, status: 'Error: ' + (error as Error).message }))
      }
    }

    init()

    return () => {
      if (updateIntervalRef.current) clearInterval(updateIntervalRef.current)
      window.app?.stop?.()
    }
  }, [])

  // Start audio
  const start = useCallback(async () => {
    try {
      setAudioState(prev => ({ ...prev, status: 'Starting audio...' }))

      // Resume Tone.js AudioContext (required after user gesture)
      if (window.Tone?.context?.state === 'suspended') {
        await window.Tone.start()
        console.log('[Audio] Tone.js AudioContext resumed')
      }

      // Start the app
      await window.app?.start()

      setAudioState(prev => ({ ...prev, isPlaying: true, status: `Playing (${prev.currentInstrument})` }))
      startRealTimeUpdates()
      console.log('[Audio] Started successfully')
    } catch (error) {
      console.error('[Audio] Start failed:', error)
      setAudioState(prev => ({ ...prev, status: 'Error: ' + (error as Error).message }))
    }
  }, [])

  // Stop audio
  const stop = useCallback(() => {
    window.app?.stop()
    if (updateIntervalRef.current) clearInterval(updateIntervalRef.current)
    setAudioState(prev => ({ ...prev, isPlaying: false, pitchData: null, status: 'Ready' }))
  }, [])

  // Change instrument
  const changeInstrument = useCallback((instrument: InstrumentType) => {
    window.app?.changeInstrument?.(instrument)
    setAudioState(prev => ({
      ...prev,
      currentInstrument: instrument,
      status: prev.isPlaying ? `Playing (${instrument})` : 'Ready'
    }))
  }, [])

  // Change mode
  const changeMode = useCallback((mode: AudioMode) => {
    if (window.app) {
      window.app.useContinuousMode = (mode === 'continuous')
    }
    setAudioState(prev => ({ ...prev, currentMode: mode }))
  }, [])

  // Real-time updates
  const startRealTimeUpdates = () => {
    updateIntervalRef.current = window.setInterval(() => {
      const note = document.getElementById('currentNote')?.textContent?.trim() || '--'
      const freqText = document.getElementById('currentFreq')?.textContent?.trim() || '0'
      const frequency = parseFloat(freqText) || 0

      if (note !== '--' && frequency > 0) {
        setAudioState(prev => ({
          ...prev,
          pitchData: { note, frequency, confidence: 95 }
        }))
      }
    }, 100)
  }

  return { ...audioState, start, stop, changeInstrument, changeMode }
}

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) {
      resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.onload = () => resolve()
    script.onerror = () => reject(new Error(`Failed to load: ${src}`))
    document.head.appendChild(script)
  })
}
