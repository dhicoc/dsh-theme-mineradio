/**
 * Audio reactivity — microphone → Web Audio AnalyserNode → three smoothed
 * energy envelopes (bass "low", mid/high "high", overall "volume") that drive
 * the living backdrop:
 *   - `low`  stirs the fluid (ripple amplitude + flow speed);
 *   - `high` brightens/swells the star river (perceived density);
 *   - `volume` lifts the cursor spotlight glow.
 *
 * The mic stream + AudioContext are released on stop/dispose, and the OS
 * reduced-motion preference disables the feed entirely. Capture uses the raw
 * stream's own mic gain (AGC + noise suppression off) so the envelopes track
 * real loudness instead of the browser's leveled output.
 */
/** One analysis-frame envelope, each value normalised 0..1. */
export interface AudioEnvelope {
    /** Bass energy (≈30–700 Hz) — drives fluid ripple amplitude/speed. */
    low: number;
    /** Mid/high energy (≈700 Hz–8 kHz) — drives star brightness/density. */
    high: number;
    /** Overall loudness — drives the spotlight glow lift. */
    volume: number;
}
/** Live handle returned by {@link createAudioReactivity}. */
export interface AudioReactivityHandle {
    /** Request the mic and start the analysis loop; resolves true on success. */
    start(): Promise<boolean>;
    /** Stop the loop and release the stream/context (the handle stays reusable). */
    stop(): void;
    /** Permanent teardown: stop plus a guard that blocks any later start. */
    dispose(): void;
}
/** Start the analyser loop and forward smoothed envelopes to the callback. */
export declare function createAudioReactivity(onEnvelope: (env: AudioEnvelope) => void): AudioReactivityHandle;
