import type { NS } from 'netscript';
import { useTheme } from 'util/useTheme';

/** Toggle focus mode for work actions. */
export class Toggle {
    ns: NS;
    value: boolean;

    constructor(ns: NS, value: boolean) {
        this.ns = ns;
        this.value = value;
    }

    toggle() {
        this.value = !this.value;
        this.ns.singularity.setFocus(this.value);
    }
}

export interface FocusProps {
    ns: NS;
    focus: Toggle;
}

const buttonClass =
    'MuiButtonBase-root MuiButton-root MuiButton-text MuiButton-textPrimary MuiButton-sizeMedium MuiButton-textSizeMedium MuiButton-root MuiButton-text MuiButton-textPrimary MuiButton-sizeMedium MuiButton-textSizeMedium css-u8jh2y';

/**
 * Render a button for toggling focus mode.
 *
 * @param ns - Netscript API instance
 * @param focus - `Toggle` helper controlling state
 * @returns The focus toggle button
 */
export function FocusToggle({ ns, focus }: FocusProps) {
    const theme = useTheme(ns);

    return (
        <button
            className={buttonClass}
            style={{ color: theme.successlight }}
            onClick={() => focus.toggle()}
        >
            Toggle Focus
        </button>
    );
}
