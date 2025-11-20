import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DeviceManager } from '../../js/managers/device-manager.js';
import { store } from '../../js/state/store.js';
import { AudioIO } from '../../js/audio-io.js';

// Mock AudioIO
const mockAudioIO = {
    enumerateDevices: vi.fn(() => Promise.resolve({ inputs: [], outputs: [] })),
    // Mock other AudioIO methods if they were used directly by DeviceManager
};

// Mock localStorage
const localStorageMock = (function() {
    let store = {};
    return {
        getItem: vi.fn(function(key) {
            return store[key] || null;
        }),
        setItem: vi.fn(function(key, value) {
            store[key] = value.toString();
        }),
        clear: vi.fn(function() {
            store = {};
        }),
        removeItem: vi.fn(function(key) {
            delete store[key];
        }),
    };
})();

// Mock navigator.mediaDevices
const mockMediaDevices = {
    enumerateDevices: vi.fn(() => Promise.resolve([])),
    getUserMedia: vi.fn(() => Promise.resolve({
        getTracks: () => [{ stop: vi.fn() }]
    })),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
};

Object.defineProperty(global, 'localStorage', { value: localStorageMock });
Object.defineProperty(global, 'navigator', {
    value: {
        mediaDevices: mockMediaDevices,
        userAgent: 'test'
    },
    writable: true // Needed if navigator properties are to be reassigned
});

describe('DeviceManager', () => {
    let deviceManager;

    beforeEach(() => {
        localStorage.clear(); // Clear localStorage before each test
        store.setState({ // Reset store state
            audio: {
                inputDeviceId: 'default',
                outputDeviceId: 'default',
                lastKnownInputLabel: 'System Default',
                lastKnownOutputLabel: 'System Default',
                availableInputDevices: [],
                availableOutputDevices: [],
                latency: 0,
                isWorkletActive: false
            }
        });

        // Reset mocks
        vi.clearAllMocks();
        mockAudioIO.enumerateDevices.mockResolvedValue({ inputs: [], outputs: [] });
        mockMediaDevices.enumerateDevices.mockResolvedValue([]);
        mockMediaDevices.getUserMedia.mockResolvedValue({
            getTracks: () => [{ stop: vi.fn() }]
        });
        
        deviceManager = new DeviceManager(mockAudioIO);
    });

    it('should be created with an AudioIO instance', () => {
        expect(deviceManager).toBeInstanceOf(DeviceManager);
        expect(deviceManager.audioIO).toBe(mockAudioIO);
    });

    it('should throw an error if no AudioIO instance is provided', () => {
        expect(() => new DeviceManager(null)).toThrow('DeviceManager requires an AudioIO instance.');
    });

    describe('init()', () => {
        it('should load preferences, refresh devices, and set up devicechange listener', async () => {
            const spyLoadPrefs = vi.spyOn(deviceManager, '_loadPreferences');
            const spyRefreshDevices = vi.spyOn(deviceManager, 'refreshDevices');
            
            await deviceManager.init();

            expect(spyLoadPrefs).toHaveBeenCalled();
            expect(spyRefreshDevices).toHaveBeenCalled();
            expect(mockMediaDevices.addEventListener).toHaveBeenCalledWith('devicechange', expect.any(Function));
        });
    });

    describe('destroy()', () => {
        it('should remove the devicechange listener', async () => {
            await deviceManager.init();
            deviceManager.destroy();
            expect(mockMediaDevices.removeEventListener).toHaveBeenCalledWith('devicechange', expect.any(Function));
        });
    });

    describe('_loadPreferences()', () => {
        it('should load saved preferences from localStorage and update store', () => {
            localStorage.setItem('kazoo:lastInputDeviceId', 'input1');
            localStorage.setItem('kazoo:lastOutputDeviceId', 'output1');
            localStorage.setItem('kazoo:lastInputDeviceLabel', 'Mic 1');
            localStorage.setItem('kazoo:lastOutputDeviceLabel', 'Speaker 1');

            deviceManager._loadPreferences();

            const audioState = store.getState().audio;
            expect(audioState.inputDeviceId).toBe('input1');
            expect(audioState.outputDeviceId).toBe('output1');
            expect(audioState.lastKnownInputLabel).toBe('Mic 1');
            expect(audioState.lastKnownOutputLabel).toBe('Speaker 1');
        });

        it('should not update store if no preferences are saved', () => {
            deviceManager._loadPreferences();
            const audioState = store.getState().audio;
            expect(audioState.inputDeviceId).toBe('default'); // Initial default state
        });
    });

    describe('_persistPreferences()', () => {
        it('should save input preferences to localStorage', () => {
            deviceManager._persistPreferences('input', 'newInputId', 'New Mic');
            expect(localStorage.getItem('kazoo:lastInputDeviceId')).toBe('newInputId');
            expect(localStorage.getItem('kazoo:lastInputDeviceLabel')).toBe('New Mic');
        });

        it('should save output preferences to localStorage', () => {
            deviceManager._persistPreferences('output', 'newOutputId', 'New Speaker');
            expect(localStorage.getItem('kazoo:lastOutputDeviceId')).toBe('newOutputId');
            expect(localStorage.getItem('kazoo:lastOutputDeviceLabel')).toBe('New Speaker');
        });
    });

    describe('setSelectedInput()', () => {
        it('should update store and persist preferences', () => {
            const spyPersist = vi.spyOn(deviceManager, '_persistPreferences');
            deviceManager.setSelectedInput('newInput', 'New Mic Label');
            const audioState = store.getState().audio;
            expect(audioState.inputDeviceId).toBe('newInput');
            expect(audioState.lastKnownInputLabel).toBe('New Mic Label');
            expect(spyPersist).toHaveBeenCalledWith('input', 'newInput', 'New Mic Label');
        });
    });

    describe('setSelectedOutput()', () => {
        it('should update store and persist preferences', () => {
            const spyPersist = vi.spyOn(deviceManager, '_persistPreferences');
            deviceManager.setSelectedOutput('newOutput', 'New Speaker Label');
            const audioState = store.getState().audio;
            expect(audioState.outputDeviceId).toBe('newOutput');
            expect(audioState.lastKnownOutputLabel).toBe('New Speaker Label');
            expect(spyPersist).toHaveBeenCalledWith('output', 'newOutput', 'New Speaker Label');
        });
    });

    describe('refreshDevices()', () => {
        const mockInputDevices = [
            { deviceId: 'mic1', label: 'Microphone 1', kind: 'audioinput', groupId: 'g1' },
            { deviceId: 'mic2', label: 'Microphone 2', kind: 'audioinput', groupId: 'g2' }
        ];
        const mockOutputDevices = [
            { deviceId: 'spk1', label: 'Speaker 1', kind: 'audiooutput', groupId: 'g3' }
        ];

        it('should enumerate devices and update the store', async () => {
            mockAudioIO.enumerateDevices.mockResolvedValueOnce({
                inputs: mockInputDevices,
                outputs: mockOutputDevices
            });

            await deviceManager.refreshDevices();

            const audioState = store.getState().audio;
            expect(mockAudioIO.enumerateDevices).toHaveBeenCalledTimes(1);
            expect(audioState.availableInputDevices).toEqual(mockInputDevices.map(d => ({ deviceId: d.deviceId, label: d.label, kind: 'input' })));
            expect(audioState.availableOutputDevices).toEqual(mockOutputDevices.map(d => ({ deviceId: d.deviceId, label: d.label, kind: 'output' })));
        });

        it('should request permission if labels are missing and re-enumerate', async () => {
            // First enumerate returns empty labels
            mockAudioIO.enumerateDevices.mockResolvedValueOnce({
                inputs: [{ deviceId: 'mic1', label: '', kind: 'audioinput' }],
                outputs: []
            });
            // Second enumerate returns full labels after permission
            mockAudioIO.enumerateDevices.mockResolvedValueOnce({
                inputs: mockInputDevices,
                outputs: mockOutputDevices
            });

            await deviceManager.refreshDevices();

            expect(mockMediaDevices.getUserMedia).toHaveBeenCalledWith({ audio: true, video: false });
            // Check that enumerateDevices was called twice (initial + retry)
            expect(mockAudioIO.enumerateDevices).toHaveBeenCalledTimes(2);
            
            const audioState = store.getState().audio;
            expect(audioState.availableInputDevices).toEqual(mockInputDevices.map(d => ({ deviceId: d.deviceId, label: d.label, kind: 'input' })));
        });

        it('should not request permission if labels are present', async () => {
            mockAudioIO.enumerateDevices.mockResolvedValueOnce({
                inputs: mockInputDevices,
                outputs: mockOutputDevices
            });

            await deviceManager.refreshDevices();

            expect(mockMediaDevices.getUserMedia).not.toHaveBeenCalled();
            expect(mockAudioIO.enumerateDevices).toHaveBeenCalledTimes(1);
        });

        it('should handle getUserMedia permission denial gracefully', async () => {
            mockAudioIO.enumerateDevices.mockResolvedValueOnce({
                inputs: [{ deviceId: 'mic1', label: '', kind: 'audioinput' }],
                outputs: []
            });
            mockMediaDevices.getUserMedia.mockRejectedValueOnce(new Error('Permission denied'));

            await deviceManager.refreshDevices();

            expect(mockMediaDevices.getUserMedia).toHaveBeenCalledTimes(1);
            // If permission is denied, re-enumeration is skipped in the try block
            expect(mockAudioIO.enumerateDevices).toHaveBeenCalledTimes(1); 
            // Store should contain the empty-labeled devices from the first enumerate
            const audioState = store.getState().audio;
            expect(audioState.availableInputDevices.some(d => d.label === '')).toBe(true);
        });
    });

    describe('syncSelectValue()', () => {
        let mockSelect;

        beforeEach(() => {
            mockSelect = {
                options: [],
                value: '',
                appendChild: vi.fn(function(option) { this.options.push(option); }),
            };
            Object.defineProperty(mockSelect, 'options', { writable: true, value: [] });
            mockSelect.options.some = Array.prototype.some; // Add array methods for testing
        });

        it('should set select value if deviceId exists', () => {
            mockSelect.options = [{ value: 'id1', textContent: 'Device 1' }];
            deviceManager.syncSelectValue(mockSelect, 'id1', 'Device 1');
            expect(mockSelect.value).toBe('id1');
            expect(mockSelect.appendChild).not.toHaveBeenCalled();
        });

        it('should add option and set value if deviceId does not exist', () => {
            mockSelect.options = [{ value: 'id1', textContent: 'Device 1' }];
            deviceManager.syncSelectValue(mockSelect, 'id2', 'Device 2 (Disconnected)');
            expect(mockSelect.appendChild).toHaveBeenCalledTimes(1);
            expect(mockSelect.options[1].value).toBe('id2');
            expect(mockSelect.options[1].textContent).toBe('Device 2 (Disconnected)');
            expect(mockSelect.value).toBe('id2');
        });

        it('should use default label if fallbackLabel is not provided', () => {
            deviceManager.syncSelectValue(mockSelect, 'id3', null);
            expect(mockSelect.appendChild).toHaveBeenCalledTimes(1);
            expect(mockSelect.options[0].textContent).toBe('Active Device');
        });
    });

    describe('findDeviceIdByLabel()', () => {
        let mockSelect;

        beforeEach(() => {
            mockSelect = {
                options: [
                    { value: 'id1', textContent: 'Mic 1' },
                    { value: 'id2', textContent: 'Mic 2' }
                ],
            };
            Object.defineProperty(mockSelect, 'options', { writable: true, value: mockSelect.options });
        });

        it('should return deviceId if label matches', () => {
            expect(deviceManager.findDeviceIdByLabel(mockSelect, 'Mic 1')).toBe('id1');
        });

        it('should return null if label does not match', () => {
            expect(deviceManager.findDeviceIdByLabel(mockSelect, 'Unknown Mic')).toBeNull();
        });
    });
});