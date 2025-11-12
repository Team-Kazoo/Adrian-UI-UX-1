import { useState, useEffect, useRef } from 'react'
import type { AudioState, InstrumentType, AudioMode, AudioServiceControls } from '@/lib/types/audio'
import { AudioService, getAudioService } from '@/lib/audio/AudioService'

/**
 * useAudioService Hook - Clean React Integration
 *
 * Uses the new AudioService class which wraps the legacy JS system
 * This provides a clean, testable interface without tight coupling
 */
export function useAudioService(): AudioState & AudioServiceControls {
  const serviceRef = useRef<AudioService | null>(null)
  const updateIntervalRef = useRef<number | null>(null)
  const [audioState, setAudioState] = useState<AudioState>({
    isReady: false,
    isPlaying: false,
    currentInstrument: 'saxophone',
    currentMode: 'continuous',
    pitchData: null,
    latency: 0,
    status: 'initializing'
  })

  // Initialize audio service
  useEffect(() => {
    // Get singleton instance
    const service = getAudioService()
    serviceRef.current = service

    // Subscribe to state changes
    const unsubscribe = service.subscribe((state) => {
      setAudioState(state)
    })

    // Initialize the audio system
    service.initialize().catch((error) => {
      console.error('[useAudioService] Initialization failed:', error)
    })

    // Cleanup on unmount
    return () => {
      unsubscribe()
      if (updateIntervalRef.current) {
        clearInterval(updateIntervalRef.current)
      }
      // Note: We don't destroy the service here because it's a singleton
      // and other components might be using it
    }
  }, [])

  // Start audio
  const start = async () => {
    if (!serviceRef.current) {
      console.error('[useAudioService] Service not initialized')
      return
    }

    try {
      await serviceRef.current.start()

      // Start polling for pitch data from DOM (legacy integration)
      startRealTimeUpdates()
    } catch (error) {
      console.error('[useAudioService] Start failed:', error)
    }
  }

  // Stop audio
  const stop = () => {
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current)
      updateIntervalRef.current = null
    }

    serviceRef.current?.stop()
  }

  // Change instrument
  const changeInstrument = (instrument: InstrumentType) => {
    serviceRef.current?.changeInstrument(instrument)
  }

  // Change mode
  const changeMode = (mode: AudioMode) => {
    serviceRef.current?.changeMode(mode)
  }

  // Real-time updates (polls DOM elements updated by legacy system)
  const startRealTimeUpdates = () => {
    if (updateIntervalRef.current) {
      clearInterval(updateIntervalRef.current)
    }

    updateIntervalRef.current = window.setInterval(() => {
      const service = serviceRef.current
      if (!service) return

      // Poll pitch data from DOM
      const noteEl = document.getElementById('currentNote')
      const freqEl = document.getElementById('currentFreq')
      const latencyEl = document.getElementById('latency')

      const note = noteEl?.textContent?.trim() || '--'
      const freqText = freqEl?.textContent?.trim() || '0'
      const frequency = parseFloat(freqText) || 0

      if (note !== '--' && frequency > 0) {
        service.updatePitchData({
          note,
          frequency,
          confidence: 95 // TODO: Get real confidence value
        })
      }

      // Update latency
      if (latencyEl) {
        const latencyText = latencyEl.textContent?.trim() || '0'
        const latency = parseInt(latencyText) || 0
        service.updateLatency(latency)
      }
    }, 100) // Poll every 100ms
  }

  return {
    ...audioState,
    start,
    stop,
    changeInstrument,
    changeMode
  }
}
