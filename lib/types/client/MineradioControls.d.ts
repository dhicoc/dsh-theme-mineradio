/** One slider + number box, wired to a single value. */
export interface KnobProps {
    label: string;
    value: number;
    min: number;
    max: number;
    step: number;
    unit: string;
    onChange: (value: number) => void;
}
/** Render one knob row. */
export declare function Knob({ label, value, min, max, step, unit, onChange }: KnobProps): import("react").JSX.Element;
/** One segment of a Segmented picker. */
export interface SegmentedOption<T extends string> {
    id: T;
    label: string;
}
export interface SegmentedProps<T extends string> {
    /** Accessible name for the button group. */
    label: string;
    /** Current id, or '' when no option is selected (manual tweak). */
    value: T | '';
    options: readonly SegmentedOption<T>[];
    onSelect: (value: T) => void;
}
/** Render a two-button segmented picker. */
export declare function Segmented<T extends string>({ label, value, options, onSelect }: SegmentedProps<T>): import("react").JSX.Element;
/** A continuous rainbow strip for the fluid hue (0-360): click or drag to
 *  pick any hue, with a colour-filled thumb marking the current value. */
export interface HueStripProps {
    label: string;
    value: number;
    onChange: (hue: number) => void;
}
/** Render the fluid-hue rainbow strip. */
export declare function HueStrip({ label, value, onChange }: HueStripProps): import("react").JSX.Element;
/** Read a file, downscale to ≤1920px, and return a compact JPEG data URL. */
export declare function fileToDataUrl(file: File): Promise<string>;
