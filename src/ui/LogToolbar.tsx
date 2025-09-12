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

/**
 * View selector between custom, logs, and split modes.
 *
 * @param ns - Netscript API.
 * @param mode - Current view selection.
 * @param onChange - Handler invoked when the mode changes.
 */
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
            style={{ top: 40, right: 6, position: 'absolute' }}
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
                    width: expanded ? 140 : 28,
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
                        className="MuiSvgIcon-root MuiSvgIcon-colorSecondary MuiSvgIcon-fontSizeMedium"
                        viewBox="0 -2 32 32"
                        fill="currentColor"
                    >
                        <g
                            stroke="none"
                            strokeWidth="1"
                            fill="none"
                            fillRule="evenodd"
                        >
                            <g
                                transform="translate(-310.000000, -1039.000000)"
                                fill="currentColor"
                            >
                                <path d="M338,1049 L314,1049 C311.791,1049 310,1050.79 310,1053 C310,1055.21 311.791,1057 314,1057 L338,1057 C340.209,1057 342,1055.21 342,1053 C342,1050.79 340.209,1049 338,1049 L338,1049 Z M338,1059 L314,1059 C311.791,1059 310,1060.79 310,1063 C310,1065.21 311.791,1067 314,1067 L338,1067 C340.209,1067 342,1065.21 342,1063 C342,1060.79 340.209,1059 338,1059 L338,1059 Z M314,1047 L338,1047 C340.209,1047 342,1045.21 342,1043 C342,1040.79 340.209,1039 338,1039 L314,1039 C311.791,1039 310,1040.79 310,1043 C310,1045.21 311.791,1047 314,1047 L314,1047 Z"></path>
                            </g>
                        </g>
                    </svg>
                </button>
                {expanded && (
                    <span
                        className="lur-group"
                        style={{ display: 'inline-flex', gap: 6 }}
                    >
                        <button
                            className="btn"
                            aria-pressed={mode === 'custom'}
                            onClick={() => onChange('custom')}
                            style={buttonStyle(theme, mode === 'custom')}
                        >
                            <svg
                                className="MuiSvgIcon-root MuiSvgIcon-colorSecondary MuiSvgIcon-fontSizeMedium"
                                viewBox="0 0 32 32"
                                fill="currentColor"
                            >
                                <g
                                    stroke="none"
                                    strokeWidth="1"
                                    fill="none"
                                    fillRule="evenodd"
                                >
                                    <g
                                        transform="translate(-256.000000, -671.000000)"
                                        fill="currentColor"
                                    >
                                        <path d="M265,675 C264.448,675 264,675.448 264,676 C264,676.553 264.448,677 265,677 C265.552,677 266,676.553 266,676 C266,675.448 265.552,675 265,675 L265,675 Z M269,675 C268.448,675 268,675.448 268,676 C268,676.553 268.448,677 269,677 C269.552,677 270,676.553 270,676 C270,675.448 269.552,675 269,675 L269,675 Z M286,679 L258,679 L258,675 C258,673.896 258.896,673 260,673 L284,673 C285.104,673 286,673.896 286,675 L286,679 L286,679 Z M286,699 C286,700.104 285.104,701 284,701 L260,701 C258.896,701 258,700.104 258,699 L258,681 L286,681 L286,699 L286,699 Z M284,671 L260,671 C257.791,671 256,672.791 256,675 L256,699 C256,701.209 257.791,703 260,703 L284,703 C286.209,703 288,701.209 288,699 L288,675 C288,672.791 286.209,671 284,671 L284,671 Z M261,675 C260.448,675 260,675.448 260,676 C260,676.553 260.448,677 261,677 C261.552,677 262,676.553 262,676 C262,675.448 261.552,675 261,675 L261,675 Z"></path>
                                    </g>
                                </g>
                            </svg>
                        </button>
                        <button
                            className="btn"
                            aria-pressed={mode === 'logs'}
                            onClick={() => onChange('logs')}
                            style={buttonStyle(theme, mode === 'logs')}
                        >
                            <svg
                                className="MuiSvgIcon-root MuiSvgIcon-colorSecondary MuiSvgIcon-fontSizeMedium"
                                viewBox="0 0 32 32"
                                fill="currentColor"
                            >
                                <g
                                    stroke="none"
                                    strokeWidth="1"
                                    fill="none"
                                    fillRule="evenodd"
                                >
                                    <g
                                        transform="translate(-308.000000, -99.000000)"
                                        fill="currentColor"
                                    >
                                        <path d="M332,107 L316,107 C315.447,107 315,107.448 315,108 C315,108.553 315.447,109 316,109 L332,109 C332.553,109 333,108.553 333,108 C333,107.448 332.553,107 332,107 L332,107 Z M338,127 C338,128.099 336.914,129.012 335.817,129.012 L311.974,129.012 C310.877,129.012 309.987,128.122 309.987,127.023 L309.987,103.165 C309.987,102.066 310.902,101 312,101 L336,101 C337.098,101 338,101.902 338,103 L338,127 L338,127 Z M336,99 L312,99 C309.806,99 308,100.969 308,103.165 L308,127.023 C308,129.22 309.779,131 311.974,131 L335.817,131 C338.012,131 340,129.196 340,127 L340,103 C340,100.804 338.194,99 336,99 L336,99 Z M332,119 L316,119 C315.447,119 315,119.448 315,120 C315,120.553 315.447,121 316,121 L332,121 C332.553,121 333,120.553 333,120 C333,119.448 332.553,119 332,119 L332,119 Z M332,113 L316,113 C315.447,113 315,113.448 315,114 C315,114.553 315.447,115 316,115 L332,115 C332.553,115 333,114.553 333,114 C333,113.448 332.553,113 332,113 L332,113 Z"></path>
                                    </g>
                                </g>
                            </svg>
                        </button>
                        <button
                            className="btn"
                            aria-pressed={mode === 'split'}
                            onClick={() => onChange('split')}
                            style={buttonStyle(theme, mode === 'split')}
                        >
                            <svg
                                className="MuiSvgIcon-root MuiSvgIcon-colorSecondary MuiSvgIcon-fontSizeMedium"
                                viewBox="0 0 16 16"
                                fill="currentColor"
                            >
                                <path d="M7 1H1V15H7V1Z" fill="currentColor" />
                                <path
                                    d="M15 1H9V15H15V1Z"
                                    fill="currentColor"
                                />
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
