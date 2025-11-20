/**
 * @fileoverview Manages synthesizer state, instrument switching, and audio effects.
 * Acts as the bridge between the Global Store and the Audio Engines.
 */

import { store } from '../state/store.js';
import '../types/app-types.js';

class SynthManager {
    /**
     * @param {Object} engines
     * @param {Object} engines.continuous - The ContinuousSynthEngine instance
     * @param {Object} engines.legacy - The SynthesizerEngine (Legacy) instance
     */
    constructor({ continuous, legacy }) {
        this.continuousEngine = continuous;
        this.legacyEngine = legacy;
        
        // Default to continuous based on store initial state or fallback
        this.activeEngine = this.continuousEngine; 
    }

    /**
     * Initialize manager: sync engines with initial store state
     */
    init() {
        const state = store.getState().synth;
        
        // Sync Mode
        this.setMode(state.continuousMode);

        // Sync Instrument
        this.setInstrument(state.instrument);

        // Sync Effects
        this.setReverb(state.reverbWet);
        this.setDelay(state.delayWet);
        
        // Sync Auto-Tune
        if (state.autoTune) {
            this.setAutoTuneConfig(state.autoTune);
        }
    }

    /**
     * Set the active synthesis mode
     * @param {boolean} isContinuous - True for Continuous Engine, False for Legacy
     */
    setMode(isContinuous) {
        // 1. Stop the currently running engine to prevent stuck notes
        // Note: We assume the app controller handles the main "Start/Stop" flow,
        // but swapping engines mid-flight requires care.
        if (this.activeEngine && this.activeEngine.stop) {
             // If we were playing, we might want to stop sound. 
             // But for now, let's just swap the reference.
             // The Main Controller handles the actual audio graph connection usually.
        }

        // 2. Swap Reference
        this.activeEngine = isContinuous ? this.continuousEngine : this.legacyEngine;

        // 3. Update Store
        store.setState({
            synth: { ...store.getState().synth, continuousMode: isContinuous }
        });

        console.log(`[SynthManager] Mode set to: ${isContinuous ? 'Continuous' : 'Legacy'}`);
    }

    /**
     * Select an instrument
     * @param {string} instrumentId 
     */
    setInstrument(instrumentId) {
        if (!instrumentId) return;

        // 1. Update Audio Engine
        if (this.activeEngine && this.activeEngine.changeInstrument) {
            try {
                this.activeEngine.changeInstrument(instrumentId);
            } catch (err) {
                console.error(`[SynthManager] Failed to change instrument to ${instrumentId}:`, err);
                return; 
            }
        }

        // 2. Update Store
        store.setState({
            synth: { ...store.getState().synth, instrument: instrumentId }
        });
    }

    /**
     * Update Reverb Wetness
     * @param {number} amount - 0.0 to 1.0
     */
    setReverb(amount) {
        // Clamp
        const val = Math.max(0, Math.min(1, amount));

        if (this.activeEngine && this.activeEngine.setReverbWet) {
            this.activeEngine.setReverbWet(val);
        }

        store.setState({
            synth: { ...store.getState().synth, reverbWet: val }
        });
    }

    /**
     * Update Delay Wetness
     * @param {number} amount - 0.0 to 1.0
     */
    setDelay(amount) {
        const val = Math.max(0, Math.min(1, amount));

        if (this.activeEngine && this.activeEngine.setDelayWet) {
            this.activeEngine.setDelayWet(val);
        }

        store.setState({
            synth: { ...store.getState().synth, delayWet: val }
        });
    }

    /**
     * Update Auto-Tune Configuration
     * @param {Partial<AutoTuneConfig>} config 
     */
    setAutoTuneConfig(config) {
        const currentConfig = store.getState().synth.autoTune;
        const newConfig = { ...currentConfig, ...config };

        // Apply to Engine (Continuous only)
        if (this.continuousEngine) {
            if (config.strength !== undefined) {
                this.continuousEngine.setAutoTuneStrength(newConfig.enabled ? newConfig.strength : 0);
            }
            if (config.enabled !== undefined) {
                // If disabling, set strength to 0. If enabling, restore strength.
                this.continuousEngine.setAutoTuneStrength(newConfig.enabled ? newConfig.strength : 0);
            }
            if (config.speed !== undefined && this.continuousEngine.setRetuneSpeed) {
                this.continuousEngine.setRetuneSpeed(newConfig.speed);
            }
            if ((config.key || config.scale) && this.continuousEngine.setScale) {
                this.continuousEngine.setScale(newConfig.key, newConfig.scale);
            }
        }

        // Update Store
        store.setState({
            synth: { 
                ...store.getState().synth, 
                autoTune: newConfig 
            }
        });
    }

    /**
     * Get the currently active engine instance
     */
    getActiveEngine() {
        return this.activeEngine;
    }
}

export { SynthManager };