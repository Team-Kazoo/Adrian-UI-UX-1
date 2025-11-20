/**
 * @fileoverview Manages audio device selection, enumeration, and persistence.
 * Interacts with the global store to update device-related state.
 */

import { store } from '../state/store.js';
import { AudioIO } from '../audio-io.js';
import '../types/app-types.js'; // For JSDoc type hints

class DeviceManager {
    /**
     * @param {AudioIO} audioIO - An instance of the AudioIO class.
     */
    constructor(audioIO) {
        if (!audioIO) {
            throw new Error('DeviceManager requires an AudioIO instance.');
        }
        this.audioIO = audioIO;
        /** @type {Function|null} */
        this._deviceChangeListener = null;
    }

    /**
     * Initializes the DeviceManager: loads preferences, refreshes device list, and sets up listeners.
     */
    async init() {
        this._loadPreferences();
        await this.refreshDevices();

        // Listen for device changes to keep the list updated
        if (navigator.mediaDevices?.addEventListener && !this._deviceChangeListener) {
            this._deviceChangeListener = () => {
                console.log('[DeviceManager] Media device change detected, refreshing list...');
                this.refreshDevices();
            };
            navigator.mediaDevices.addEventListener('devicechange', this._deviceChangeListener);
        }
    }

    /**
     * Cleans up listeners.
     */
    destroy() {
        if (this._deviceChangeListener) {
            navigator.mediaDevices.removeEventListener('devicechange', this._deviceChangeListener);
            this._deviceChangeListener = null;
        }
    }

    /**
     * Loads saved device preferences from localStorage and updates the store.
     * @private
     */
    _loadPreferences() {
        try {
            const savedInputId = localStorage.getItem('kazoo:lastInputDeviceId');
            const savedOutputId = localStorage.getItem('kazoo:lastOutputDeviceId');
            const savedInputLabel = localStorage.getItem('kazoo:lastInputDeviceLabel');
            const savedOutputLabel = localStorage.getItem('kazoo:lastOutputDeviceLabel');

            const updates = {};
            if (savedInputId) updates.inputDeviceId = savedInputId;
            if (savedOutputId) updates.outputDeviceId = savedOutputId;
            if (savedInputLabel) updates.lastKnownInputLabel = savedInputLabel;
            if (savedOutputLabel) updates.lastKnownOutputLabel = savedOutputLabel;

            if (Object.keys(updates).length > 0) {
                store.setState({ audio: { ...store.getState().audio, ...updates } });
                console.log('[DeviceManager] Loaded device preferences:', updates);
            }
        } catch (err) {
            console.warn('[DeviceManager] Unable to load saved device preferences:', err);
        }
    }

    /**
     * Persists selected device preferences to localStorage.
     * @param {'input'|'output'} type - Type of device ('input' or 'output').
     * @param {string} deviceId - The ID of the selected device.
     * @param {string} label - The label of the selected device.
     * @private
     */
    _persistPreferences(type, deviceId, label) {
        try {
            const idKey = type === 'input' ? 'kazoo:lastInputDeviceId' : 'kazoo:lastOutputDeviceId';
            const labelKey = type === 'input' ? 'kazoo:lastInputDeviceLabel' : 'kazoo:lastOutputDeviceLabel';
            localStorage.setItem(idKey, deviceId || 'default');
            if (label) {
                localStorage.setItem(labelKey, label);
            }
        } catch (err) {
            console.warn('[DeviceManager] Unable to persist device preference:', err);
        }
    }

    /**
     * Sets the selected input device in the store and persists it.
     * @param {string} deviceId - The ID of the selected input device.
     * @param {string} label - The label of the selected input device.
     */
    setSelectedInput(deviceId, label) {
        store.setState({ audio: { ...store.getState().audio, inputDeviceId: deviceId, lastKnownInputLabel: label } });
        this._persistPreferences('input', deviceId, label);
    }

    /**
     * Sets the selected output device in the store and persists it.
     * @param {string} deviceId - The ID of the selected output device.
     * @param {string} label - The label of the selected output device.
     */
    setSelectedOutput(deviceId, label) {
        store.setState({ audio: { ...store.getState().audio, outputDeviceId: deviceId, lastKnownOutputLabel: label } });
        this._persistPreferences('output', deviceId, label);
    }

    /**
     * Refreshes the list of available audio devices and updates the store.
     * Handles permission requests if labels are missing.
     */
    async refreshDevices() {
        console.log('[DeviceManager] Refreshing device list...');
        let { inputs, outputs } = await this.audioIO.enumerateDevices();

        // Check if labels are missing (implies no permission or initial enumeration)
        const hasEmptyLabels = inputs.some(d => !d.label) || outputs.some(d => !d.label);

        if (hasEmptyLabels) {
            console.log('[DeviceManager] Device labels missing, requesting temporary permission...');
            try {
                // Request explicit permission by creating a temporary stream
                const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
                // Stop immediately to release resources
                stream.getTracks().forEach(t => t.stop());
                console.log('[DeviceManager] Permissions granted. Re-enumerating devices...');
                // Re-enumerate devices now that permission is granted
                const result = await this.audioIO.enumerateDevices();
                inputs = result.inputs;
                outputs = result.outputs;
            } catch (err) {
                console.warn('[DeviceManager] Permission request failed:', err);
                // Don't throw, proceed with possibly empty labels.
                // An actual error will be handled by AudioIO when starting.
            }
        }

        store.setState({
            audio: {
                ...store.getState().audio,
                availableInputDevices: inputs.map(d => ({ deviceId: d.deviceId, label: d.label, kind: 'input' })),
                availableOutputDevices: outputs.map(d => ({ deviceId: d.deviceId, label: d.label, kind: 'output' }))
            }
        });
        console.log('[DeviceManager] Available devices updated in store.');
    }

    /**
     * Utility to sync a select element's value, adding an option if current value is not found.
     * @param {HTMLSelectElement|null} selectEl - The select element.
     * @param {string} deviceId - The ID of the device to select.
     * @param {string} fallbackLabel - A label to use if the device is not found.
     */
    syncSelectValue(selectEl, deviceId, fallbackLabel) {
        if (!selectEl || !deviceId) return;
        const options = [...selectEl.options];
        if (!options.some(o => o.value === deviceId)) {
            const option = document.createElement('option');
            option.value = deviceId;
            option.textContent = fallbackLabel || 'Active Device';
            selectEl.appendChild(option);
        }
        selectEl.value = deviceId;
    }

    /**
     * Utility to find a deviceId by its label in a select element.
     * @param {HTMLSelectElement|null} selectEl - The select element.
     * @param {string} label - The label to search for.
     * @returns {string|null} The deviceId if found, otherwise null.
     */
    findDeviceIdByLabel(selectEl, label) {
        if (!selectEl || !label) return null;
        const option = [...selectEl.options].find(o => o.textContent === label);
        return option ? option.value : null;
    }
}

export { DeviceManager };