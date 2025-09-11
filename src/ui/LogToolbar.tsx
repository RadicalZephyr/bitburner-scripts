import { NS } from 'netscript';

import { assertEl } from 'util/assertEl';
import { useTheme } from 'util/hooks';

export type LogMode = 'custom' | 'logs' | 'split';

interface LogToolbarProps {
    ns: NS;
    mode: LogMode;
    onChange: (mode: LogMode) => void;
}

const styleId = 'LogToolbarStyles';

export const LogToolbar: React.FC<LogToolbarProps> = ({
    ns,
    mode,
    onChange,
}) => {
    const theme = useTheme(ns);
    const [expanded, setExpanded] = React.useState(false);

    React.useEffect(() => {
        if (!globalThis[styleId]) {
            const styleEl = globalThis['document'].createElement('style');
            styleEl.id = styleId;
            styleEl.textContent = makeCss(theme);
            const rootEl = assertEl(
                globalThis['root'],
                'No root element found!',
            );
            rootEl.parentElement.appendChild(styleEl);
        }
        globalThis[styleId].textContent = makeCss(theme);
    }, [theme]);

    return (
        <div
            className="lur-toolbar"
            style={{ top: 8, right: 8, position: 'absolute' }}
        >
            <div
                className="lur-bar"
                style={{
                    display: 'grid',
                    gridAutoFlow: 'column',
                    alignItems: 'center',
                    gap: 6,
                    background: theme.backgroundsecondary,
                    border: `1px solid ${theme.primarydark}`,
                    padding: '4px 6px',
                    width: expanded ? 230 : 28,
                    overflow: 'hidden',
                    transition:
                        'width .16s ease-out, border-color .16s ease-out',
                }}
            >
                <button
                    className="btn hamburger"
                    aria-label="Toggle toolbar"
                    onClick={() => setExpanded((e) => !e)}
                    style={buttonStyle(theme, true)}
                >
                    <svg
                        viewBox="0 0 24 24"
                        fill="currentColor"
                        width={18}
                        height={18}
                    >
                        <path d="M4 6h16v2H4zM8 11h12v2H8zM12 16h8v2h-8z" />
                    </svg>
                </button>
                {expanded && (
                    <span
                        className="lur-group"
                        style={{ display: 'inline-flex', gap: 6 }}
                    >
                        <button
                            className="btn"
                            aria-pressed={mode === 'logs'}
                            onClick={() => onChange('logs')}
                            style={buttonStyle(theme, mode === 'logs')}
                        >
                            <svg
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                width={18}
                                height={18}
                            >
                                <path d="M6 3h9a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H8a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3zm0 2a1 1 0 0 0-1 1v12c0 .552.448 1 1 1h7a1 1 0 0 0 1-1V6c0-.552-.448-1-1-1H6zm3 4h5v2H9V9zm0 4h5v2H9v-2z" />
                            </svg>
                        </button>
                        <button
                            className="btn"
                            aria-pressed={mode === 'custom'}
                            onClick={() => onChange('custom')}
                            style={buttonStyle(theme, mode === 'custom')}
                        >
                            <svg
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                width={18}
                                height={18}
                            >
                                <path d="M12 3a9 9 0 0 0 0 18h2.5a2.5 2.5 0 0 0 0-5H14a1 1 0 1 1 0-2h1.5A4.5 4.5 0 1 1 16.5 22H12a11 11 0 1 1 11-11 3 3 0 0 1-3 3h-1a1 1 0 0 1 0-2h1a1 1 0 0 0 1-1 9 9 0 0 0-9-9zM7.5 9.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm4-2a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm4 2a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z" />
                            </svg>
                        </button>
                        <button
                            className="btn"
                            aria-pressed={mode === 'split'}
                            onClick={() => onChange('split')}
                            style={buttonStyle(theme, mode === 'split')}
                        >
                            <svg
                                viewBox="0 0 24 24"
                                fill="currentColor"
                                width={18}
                                height={18}
                            >
                                <path d="M4 4h7v16H4zM13 4h7v16h-7z" />
                            </svg>
                        </button>
                    </span>
                )}
            </div>
        </div>
    );
};

function makeCss(theme: ReturnType<typeof useTheme>): string {
    return `
    .lur-toolbar .btn {
      display:inline-flex;
      align-items:center;
      justify-content:center;
      width:26px;
      height:26px;
      cursor:pointer;
      border:1px solid transparent;
      background:transparent;
      color:${theme.secondarydark};
    }
    .lur-toolbar .btn:hover {
      color:${theme.white};
      border-color:${theme.primarydark};
      background:${theme.backgroundprimary};
    }
    .lur-toolbar .btn[aria-pressed="true"] {
      color:${theme.success};
      border-color:${theme.successdark};
      background:${theme.backgroundprimary};
    }
  `;
}

function buttonStyle(
    theme: ReturnType<typeof useTheme>,
    active: boolean,
): React.CSSProperties {
    return {
        border: '1px solid transparent',
        background: active ? theme.backgroundprimary : 'transparent',
        color: active ? theme.success : theme.secondary,
        width: 26,
        height: 26,
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
    };
}
