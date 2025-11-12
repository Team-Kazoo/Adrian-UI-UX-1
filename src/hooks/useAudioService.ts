import { useState, useEffect, useRef, useCallback } from 'react'
import type { AudioState, InstrumentType, AudioMode, AudioServiceControls, PitchData } from '@/lib/types/audio'

/**
 * useAudioService Hook
 *
 * Encapsulates all audio logic from the old vanilla JS architecture
 * Uses the existing JS modules without modification (Constitution compliance)
 */
export function useAudioService(): AudioState & AudioServiceControls {
  // Audio service instances (persisted across renders)
  const audioSystemRef = useRef<any>(null)
  const isInitializedRef = useRef(false)

  // React state for UI
  const [audioState, setAudioState] = useState<AudioState>({
    isReady: false,
    isPlaying: false,
    currentInstrument: 'saxophone',
    currentMode: 'continuous',
    pitchData: null,
    latency: 0,
    status: 'Initializing...'
  })

  // Initialize audio system (runs once on mount)
  useEffect(() => {
    if (isInitializedRef.current) return

    const initializeAudio = async () => {
      try {
        console.log('[useAudioService] Initializing audio system...')

        // Dynamically import the old main.js KazooApp
        // This allows us to reuse all existing audio logic without rewriting
        const { default: KazooApp } = await import('/js/main.js?v=' + Date.now())

        // Create audio system instance
        const app = new (KazooApp as any)()
        await app.initialize()

        audioSystemRef.current = app
        isInitializedRef.current = true

        setAudioState(prev => ({
          ...prev,
          isReady: true,
          status: 'Ready'
        }))

        console.log('[useAudioService] Audio system ready!')

        // Set up event listeners for real-time updates
        setupAudioListeners(app)

      } catch (error) {
        console.error('[useAudioService] Failed to initialize:', error)
        setAudioState(prev => ({
          ...prev,
          isReady: false,
          status: 'Error: ' + (error as Error).message
        }))
      }
    }

    initializeAudio()

    // Cleanup on unmount
    return () => {
      if (audioSystemRef.current) {
        audioSystemRef.current.stop?.()
        audioSystemRef.current = null
      }
    }
  }, [])

  // Set up listeners for real-time audio updates
  const setupAudioListeners = (app: any) => {
    // Listen for pitch detection updates
    if (app.audioIO) {
      const originalCallback = app.audioIO.onPitchDetected
      app.audioIO.onPitchDetected = (pitchFrame: any) => {
        // Call original callback
        if (originalCallback) {
          originalCallback.call(app.audioIO, pitchFrame)
        }

        // Update React state
        if (pitchFrame && pitchFrame.pitch > 0) {
          setAudioState(prev => ({
            ...prev,
            pitchData: {
              note: frequencyToNote(pitchFrame.pitch),
              frequency: pitchFrame.pitch,
              confidence: pitchFrame.clarity || 0
            }
          }))
        }
      }
    }
  }

  // Start audio capture and playback
  const start = useCallback(async () => {
    if (!audioSystemRef.current || !audioState.isReady) {
      console.warn('[useAudioService] Audio system not ready')
      return
    }

    try {
      console.log('[useAudioService] Starting audio...')
      await audioSystemRef.current.start()

      setAudioState(prev => ({
        ...prev,
        isPlaying: true,
        status: `Playing (${prev.currentInstrument})`
      }))
    } catch (error) {
      console.error('[useAudioService] Start failed:', error)
      setAudioState(prev => ({
        ...prev,
        status: 'Error: ' + (error as Error).message
      }))
    }
  }, [audioState.isReady])

  // Stop audio capture and playback
  const stop = useCallback(() => {
    if (!audioSystemRef.current) return

    console.log('[useAudioService] Stopping audio...')
    audioSystemRef.current.stop()

    setAudioState(prev => ({
      ...prev,
      isPlaying: false,
      pitchData: null,
      status: 'Ready'
    }))
  }, [])

  // Change instrument
  const changeInstrument = useCallback((instrument: InstrumentType) => {
    if (!audioSystemRef.current) return

    console.log('[useAudioService] Changing instrument to:', instrument)
    audioSystemRef.current.changeInstrument?.(instrument)

    setAudioState(prev => ({
      ...prev,
      currentInstrument: instrument,
      status: prev.isPlaying ? `Playing (${instrument})` : 'Ready'
    }))
  }, [])

  // Change mode (continuous vs legacy)
  const changeMode = useCallback((mode: AudioMode) => {
    if (!audioSystemRef.current) return

    console.log('[useAudioService] Changing mode to:', mode)

    const useContinuous = mode === 'continuous'
    if (audioSystemRef.current.useContinuousMode !== undefined) {
      audioSystemRef.current.useContinuousMode = useContinuous
    }

    setAudioState(prev => ({
      ...prev,
      currentMode: mode
    }))
  }, [])

  return {
    ...audioState,
    start,
    stop,
    changeInstrument,
    changeMode
  }
}

// Helper: Convert frequency to note name
function frequencyToNote(frequency: number): string {
  if (frequency <= 0) return '--'

  const A4 = 440
  const noteNames = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']

  const halfStepsFromA4 = 12 * Math.log2(frequency / A4)
  const midiNote = Math.round(69 + halfStepsFromA4)
  const octave = Math.floor(midiNote / 12) - 1
  const noteName = noteNames[midiNote % 12]

  return `${noteName}${octave}`
}
