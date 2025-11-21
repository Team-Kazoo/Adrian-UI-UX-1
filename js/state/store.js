/**
 * @fileoverview Central State Store (The Brain)
 * Implements a simple Pub/Sub pattern to manage application state.
 * Replaces the "Global Variables" mess in main.js.
 */

import '../types/app-types.js'; // Import types for JSDoc support

class StateStore {
    constructor() {
        /** @type {AppState} */
        this.state = {
            status: {
                engineState: 'idle',
                lastError: null
            },
            audio: {
                inputDeviceId: 'default',
                outputDeviceId: 'default',
                lastKnownInputLabel: 'System Default',
                lastKnownOutputLabel: 'System Default',
                availableInputDevices: [],
                availableOutputDevices: [],
                latency: 0,
                isWorkletActive: false
            },
            synth: {
                instrument: 'flute',
                continuousMode: true,
                autoTune: {
                    enabled: false,
                    key: 'C',
                    scale: 'chromatic',
                    strength: 0.5,
                    speed: 0.1
                },
                reverbWet: 0.2,
                delayWet: 0.0
            },
            ui: {
                isSettingsOpen: false,
                isHelpOpen: false,
                activeView: 'main'
            }
        };

        this.listeners = new Set();
        // Only enable debug in development
        this.debug = typeof window !== 'undefined' && window.location.hostname === 'localhost';
    }

    /**
     * Get a snapshot of the current state
     * @returns {AppState}
     */
    getState() {
        // Return a shallow copy to prevent direct accidental mutation
        // For deep copy, use structuredClone if needed, but spread is usually enough for read-access
        return { ...this.state };
    }

    /**
     * Update specific parts of the state
     * @param {Partial<AppState>} partialState - Object containing changes
     * @example store.setState({ audio: { ...store.state.audio, latency: 12 } })
     */
    setState(partialState) {
        const previousState = this.state;
        
        // Deep merge logic (simplified for 2 levels depth)
        // In a real Redux app we'd use reducers, but here we do a smart merge
        const newState = { ...previousState };

        for (const [key, value] of Object.entries(partialState)) {
            if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
                newState[key] = { ...previousState[key], ...value };
            } else {
                newState[key] = value;
            }
        }

        this.state = newState;

        if (this.debug) {
            console.groupCollapsed('[Store] State Change');
            console.log('Prev:', previousState);
            console.log('Diff:', partialState);
            console.log('Next:', this.state);
            console.groupEnd();
        }

        this.notify();
    }

    /**
     * Subscribe to state changes
     * @param {Function} listener - Callback function receiving (newState, oldState)
     * @returns {Function} Unsubscribe function
     */
    subscribe(listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    /**
     * Notify all listeners
     * @private
     */
    notify() {
        this.listeners.forEach(listener => listener(this.state));
    }

    // ==================== Actions (Convenience Methods) ====================

    /**
     * Action: Set Engine Status
     * @param {'idle'|'starting'|'running'|'error'} status 
     */
    setEngineStatus(status) {
        this.setState({ status: { ...this.state.status, engineState: status } });
    }

    /**
     * Action: Select Instrument
     * @param {string} instrumentId 
     */
    setInstrument(instrumentId) {
        this.setState({ synth: { ...this.state.synth, instrument: instrumentId } });
    }

    /**
     * Action: Update Audio Device
     * @param {'input'|'output'} kind
     * @param {string} deviceId
     */
    setAudioDevice(kind, deviceId) {
        const audioState = { ...this.state.audio };
        if (kind === 'input') audioState.inputDeviceId = deviceId;
        if (kind === 'output') audioState.outputDeviceId = deviceId;
        this.setState({ audio: audioState });
    }
}

// Export as Singleton
export const store = new StateStore();
