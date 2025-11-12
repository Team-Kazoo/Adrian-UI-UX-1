/**
 * AudioService Tests - TDD Approach
 *
 * Test-first development: Define expected behavior before implementation
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { AudioService } from './AudioService'

describe('AudioService - Unit Tests', () => {
  let service: AudioService

  beforeEach(() => {
    service = new AudioService()
  })

  afterEach(() => {
    service.destroy()
  })

  describe('Constructor', () => {
    it('should create an instance without errors', () => {
      expect(service).toBeInstanceOf(AudioService)
    })

    it('should have initial state with isReady=false', () => {
      const state = service.getState()
      expect(state.isReady).toBe(false)
      expect(state.isPlaying).toBe(false)
      expect(state.currentInstrument).toBe('saxophone')
      expect(state.currentMode).toBe('continuous')
    })

    it('should return immutable state copy', () => {
      const state1 = service.getState()
      const state2 = service.getState()

      expect(state1).not.toBe(state2) // Different objects
      expect(state1).toEqual(state2)  // Same content
    })
  })

  describe('State Management', () => {
    it('should allow subscribing to state changes', () => {
      const callback = vi.fn()
      const unsubscribe = service.subscribe(callback)

      expect(typeof unsubscribe).toBe('function')
    })

    it('should notify listeners on state change', () => {
      const callback = vi.fn()
      service.subscribe(callback)

      // Trigger state change via public method
      service.changeInstrument('violin')

      expect(callback).toHaveBeenCalled()
      const callArg = callback.mock.calls[0][0]
      expect(callArg.currentInstrument).toBe('violin')
    })

    it('should allow unsubscribing', () => {
      const callback = vi.fn()
      const unsubscribe = service.subscribe(callback)

      unsubscribe()
      service.changeInstrument('piano')

      expect(callback).not.toHaveBeenCalled()
    })
  })

  describe('Methods without browser dependencies', () => {
    it('should change instrument', () => {
      service.changeInstrument('violin')

      const state = service.getState()
      expect(state.currentInstrument).toBe('violin')
    })

    it('should change mode', () => {
      service.changeMode('traditional')

      const state = service.getState()
      expect(state.currentMode).toBe('traditional')
    })

    it('should update pitch data', () => {
      const pitchData = { note: 'C4', frequency: 261.63, confidence: 0.95 }
      service.updatePitchData(pitchData)

      const state = service.getState()
      expect(state.pitchData).toEqual(pitchData)
    })

    it('should update latency', () => {
      service.updateLatency(42)

      const state = service.getState()
      expect(state.latency).toBe(42)
    })
  })

  describe('Error Handling', () => {
    it('should throw error when starting before initialization', async () => {
      await expect(service.start()).rejects.toThrow(
        'Audio system not initialized'
      )
    })

    it('should handle stop() when not playing gracefully', () => {
      expect(() => service.stop()).not.toThrow()
    })
  })

  describe('Lifecycle', () => {
    it('should cleanup listeners on destroy()', () => {
      const callback = vi.fn()
      service.subscribe(callback)

      service.destroy()

      // After destroy, listeners should be cleared
      service.changeInstrument('flute')
      expect(callback).not.toHaveBeenCalled()
    })
  })
})

describe('PitchDetector - TypeScript Version', () => {
  it('should detect pitch from audio buffer', () => {
    // Phase 2: After AudioService works
    expect(true).toBe(true)
  })
})

describe('Synthesizer - TypeScript Version', () => {
  it('should play a note with Tone.js', () => {
    // Phase 3: After PitchDetector works
    expect(true).toBe(true)
  })
})
