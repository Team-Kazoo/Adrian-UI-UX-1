/**
 * App Configuration Tests
 *
 * Tests for configuration validation and management
 */

import { describe, it, expect, beforeEach } from 'vitest'
import {
  ConfigManager,
  DEFAULT_CONFIG,
  LOW_LATENCY_PRESET,
  HIGH_QUALITY_PRESET,
  POWER_SAVING_PRESET,
  validateConfig,
  type AppConfigSchema
} from '../../src/lib/audio/config/app-config'

describe('App Configuration - Validation', () => {
  describe('validateConfig', () => {
    it('should validate default config successfully', () => {
      const result = validateConfig(DEFAULT_CONFIG)
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('should reject invalid sample rate', () => {
      const invalidConfig = {
        audio: {
          sampleRate: 100000,  // Too high
          bufferSize: 2048,
          workletBufferSize: 128,
          useWorklet: true
        }
      }

      const result = validateConfig(invalidConfig)
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
      expect(result.errors[0]).toContain('sample rate')
    })

    it('should reject invalid buffer size (not power of 2)', () => {
      const invalidConfig = {
        audio: {
          sampleRate: 44100,
          bufferSize: 3000,  // Not power of 2
          workletBufferSize: 128,
          useWorklet: true
        }
      }

      const result = validateConfig(invalidConfig)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('buffer size')
    })

    it('should reject invalid clarity threshold', () => {
      const invalidConfig = {
        pitchDetector: {
          clarityThreshold: 1.5,  // > 1
          minFrequency: 50,
          maxFrequency: 1500
        }
      }

      const result = validateConfig(invalidConfig)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('clarity threshold')
    })

    it('should reject minFrequency >= maxFrequency', () => {
      const invalidConfig = {
        pitchDetector: {
          clarityThreshold: 0.5,
          minFrequency: 2000,
          maxFrequency: 1500  // Less than min
        }
      }

      const result = validateConfig(invalidConfig)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('minFrequency')
    })

    it('should reject maxFrequency >= Nyquist frequency', () => {
      const invalidConfig = {
        audio: {
          sampleRate: 44100,
          bufferSize: 2048,
          workletBufferSize: 128,
          useWorklet: true
        },
        pitchDetector: {
          clarityThreshold: 0.5,
          minFrequency: 50,
          maxFrequency: 25000  // >= 44100/2
        }
      }

      const result = validateConfig(invalidConfig)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('Nyquist')
    })

    it('should reject invalid processNoise', () => {
      const invalidConfig = {
        smoothing: {
          kalman: {
            processNoise: 0,  // Must be > 0
            measurementNoise: 0.1,
            initialEstimate: 0,
            initialError: 1
          },
          volume: { alpha: 0.3 },
          brightness: { alpha: 0.2 }
        }
      }

      const result = validateConfig(invalidConfig)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('processNoise')
    })

    it('should reject invalid EMA alpha value', () => {
      const invalidConfig = {
        smoothing: {
          kalman: {
            processNoise: 0.001,
            measurementNoise: 0.1,
            initialEstimate: 0,
            initialError: 1
          },
          volume: { alpha: 1.5 },  // > 1
          brightness: { alpha: 0.2 }
        }
      }

      const result = validateConfig(invalidConfig)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('volume.alpha')
    })

    it('should reject invalid FFT size', () => {
      const invalidConfig = {
        spectral: {
          fftSize: 3000,  // Not power of 2
          fftInterval: 2,
          minFrequency: 80,
          maxFrequency: 8000
        }
      }

      const result = validateConfig(invalidConfig)
      expect(result.valid).toBe(false)
      expect(result.errors[0]).toContain('fftSize')
    })

    it('should warn about positive silence threshold', () => {
      const config = {
        onset: {
          energyThreshold: 3,
          silenceThreshold: 10,  // Typically negative
          attackDuration: 50,
          minSilenceDuration: 100,
          timeWindow: 3,
          debug: false
        }
      }

      const result = validateConfig(config)
      expect(result.valid).toBe(true)
      expect(result.warnings.length).toBeGreaterThan(0)
      expect(result.warnings[0]).toContain('silenceThreshold')
    })
  })
})

describe('App Configuration - Presets', () => {
  it('should validate low latency preset', () => {
    const merged = { ...DEFAULT_CONFIG, ...LOW_LATENCY_PRESET }
    const result = validateConfig(merged)
    expect(result.valid).toBe(true)
  })

  it('should validate high quality preset', () => {
    const merged = { ...DEFAULT_CONFIG, ...HIGH_QUALITY_PRESET }
    const result = validateConfig(merged)
    expect(result.valid).toBe(true)
  })

  it('should validate power saving preset', () => {
    const merged = { ...DEFAULT_CONFIG, ...POWER_SAVING_PRESET }
    const result = validateConfig(merged)
    expect(result.valid).toBe(true)
  })

  it('low latency preset should have smaller buffer', () => {
    expect(LOW_LATENCY_PRESET.audio?.bufferSize).toBeLessThan(DEFAULT_CONFIG.audio.bufferSize)
  })

  it('high quality preset should have higher clarity threshold', () => {
    expect(HIGH_QUALITY_PRESET.pitchDetector?.clarityThreshold).toBeGreaterThan(
      DEFAULT_CONFIG.pitchDetector.clarityThreshold
    )
  })

  it('power saving preset should have lower sample rate', () => {
    expect(POWER_SAVING_PRESET.audio?.sampleRate).toBeLessThan(DEFAULT_CONFIG.audio.sampleRate)
  })
})

describe('App Configuration - ConfigManager', () => {
  let manager: ConfigManager

  beforeEach(() => {
    manager = new ConfigManager()
  })

  it('should load default configuration', () => {
    const config = manager.load()
    expect(config).toBeDefined()
    expect(config.audio.sampleRate).toBe(DEFAULT_CONFIG.audio.sampleRate)
  })

  it('should load configuration with preset', () => {
    const config = manager.load({}, 'low-latency')
    expect(config.audio.bufferSize).toBe(LOW_LATENCY_PRESET.audio?.bufferSize)
  })

  it('should merge user config with default', () => {
    const userConfig = {
      audio: {
        sampleRate: 48000,
        bufferSize: 1024,
        workletBufferSize: 128,
        useWorklet: true
      }
    }

    const config = manager.load(userConfig)
    expect(config.audio.sampleRate).toBe(48000)
    expect(config.audio.bufferSize).toBe(1024)
    // Should preserve other default values
    expect(config.pitchDetector.clarityThreshold).toBe(DEFAULT_CONFIG.pitchDetector.clarityThreshold)
  })

  it('should get loaded configuration', () => {
    manager.load()
    const config = manager.get()
    expect(config).toBeDefined()
    expect(config.version).toBe('0.4.0')
  })

  it('should throw error when getting config before loading', () => {
    expect(() => manager.get()).toThrow()
  })

  it('should get specific config value by path', () => {
    manager.load()
    const sampleRate = manager.getValue('audio.sampleRate')
    expect(sampleRate).toBe(DEFAULT_CONFIG.audio.sampleRate)
  })

  it('should return undefined for non-existent path', () => {
    manager.load()
    const value = manager.getValue('audio.nonExistentKey')
    expect(value).toBeUndefined()
  })

  it('should freeze configuration (immutability)', () => {
    const config = manager.load()
    expect(() => {
      // @ts-expect-error - Testing immutability
      config.audio.sampleRate = 99999
    }).toThrow()
  })

  it('should handle unknown preset gracefully', () => {
    const config = manager.load({}, 'unknown-preset')
    // Should fall back to default
    expect(config.audio.sampleRate).toBe(DEFAULT_CONFIG.audio.sampleRate)
  })

  it('should throw error on invalid configuration', () => {
    const invalidConfig: any = {
      audio: {
        sampleRate: -1,  // Invalid
        bufferSize: 2048,
        workletBufferSize: 128,
        useWorklet: true
      }
    }

    expect(() => manager.load(invalidConfig)).toThrow()
  })
})

describe('App Configuration - Type Safety', () => {
  it('should enforce strict typing for LogLevel', () => {
    const validLogLevels: Array<typeof DEFAULT_CONFIG.performance.logLevel> = [
      'none', 'error', 'warn', 'info', 'debug'
    ]

    validLogLevels.forEach(level => {
      expect(['none', 'error', 'warn', 'info', 'debug']).toContain(level)
    })
  })

  it('should have version string', () => {
    expect(typeof DEFAULT_CONFIG.version).toBe('string')
    expect(DEFAULT_CONFIG.version).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('should have all required top-level keys', () => {
    const config = DEFAULT_CONFIG
    expect(config).toHaveProperty('audio')
    expect(config).toHaveProperty('pitchDetector')
    expect(config).toHaveProperty('smoothing')
    expect(config).toHaveProperty('onset')
    expect(config).toHaveProperty('spectral')
    expect(config).toHaveProperty('synthesizer')
    expect(config).toHaveProperty('performance')
  })
})
