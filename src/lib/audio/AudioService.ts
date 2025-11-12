/**
 * AudioService - Minimal Working TypeScript Wrapper
 *
 * Strategy: Wrap the existing JS audio system with a clean TypeScript API
 * This is a bridge solution until full TS migration is complete
 *
 * Design Principles:
 * 1. Single responsibility: Manage audio system lifecycle
 * 2. Observable state: Allow React hooks to subscribe to changes
 * 3. Type-safe: Provide TypeScript interfaces for all interactions
 * 4. Testable: Isolate browser dependencies
 */

import type { AudioState, InstrumentType, AudioMode } from '@/lib/types/audio'

export type AudioStateChangeListener = (state: AudioState) => void

export class AudioService {
  private state: AudioState
  private listeners: Set<AudioStateChangeListener> = new Set()
  private initPromise: Promise<void> | null = null

  constructor() {
    this.state = {
      isReady: false,
      isPlaying: false,
      currentInstrument: 'saxophone',
      currentMode: 'continuous',
      pitchData: null,
      latency: 0,
      status: 'initializing'
    }
  }

  /**
   * Get current state (immutable copy)
   */
  getState(): Readonly<AudioState> {
    return { ...this.state }
  }

  /**
   * Subscribe to state changes
   * Returns unsubscribe function
   */
  subscribe(listener: AudioStateChangeListener): () => void {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  /**
   * Update state and notify listeners
   */
  private setState(partial: Partial<AudioState>): void {
    this.state = { ...this.state, ...partial }
    this.listeners.forEach(listener => listener(this.state))
  }

  /**
   * Initialize audio system
   * Idempotent: safe to call multiple times
   */
  async initialize(): Promise<void> {
    // Prevent multiple simultaneous initializations
    if (this.initPromise) {
      return this.initPromise
    }

    if (this.state.isReady) {
      return Promise.resolve()
    }

    this.initPromise = this._doInitialize()
    return this.initPromise
  }

  private async _doInitialize(): Promise<void> {
    try {
      this.setState({ status: 'Loading audio libraries...' })

      // Load Tone.js
      await this.loadScript('/js/lib/tone.js')

      // Load Pitchfinder
      await this.loadScript('/js/lib/pitchfinder-browser.js')

      // Wait for libraries to be available
      await this.waitForGlobal('Tone', 3000)
      await this.waitForGlobal('Pitchfinder', 3000)

      this.setState({ status: 'Initializing audio system...' })

      // Dynamically import main.js (sets up window.container)
      // @ts-ignore - Dynamic import of legacy JS module
      await import('/js/main.js')

      // Wait for container to be created
      await this.waitForGlobal('container', 2000)

      // Manually create app if needed (DOMContentLoaded may not fire in React)
      if (window.container && !window.app) {
        console.log('[AudioService] Creating app manually...')
        const app = window.container.get('app')
        window.app = app
        await app.initialize()
      }

      // Wait for app to be ready
      await this.waitForGlobal('app', 3000)

      this.setState({
        isReady: true,
        status: 'Ready - Click Start to begin'
      })

      console.log('[AudioService] ✓ Initialization complete')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.setState({
        isReady: false,
        status: `Error: ${message}`
      })
      throw error
    } finally {
      this.initPromise = null
    }
  }

  /**
   * Start audio capture and playback
   */
  async start(): Promise<void> {
    if (!this.state.isReady) {
      throw new Error('Audio system not initialized. Call initialize() first.')
    }

    if (this.state.isPlaying) {
      console.warn('[AudioService] Already playing, ignoring start()')
      return
    }

    try {
      this.setState({ status: 'Starting audio...' })

      // Resume Tone.js AudioContext (required after user gesture)
      if (window.Tone?.context?.state === 'suspended') {
        await window.Tone.start()
        console.log('[AudioService] AudioContext resumed')
      }

      // Start the legacy app
      await window.app.start()

      this.setState({
        isPlaying: true,
        status: `Playing (${this.state.currentInstrument})`
      })

      console.log('[AudioService] ✓ Started')
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      this.setState({ status: `Start failed: ${message}` })
      throw error
    }
  }

  /**
   * Stop audio capture and playback
   */
  stop(): void {
    if (!this.state.isPlaying) {
      return
    }

    try {
      window.app?.stop()

      this.setState({
        isPlaying: false,
        pitchData: null,
        status: 'Ready'
      })

      console.log('[AudioService] ✓ Stopped')
    } catch (error) {
      console.error('[AudioService] Stop error:', error)
    }
  }

  /**
   * Change active instrument
   */
  changeInstrument(instrument: InstrumentType): void {
    window.app?.changeInstrument?.(instrument)

    this.setState({
      currentInstrument: instrument,
      status: this.state.isPlaying
        ? `Playing (${instrument})`
        : 'Ready'
    })

    console.log('[AudioService] Instrument changed:', instrument)
  }

  /**
   * Change playback mode
   */
  changeMode(mode: AudioMode): void {
    if (window.app) {
      window.app.useContinuousMode = (mode === 'continuous')
    }

    this.setState({ currentMode: mode })
    console.log('[AudioService] Mode changed:', mode)
  }

  /**
   * Update pitch data (called by external polling or callback)
   */
  updatePitchData(data: { note: string; frequency: number; confidence: number }): void {
    this.setState({ pitchData: data })
  }

  /**
   * Update latency (called by external monitoring)
   */
  updateLatency(latency: number): void {
    this.setState({ latency })
  }

  /**
   * Cleanup resources
   */
  destroy(): void {
    this.stop()
    this.listeners.clear()
    console.log('[AudioService] Destroyed')
  }

  // ========== Helper Methods ==========

  private loadScript(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      // Check if already loaded
      if (document.querySelector(`script[src="${src}"]`)) {
        resolve()
        return
      }

      const script = document.createElement('script')
      script.src = src
      script.onload = () => resolve()
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`))
      document.head.appendChild(script)
    })
  }

  private waitForGlobal(name: string, timeout: number = 5000): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now()

      const check = () => {
        if ((window as any)[name]) {
          resolve()
        } else if (Date.now() - startTime > timeout) {
          reject(new Error(`Timeout waiting for global: ${name}`))
        } else {
          setTimeout(check, 100)
        }
      }

      check()
    })
  }
}

// Extend window interface for legacy system
declare global {
  interface Window {
    app?: any
    container?: any
    Tone?: any
    Pitchfinder?: any
    pitchfinder?: any
  }
}

// Export singleton instance (optional, for convenience)
let instance: AudioService | null = null

export function getAudioService(): AudioService {
  if (!instance) {
    instance = new AudioService()
  }
  return instance
}
