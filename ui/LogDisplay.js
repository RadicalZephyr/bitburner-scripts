import { useTheme } from 'ui/hooks';
import { React } from 'lib/react';
/**
 * Show recent log lines in a styled list.
 *
 * @param ns - Netscript API.
 * @param lines - Log messages to display.
 */
export function LogDisplay({ ns, lines: extLines }) {
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
    const rowStyle = (idx) => idx % 2 === 1 ? { backgroundColor: theme.well } : {};
    const lineColor = (line) => {
        if (line.startsWith('ERROR:'))
            return theme.error;
        if (line.startsWith('SUCCESS:'))
            return theme.success;
        if (line.startsWith('WARN:'))
            return theme.warning;
        if (line.startsWith('INFO:'))
            return theme.info;
        return theme.success;
    };
    return (React.createElement("div", { style: { fontFamily: 'monospace' } }, lines.map((line, idx) => {
        const style = { ...rowStyle(idx), color: lineColor(line) };
        return (React.createElement("div", { key: idx, style: style }, line));
    })));
}
