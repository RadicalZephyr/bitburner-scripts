import { NS } from 'netscript';

import { useTheme } from 'util/hooks';
import { RingBuffer } from 'util/ring-buffer';

export interface LogDisplayProps {
    ns: NS;
    lines: RingBuffer<string>;
}

/**
 * Show recent log lines in a styled list.
 *
 * @param lines - Log messages to display.
 * @param theme - The UI theme.
 */
export function LogDisplay({ ns, lines: extLines }: LogDisplayProps) {
    const [lines, setLines] = React.useState(Array.from(extLines.values()));
    const theme = useTheme(ns, 1000);

    React.useEffect(() => {
        const id = globalThis.setInterval(() => {
            setLines(Array.from(extLines.values()));
        }, 1000);
        return () => {
            globalThis.clearInterval(id);
        };
    }, [ns, extLines]);

    const rowStyle = (idx: number) =>
        idx % 2 === 1 ? { backgroundColor: theme.well } : {};

    const lineColor = (line: string): string | undefined => {
        if (line.startsWith('ERROR:')) return theme.error;
        if (line.startsWith('SUCCESS:')) return theme.success;
        if (line.startsWith('WARN:')) return theme.warning;
        if (line.startsWith('INFO:')) return theme.info;
        return theme.success;
    };

    return (
        <div style={{ fontFamily: 'monospace' }}>
            {lines.map((line, idx) => {
                const style = { ...rowStyle(idx), color: lineColor(line) };
                return (
                    <div key={idx} style={style}>
                        {line}
                    </div>
                );
            })}
        </div>
    );
}
