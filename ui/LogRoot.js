import { LogDisplay } from 'ui/LogDisplay';
import { LogToolbar } from 'ui/LogToolbar';
import { React } from 'lib/react';
/**
 * Container that toggles between a custom UI and log views.
 *
 * @param ns - Netscript API.
 * @param buffer - Log lines to display.
 * @param children - Custom content to render.
 */
export function LogRoot({ ns, buffer, children }) {
    const [mode, setMode] = React.useState('custom');
    // Corner toolbar; always visible
    return (React.createElement("div", { className: "bb-log-root" },
        React.createElement(LogToolbar, { ns: ns, mode: mode, onChange: setMode }),
        mode === 'custom' && (React.createElement("div", { className: "bb-custom-view" }, children)),
        mode === 'logs' && (React.createElement("div", { className: "bb-logs-view" },
            React.createElement(LogDisplay, { ns: ns, lines: buffer }))),
        mode === 'split' && (React.createElement(Split, { left: React.createElement("div", { className: "bb-custom-view" }, children), right: React.createElement("div", { className: "bb-logs-view" },
                React.createElement(LogDisplay, { ns: ns, lines: buffer })) }))));
}
function Split({ left, right }) {
    return (React.createElement("div", { style: { display: 'flex', gap: '1em' } },
        left,
        right));
}
