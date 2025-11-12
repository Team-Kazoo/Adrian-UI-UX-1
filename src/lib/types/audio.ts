/**
 * TypeScript type definitions for audio system
 */

export interface PitchData {
  note: string
  frequency: number
  confidence: number
  clarity?: number
}

export interface AudioState {
  isReady: boolean
  isPlaying: boolean
  currentInstrument: InstrumentType
  currentMode: AudioMode
  pitchData: PitchData | null
  latency: number
  status: string
}

export type InstrumentType = 'saxophone' | 'violin' | 'piano' | 'flute' | 'guitar' | 'synth'

export type AudioMode = 'continuous' | 'traditional' | 'legacy'

export interface AudioServiceControls {
  start: () => Promise<void>
  stop: () => void
  changeInstrument: (instrument: InstrumentType) => void
  changeMode: (mode: AudioMode) => void
}

export interface PitchFrame {
  pitch: number
  clarity: number
  rms: number
  timestamp: number
}
