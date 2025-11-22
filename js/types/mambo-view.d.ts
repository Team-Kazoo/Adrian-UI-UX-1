/**
 * TypeScript type definitions for MamboView
 * These definitions provide full IDE autocomplete and type checking
 */

import { AppState } from './app-types.js';

export interface MamboViewHandlers {
    // Effects handlers
    onReverbChange?: (percent: number) => void;
    onDelayChange?: (percent: number) => void;

    // Instrument handlers
    onSelectInstrument?: (instrumentId: string) => void;

    // Transport handlers
    onStart?: () => void;
    onStop?: () => void;
    onModeChange?: (isContinuous: boolean) => void;

    // AI Jam handlers
    onToggleAiJam?: () => void;

    // Device selection handlers
    onInputDeviceChange?: (deviceId: string) => void;
    onOutputDeviceChange?: (deviceId: string) => void;
    onRefreshDevices?: () => void;

    // Settings handlers
    onOpenSettings?: () => void;
    onCloseSettings?: () => void;

    // Help handlers
    onHelpBtnClick?: () => void;
    onHelpToggle?: () => void;
}

export interface DeviceState {
    inputDevices: Array<{ deviceId: string; label: string }>;
    outputDevices: Array<{ deviceId: string; label: string }>;
    selectedInputId: string;
    selectedOutputId: string;
    lastKnownInputLabel?: string;
    lastKnownOutputLabel?: string;
}

export interface AiJamState {
    status: 'idle' | 'loading' | 'ready' | 'processing' | 'error';
    message?: string;
}

export interface VisualizerMetrics {
    note: string;
    octave: number;
    frequency: number;
    confidence: number;
    latency: number;
}

export interface StatusMessageOptions {
    highlight?: boolean;
    active?: boolean;
    timeout?: number;
    restoreText?: string;
}

export declare class MamboView {
    // Document reference
    doc: Document;

    // Effects Elements
    reverbSlider: HTMLInputElement | null;
    reverbValue: HTMLElement | null;
    delaySlider: HTMLInputElement | null;
    delayValue: HTMLElement | null;

    // Transport Elements
    startBtn: HTMLButtonElement | null;
    stopBtn: HTMLButtonElement | null;
    modeToggle: HTMLInputElement | null;
    modeText: HTMLElement | null;

    // Instrument Elements
    instrumentBtns: NodeListOf<HTMLElement> | null;
    instrumentStatus: HTMLElement | null;

    // AI Jam Elements
    aiJamBtn: HTMLButtonElement | null;
    aiJamTitle: HTMLElement | null;
    aiJamStatus: HTMLElement | null;
    aiIconIdle: HTMLElement | null;
    aiIconLoading: HTMLElement | null;
    aiIconActive: HTMLElement | null;
    aiProgressBar: HTMLElement | null;

    // Device Select Elements
    audioInputSelect: HTMLSelectElement | null;
    audioOutputSelect: HTMLSelectElement | null;
    refreshDevicesBtn: HTMLButtonElement | null;

    // Settings Modal Elements
    settingsBtn: HTMLButtonElement | null;
    settingsModal: HTMLElement | null;
    settingsBackdrop: HTMLElement | null;
    settingsPanel: HTMLElement | null;
    closeSettingsBtn: HTMLButtonElement | null;

    // Status Message Elements
    systemStatus: HTMLElement | null;
    warningBox: HTMLElement | null;
    warningText: HTMLElement | null;
    recordingHelper: HTMLElement | null;

    // Help Section Elements
    helpBtn: HTMLButtonElement | null;
    helpToggle: HTMLButtonElement | null;
    helpContent: HTMLElement | null;

    // Auto-Tune Control Elements
    strengthControl: HTMLElement | null;
    speedControl: HTMLElement | null;

    // Visualizer Metrics Elements
    currentNote: HTMLElement | null;
    currentFreq: HTMLElement | null;
    visualizerConfidence: HTMLElement | null;
    visualizerLatency: HTMLElement | null;

    constructor(rootDocument?: Document);

    // Binding methods
    bindEffectsUI(handlers: MamboViewHandlers): void;
    bindInstrumentUI(handlers: MamboViewHandlers): void;
    bindTransportUI(handlers: MamboViewHandlers): void;
    bindAiJamUI(handlers: MamboViewHandlers): void;
    bindDeviceSelectUI(handlers: MamboViewHandlers): void;
    bindSettingsUI(handlers: MamboViewHandlers): void;
    bindHelpUI(handlers: MamboViewHandlers): void;

    // Rendering methods
    renderEffects(synthState: AppState['synth']): void;
    renderTransport(statusState: AppState['status'], synthState: AppState['synth']): void;
    renderInstrument(synthState: AppState['synth']): void;
    renderAiJam(aiState: AiJamState): void;
    renderDeviceSelects(deviceState: DeviceState): void;
    renderDeviceRefreshState(isRefreshing: boolean): void;
    renderSettingsModal(isOpen: boolean): void;
    renderStatusMessage(text: string, options?: StatusMessageOptions): (() => void) | null;
    renderWarning(messages: string[] | string, show?: boolean): void;
    renderDeviceHelper(inputLabel: string, outputLabel: string): void;
    renderHelp(isOpen: boolean): void;
    renderAutoTuneControls(enabled: boolean): void;
    renderSegmentedControl(container: HTMLElement, selectedValue: string | number): void;
    renderVisualizerMetrics(metricsData: Partial<VisualizerMetrics>): void;
    renderRecordingHelper(message: string): void;

    // Helper methods
    toggleHelp(): boolean;
    getSelectedDeviceLabel(type: 'input' | 'output'): string;
    syncSelectValue(selectEl: HTMLSelectElement, deviceId: string, fallbackLabel?: string): void;
    findDeviceIdByLabel(selectEl: HTMLSelectElement, label: string): string | null;
    getStatusText(): string;
}
