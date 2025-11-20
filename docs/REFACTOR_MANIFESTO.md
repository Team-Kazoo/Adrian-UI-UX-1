# Kazoo Proto Refactoring Manifesto

**Date:** 2025-11-20
**Status:** Active

## I. Objectives

1.  **Preserve & Amplify the "Pro Audio Core"**
    *   Isolate DSP/Worklet logic.
    *   Protect the low-latency audio pipeline from UI bloat.

2.  **Refactor "Dog Shit UI" into a Maintainable Frontend**
    *   Decompose the 1800-line `main.js` monolith.
    *   Establish clear module boundaries.
    *   Make the UI testable and extensible.

3.  **Prepare for Scale & Commercialization**
    *   Architecture must support multiple instruments, presets, and features (AI, recording) without regression.
    *   Decouple Audio Engine from UI Framework (prepare for potential React/Vue migration).

## II. Development Principles (Vibe Coding Aligned)

### 1. Architecture & Modularity (SRP)
*   **Single Responsibility:**
    *   `AudioEngine`: "I give you audio, you give me pitch/features."
    *   `UI`: "I display state and capture user intent."
    *   `DeviceManager`: "I handle hardware I/O."
*   **Limits:** Alert on functions > 100 lines, files > 300 lines.
*   **Direction:** Audio Core never depends on UI. UI depends on Audio via clear Interfaces (Adapters).
*   **Replaceability:** The Audio Core should be packageable as a standalone npm library.

### 2. Coding Standards
*   **No Guessing:** All interfaces must be defined in `js/types/`. Use JSDoc/TS.
*   **Explicit State:** No hidden global mutations. Use `Actions` or `Store` updates.
*   **Clean Business Logic:** Separate "Production Logic" from "Prototype Experiments".
*   **No Interface Duplication:** Reuse existing AudioWorklet/Tone.js patterns. Do not invent parallel engines.
*   **Validation:** Critical paths (Device Selection, Start/Stop) must be verified.
*   **Documentation:** Document "Gotchas" (Browser API quirks, Sample Rate issues) immediately.

## III. Architecture Map (Target)

```mermaid
graph TD
    subgraph "UI Layer (The Shell)"
        UI_Components[Visualizer / Controls / Modals] -->|Subscribe| GlobalStore
        UI_Components -->|Dispatch| Actions
    end

    subgraph "State Layer (The Brain)"
        GlobalStore[State Store]
        Actions[Action Handlers] -->|Update| GlobalStore
        Actions -->|Command| AudioController
    end

    subgraph "Audio Layer (The Core)"
        AudioController[Audio Manager] -->|Config| AudioIO
        AudioIO[AudioIO (Worklet)] -->|Raw Audio| PitchWorklet
        PitchWorklet -->|PitchFrame| AnalysisEngine
        AnalysisEngine -->|Features| SynthEngine
        SynthEngine[Tone.js Synth] -->|Audio| Speakers
    end
```
