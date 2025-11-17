/**
 * Kazoo Proto Web - Centralized Configuration Management
 *
 * Based on modern software engineering best practices:
 * - Single Source of Truth
 * - Type Safety
 * - Immutability
 * - Runtime Validation
 * - Complete Documentation
 *
 * @module AppConfig
 * @version 0.3.0
 */

// ============================================================================
// Type Definitions
// ============================================================================

export interface AudioEngineConfig {
  /** Sample rate (Hz) - affects: quality↑/CPU↑/latency↓ */
  sampleRate: number
  /** Buffer size (samples) for ScriptProcessor - affects: latency↓/stability↓/CPU↑ */
  bufferSize: number
  /** Worklet buffer size (fixed 128 samples) */
  workletBufferSize: number
  /** Use AudioWorklet (true) or ScriptProcessor (false) */
  useWorklet: boolean
}

export interface PitchDetectorConfig {
  /** YIN clarity threshold (0-1) - affects: sensitivity↑/false positives↑ */
  clarityThreshold: number
  /** Minimum detection frequency (Hz) - affects: range/CPU */
  minFrequency: number
  /** Maximum detection frequency (Hz) - affects: range/CPU */
  maxFrequency: number
  /** Minimum volume threshold */
  minVolumeThreshold?: number
  /** Minimum confidence threshold */
  minConfidence?: number
}

export interface KalmanFilterConfig {
  /** Process noise (Q) - affects: response speed↑/smoothness↓ */
  processNoise: number
  /** Measurement noise (R) - affects: smoothing strength↑ */
  measurementNoise: number
  /** Initial estimate value */
  initialEstimate: number
  /** Initial error covariance */
  initialError: number
}

export interface EMAFilterConfig {
  /** Smoothing coefficient (0-1) - affects: response speed↑/smoothness↓ */
  alpha: number
}

export interface SmoothingConfig {
  /** Kalman filter (cents smoothing) */
  kalman: KalmanFilterConfig
  /** EMA filter (volume smoothing) */
  volume: EMAFilterConfig
  /** EMA filter (brightness smoothing) */
  brightness: EMAFilterConfig
}

export interface OnsetDetectorConfig {
  /** Energy threshold (dB) - affects: onset sensitivity↑/false positives↑ */
  energyThreshold: number
  /** Silence threshold (dB) - affects: silence detection */
  silenceThreshold: number
  /** Attack minimum duration (ms) - affects: debouncing */
  attackDuration: number
  /** Release→Silence minimum duration (ms) - affects: tail handling */
  minSilenceDuration: number
  /** Time window size (frames) - affects: smoothness */
  timeWindow: number
  /** Debug mode */
  debug: boolean
}

export interface SpectralFeaturesConfig {
  /** FFT size (bins) - affects: frequency resolution↑/CPU↑ */
  fftSize: number
  /** FFT interval (frames) - affects: CPU↓/update rate↓ */
  fftInterval: number
  /** Analysis frequency lower bound (Hz) - affects: range/CPU */
  minFrequency: number
  /** Analysis frequency upper bound (Hz) - affects: range/CPU */
  maxFrequency: number
}

export interface FilterCutoffRange {
  /** Minimum cutoff frequency (Hz) */
  min: number
  /** Maximum cutoff frequency (Hz) */
  max: number
}

export interface SynthesizerConfig {
  /** Pitch bend range (cents) - affects: pitch adjustment range */
  pitchBendRange: number
  /** Filter cutoff range (Hz) */
  filterCutoffRange: FilterCutoffRange
  /** Noise gain maximum (0-1) - affects: breath effect intensity */
  noiseGainMax: number
}

export type LogLevel = 'none' | 'error' | 'warn' | 'info' | 'debug'

export interface PerformanceConfig {
  /** Enable performance statistics */
  enableStats: boolean
  /** Log level */
  logLevel: LogLevel
}

export interface AppConfigSchema {
  audio: AudioEngineConfig
  pitchDetector: PitchDetectorConfig
  smoothing: SmoothingConfig
  onset: OnsetDetectorConfig
  spectral: SpectralFeaturesConfig
  synthesizer: SynthesizerConfig
  performance: PerformanceConfig
  version?: string
}

export interface ValidationResult {
  valid: boolean
  errors: string[]
  warnings: string[]
}

// ============================================================================
// Default Configuration
// ============================================================================

/**
 * Default configuration - balances quality and performance
 * Suitable for: standard browsers, normal microphones, typical environments
 */
export const DEFAULT_CONFIG: Readonly<AppConfigSchema> = {
  audio: {
    sampleRate: 44100,           // 44.1kHz (CD quality)
    bufferSize: 2048,            // ~46ms latency @ 44.1kHz (ScriptProcessor)
    workletBufferSize: 128,      // Worklet buffer size (fixed 128 samples)
    useWorklet: true             // AudioWorklet (low latency)
  },

  pitchDetector: {
    clarityThreshold: 0.10,      // 🔥 Emergency: 0.15 → 0.10 (further relaxed)
    minFrequency: 50,            // 🔥 Fix: 50Hz (G1) - covers bass C2(65Hz) + tolerance
    maxFrequency: 1500,          // 🔥 Fix: 1500Hz (covers soprano + singing high range)
    minVolumeThreshold: 0.0005,  // 🔥 Emergency: 0.002 → 0.0005 (extreme relaxation, almost disabled)
    minConfidence: 0.01          // 🔥 Emergency: 0.05 → 0.01 (extreme relaxation)
  },

  smoothing: {
    kalman: {
      processNoise: 0.001,       // Q: process noise (response speed vs smoothness)
      measurementNoise: 0.1,     // R: measurement noise (measurement trust)
      initialEstimate: 0,        // initial estimate value
      initialError: 1            // initial error covariance
    },
    volume: {
      alpha: 0.3                 // smoothing coefficient (response speed vs smoothness)
    },
    brightness: {
      alpha: 0.2                 // smoothing coefficient (smoother visual feedback)
    }
  },

  onset: {
    energyThreshold: 3,          // 🔥 Fix: 6 → 3 dB (more sensitive, adapts to low confidence)
    silenceThreshold: -50,       // 🔥 Fix: -40 → -50 dB (allows quieter sounds)
    attackDuration: 50,          // Attack minimum duration (ms) - debouncing
    minSilenceDuration: 100,     // Release→Silence minimum duration (ms) - tail handling
    timeWindow: 3,               // Time window size (frames) - smoothness
    debug: false                 // Debug mode
  },

  spectral: {
    fftSize: 2048,               // FFT size (frequency resolution: 44100/2048 = 21.5 Hz/bin)
    fftInterval: 2,              // FFT interval (every 2 frames, saves 50% CPU)
    minFrequency: 80,            // Analysis frequency lower bound (Hz)
    maxFrequency: 8000           // Analysis frequency upper bound (Hz) - voice-related frequencies
  },

  synthesizer: {
    pitchBendRange: 100,         // Pitch bend range (cents) - ±100 cents = ±1 whole tone
    filterCutoffRange: {
      min: 200,                  // Filter cutoff minimum (Hz)
      max: 8000                  // Filter cutoff maximum (Hz)
    },
    noiseGainMax: 0.3            // Noise gain maximum (breath effect intensity)
  },

  performance: {
    enableStats: true,           // Enable performance statistics
    logLevel: 'info'             // Log level: none/error/warn/info/debug
  },

  version: '0.4.0'  // Keep in sync with package.json
}

// ============================================================================
// Preset Configurations
// ============================================================================

/**
 * Low latency preset
 * Suitable for: real-time performance, interactive applications
 */
export const LOW_LATENCY_PRESET: Partial<AppConfigSchema> = {
  audio: {
    sampleRate: 48000,
    bufferSize: 512,             // ~10ms latency (ScriptProcessor)
    workletBufferSize: 128,      // Worklet fixed 128 samples
    useWorklet: true
  },
  smoothing: {
    kalman: {
      processNoise: 0.005,       // Faster response
      measurementNoise: 0.1,
      initialEstimate: 0,
      initialError: 1
    },
    volume: { alpha: 0.5 },      // Faster response
    brightness: { alpha: 0.3 }
  },
  spectral: {
    fftSize: 1024,               // Smaller FFT
    fftInterval: 2,
    minFrequency: 80,
    maxFrequency: 8000
  }
}

/**
 * High quality preset
 * Suitable for: pitch analysis, recording, post-processing
 */
export const HIGH_QUALITY_PRESET: Partial<AppConfigSchema> = {
  audio: {
    sampleRate: 48000,
    bufferSize: 4096,            // ~85ms latency, high stability (ScriptProcessor)
    workletBufferSize: 128,      // Worklet fixed 128 samples
    useWorklet: true
  },
  pitchDetector: {
    clarityThreshold: 0.90,      // High confidence
    minFrequency: 80,
    maxFrequency: 2000
  },
  smoothing: {
    kalman: {
      processNoise: 0.0001,      // High smoothness
      measurementNoise: 0.05,
      initialEstimate: 0,
      initialError: 1
    },
    volume: { alpha: 0.1 },      // High smoothness
    brightness: { alpha: 0.1 }
  },
  spectral: {
    fftSize: 4096,               // High frequency resolution
    fftInterval: 1,              // Analyze every frame
    minFrequency: 80,
    maxFrequency: 8000
  }
}

/**
 * Power saving preset
 * Suitable for: low-end devices, mobile devices, power-saving mode
 */
export const POWER_SAVING_PRESET: Partial<AppConfigSchema> = {
  audio: {
    sampleRate: 22050,           // Lower sample rate
    bufferSize: 2048,            // ScriptProcessor buffer
    workletBufferSize: 128,      // Worklet fixed 128 samples (not used)
    useWorklet: false            // Compatible with older browsers
  },
  pitchDetector: {
    clarityThreshold: 0.85,
    minFrequency: 100,
    maxFrequency: 800
  },
  smoothing: {
    kalman: {
      processNoise: 0.001,
      measurementNoise: 0.2,
      initialEstimate: 0,
      initialError: 1
    },
    volume: { alpha: 0.3 },
    brightness: { alpha: 0.3 }
  },
  spectral: {
    fftSize: 1024,               // Lower FFT size
    fftInterval: 4,              // Only 25% frames run FFT
    minFrequency: 100,
    maxFrequency: 4000
  },
  performance: {
    enableStats: false,          // Disable statistics
    logLevel: 'error'
  }
}

// ============================================================================
// Configuration Validation
// ============================================================================

/**
 * Validate configuration object
 */
export function validateConfig(config: Partial<AppConfigSchema>): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []

  // Validate audio engine config
  if (config.audio) {
    const { sampleRate, bufferSize, useWorklet } = config.audio

    if (sampleRate && (sampleRate < 8000 || sampleRate > 96000)) {
      errors.push(`Invalid sample rate: ${sampleRate} (valid range: 8000-96000 Hz)`)
    }

    if (bufferSize && ![256, 512, 1024, 2048, 4096, 8192, 16384].includes(bufferSize)) {
      errors.push(`Invalid buffer size: ${bufferSize} (must be power of 2: 256-16384)`)
    }

    if (useWorklet === true && typeof AudioWorkletNode === 'undefined') {
      warnings.push('AudioWorklet not available, will fallback to ScriptProcessor')
    }
  }

  // Validate pitch detector config
  if (config.pitchDetector) {
    const { clarityThreshold, minFrequency, maxFrequency } = config.pitchDetector

    if (clarityThreshold !== undefined && (clarityThreshold < 0 || clarityThreshold > 1)) {
      errors.push(`Invalid clarity threshold: ${clarityThreshold} (valid range: 0-1)`)
    }

    if (minFrequency && maxFrequency && minFrequency >= maxFrequency) {
      errors.push(`minFrequency (${minFrequency}) must be less than maxFrequency (${maxFrequency})`)
    }

    if (maxFrequency && config.audio?.sampleRate && maxFrequency >= config.audio.sampleRate / 2) {
      errors.push(`maxFrequency (${maxFrequency}) must be less than Nyquist frequency (${config.audio.sampleRate / 2})`)
    }
  }

  // Validate smoothing config
  if (config.smoothing) {
    const { kalman, volume, brightness } = config.smoothing

    if (kalman) {
      if (kalman.processNoise !== undefined && kalman.processNoise <= 0) {
        errors.push(`processNoise must be > 0 (current: ${kalman.processNoise})`)
      }
      if (kalman.measurementNoise !== undefined && kalman.measurementNoise <= 0) {
        errors.push(`measurementNoise must be > 0 (current: ${kalman.measurementNoise})`)
      }
    }

    if (volume?.alpha !== undefined && (volume.alpha < 0 || volume.alpha > 1)) {
      errors.push(`volume.alpha must be in range 0-1 (current: ${volume.alpha})`)
    }

    if (brightness?.alpha !== undefined && (brightness.alpha < 0 || brightness.alpha > 1)) {
      errors.push(`brightness.alpha must be in range 0-1 (current: ${brightness.alpha})`)
    }
  }

  // Validate onset detector config
  if (config.onset) {
    const { energyThreshold, silenceThreshold } = config.onset

    if (energyThreshold !== undefined && energyThreshold < 0) {
      errors.push(`energyThreshold must be >= 0 (current: ${energyThreshold})`)
    }

    if (silenceThreshold !== undefined && silenceThreshold > 0) {
      warnings.push(`silenceThreshold is typically negative (current: ${silenceThreshold})`)
    }
  }

  // Validate spectral config
  if (config.spectral) {
    const { fftSize, fftInterval } = config.spectral

    if (fftSize && ![128, 256, 512, 1024, 2048, 4096, 8192, 16384].includes(fftSize)) {
      errors.push(`Invalid fftSize: ${fftSize} (must be power of 2: 128-16384)`)
    }

    if (fftInterval !== undefined && fftInterval < 1) {
      errors.push(`fftInterval must be >= 1 (current: ${fftInterval})`)
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings
  }
}

// ============================================================================
// Configuration Manager
// ============================================================================

/**
 * Configuration Manager Class
 *
 * Responsibilities:
 * - Configuration loading and merging
 * - Configuration validation
 * - Configuration immutability guarantee
 * - Configuration hot-reloading (optional)
 */
export class ConfigManager {
  private _config: AppConfigSchema | null = null
  private _frozen = false

  /**
   * Load configuration
   */
  load(userConfig: Partial<AppConfigSchema> = {}, preset: string | null = null): AppConfigSchema {
    // 1. Select base configuration
    let baseConfig: AppConfigSchema = { ...DEFAULT_CONFIG }

    if (preset) {
      switch (preset) {
        case 'low-latency':
          baseConfig = this._mergeDeep(DEFAULT_CONFIG, LOW_LATENCY_PRESET) as AppConfigSchema
          break
        case 'high-quality':
          baseConfig = this._mergeDeep(DEFAULT_CONFIG, HIGH_QUALITY_PRESET) as AppConfigSchema
          break
        case 'power-saving':
          baseConfig = this._mergeDeep(DEFAULT_CONFIG, POWER_SAVING_PRESET) as AppConfigSchema
          break
        default:
          console.warn(`[ConfigManager] Unknown preset: ${preset}, using default config`)
      }
    }

    // 2. Merge user configuration
    const mergedConfig = this._mergeDeep(baseConfig, userConfig) as AppConfigSchema

    // 3. Validate configuration
    const validation = validateConfig(mergedConfig)

    if (!validation.valid) {
      console.error('[ConfigManager] Configuration validation failed:', validation.errors)
      throw new Error(`Invalid configuration: ${validation.errors.join(', ')}`)
    }

    if (validation.warnings.length > 0) {
      validation.warnings.forEach(warn => console.warn(`[ConfigManager] ${warn}`))
    }

    // 4. Freeze configuration (immutability)
    this._config = Object.freeze(this._deepFreeze(mergedConfig))
    this._frozen = true

    console.log('[ConfigManager] Configuration loaded successfully')
    console.log('[ConfigManager] Version:', this._config.version || 'unknown')
    console.log('[ConfigManager] Preset:', preset || 'default')
    console.log('[ConfigManager] Sample rate:', this._config.audio.sampleRate)
    console.log('[ConfigManager] Buffer size:', this._config.audio.bufferSize)
    console.log('[ConfigManager] Worklet:', this._config.audio.useWorklet)
    console.log('[ConfigManager] minVolumeThreshold:', this._config.pitchDetector?.minVolumeThreshold)
    console.log('[ConfigManager] minConfidence:', this._config.pitchDetector?.minConfidence)

    return this._config
  }

  /**
   * Get current configuration
   */
  get(): AppConfigSchema {
    if (!this._config) {
      throw new Error('[ConfigManager] Configuration not loaded, please call load() first')
    }
    return this._config
  }

  /**
   * Get specific configuration value by path
   */
  getValue(path: string): any {
    const keys = path.split('.')
    let value: any = this.get()

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key]
      } else {
        return undefined
      }
    }

    return value
  }

  /**
   * Deep merge objects
   */
  private _mergeDeep(target: any, source: any): any {
    const output = { ...target }

    if (this._isObject(target) && this._isObject(source)) {
      Object.keys(source).forEach(key => {
        if (this._isObject(source[key])) {
          if (!(key in target)) {
            output[key] = source[key]
          } else {
            output[key] = this._mergeDeep(target[key], source[key])
          }
        } else {
          output[key] = source[key]
        }
      })
    }

    return output
  }

  /**
   * Deep freeze object
   */
  private _deepFreeze(obj: any): any {
    Object.keys(obj).forEach(key => {
      if (this._isObject(obj[key])) {
        this._deepFreeze(obj[key])
      }
    })
    return Object.freeze(obj)
  }

  /**
   * Check if item is object
   */
  private _isObject(item: any): boolean {
    return item && typeof item === 'object' && !Array.isArray(item)
  }
}

// ============================================================================
// Exports
// ============================================================================

// Singleton pattern
export const configManager = new ConfigManager()

// Default export
export default configManager
