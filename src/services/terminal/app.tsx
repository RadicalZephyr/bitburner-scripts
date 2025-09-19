import type { NS } from '@ns';

import type { LaunchClient } from 'services/client/launch';

import { assertEl } from 'util/assertEl';
import { useTheme } from 'util/hooks';

import { tokenize, type TokenizeErr } from 'services/terminal/tokenizer';
import type { ResolveErr, ScriptResolver } from 'services/terminal/resolver';

import { React } from 'lib/react';

const MAX_LINES = 1000;
const HISTORY_LIMIT = 100;
const SCROLL_THRESHOLD = 8;
const STYLE_ID = 'CustomTerminalStyles';

type OutputKind = 'echo' | 'info' | 'warn' | 'error';

interface OutputLine {
    id: string;
    kind: OutputKind;
    text: string;
    ts: number;
}

export interface TerminalAppProps {
    ns: NS;
    launcher: LaunchClient;
    resolveScript: ScriptResolver;
}

/**
 * Interactive terminal UI rendered inside a tail window.
 *
 * @param ns - Netscript API instance.
 * @param launcher - Launch client used to run scripts.
 * @param resolveScript - Function that resolves script identifiers to files.
 * @returns The terminal React component tree.
 */
export function TerminalApp({ ns, launcher, resolveScript }: TerminalAppProps) {
    const theme = useTheme(ns, 500);
    const [lines, setLines] = React.useState<OutputLine[]>([]);
    const [input, setInput] = React.useState('');
    const [history, setHistory] = React.useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = React.useState<number | null>(null);

    const idRef = React.useRef(0);
    const draftRef = React.useRef('');
    const outputRef = React.useRef<HTMLDivElement | null>(null);
    const autoScrollRef = React.useRef(true);

    React.useEffect(() => {
        ensureStyles(theme);
    }, [theme]);

    React.useEffect(() => {
        if (!autoScrollRef.current) return;
        const el = outputRef.current;
        if (!el) return;
        el.scrollTop = el.scrollHeight;
    }, [lines]);

    const appendLine = React.useCallback((kind: OutputKind, text: string) => {
        setLines((prev) => {
            const nextLine: OutputLine = {
                id: `${Date.now()}-${idRef.current}`,
                kind,
                text,
                ts: Date.now(),
            };
            idRef.current += 1;
            const next = [...prev, nextLine];
            if (next.length > MAX_LINES) {
                return next.slice(next.length - MAX_LINES);
            }
            return next;
        });
    }, []);

    const appendLines = React.useCallback(
        (kind: OutputKind, text: string) => {
            text.split('\n').forEach((line) => appendLine(kind, line));
        },
        [appendLine],
    );

    const handleScroll = React.useCallback(() => {
        const el = outputRef.current;
        if (!el) return;
        const distance = el.scrollHeight - el.clientHeight - el.scrollTop;
        autoScrollRef.current = distance < SCROLL_THRESHOLD;
    }, []);

    const clearOutput = React.useCallback(() => {
        setLines([]);
        autoScrollRef.current = true;
    }, []);

    const pushHistory = React.useCallback((command: string) => {
        if (!command.trim()) return;
        setHistory((prev) => {
            if (prev[0] === command) {
                return prev;
            }
            const next = [command, ...prev];
            if (next.length > HISTORY_LIMIT) {
                return next.slice(0, HISTORY_LIMIT);
            }
            return next;
        });
    }, []);

    const resetHistoryState = React.useCallback(() => {
        setHistoryIndex(null);
        draftRef.current = '';
    }, []);

    const handleCommand = React.useCallback(async () => {
        const raw = input;
        if (raw === '') {
            return;
        }

        appendLine('echo', `$ ${raw}`);
        pushHistory(raw);
        resetHistoryState();
        setInput('');

        const result = tokenize(raw);
        if (!result.ok) {
            const err = result as TokenizeErr;
            appendLine('error', `parse error: ${err.message}`);
            appendLine('error', caretLine(err.index));
            return;
        }

        if (result.tokens.length === 0) {
            return;
        }

        const [command, ...args] = result.tokens;

        if (command === 'clear') {
            clearOutput();
            return;
        }
        if (command === 'help') {
            appendLines('info', helpText());
            return;
        }

        const resolved = resolveScript(command);
        if (!resolved.ok) {
            const err = resolved as ResolveErr;
            appendLines('error', err.message);
            return;
        }

        try {
            const response = await launcher.launch(
                resolved.script,
                { threads: 1 },
                ...args,
            );
            if (!response) {
                appendLine('error', `failed to launch ${resolved.script}`);
                return;
            }
            const pidSummary = summarizePids(response.pids);
            appendLine(
                'info',
                pidSummary
                    ? `launched ${resolved.script} ${pidSummary}`
                    : `launched ${resolved.script}`,
            );
        } catch (err) {
            appendLine(
                'error',
                `failed to launch ${resolved.script}: ${formatError(err)}`,
            );
        }
    }, [
        appendLine,
        appendLines,
        clearOutput,
        input,
        launcher,
        pushHistory,
        resolveScript,
        resetHistoryState,
    ]);

    const historyPrev = React.useCallback(() => {
        if (history.length === 0) {
            return;
        }
        setHistoryIndex((index) => {
            if (index == null) {
                draftRef.current = input;
                setInput(history[0]);
                return 0;
            }
            if (index >= history.length - 1) {
                return index;
            }
            const nextIndex = index + 1;
            setInput(history[nextIndex]);
            return nextIndex;
        });
    }, [history, input]);

    const historyNext = React.useCallback(() => {
        setHistoryIndex((index) => {
            if (index == null) {
                return index;
            }
            if (index === 0) {
                setInput(draftRef.current);
                draftRef.current = '';
                return null;
            }
            const nextIndex = index - 1;
            setInput(history[nextIndex]);
            return nextIndex;
        });
    }, [history]);

    const historyReset = React.useCallback(() => {
        if (historyIndex == null) {
            setInput('');
            return;
        }
        setInput(history[historyIndex]);
    }, [history, historyIndex]);

    const handleInputChange = React.useCallback((value: string) => {
        setInput(value);
    }, []);

    return (
        <div className="bb-terminal" style={rootStyle(theme)}>
            <OutputPane
                lines={lines}
                onScroll={handleScroll}
                outputRef={outputRef}
            />
            <InputLine
                value={input}
                onChange={handleInputChange}
                onSubmit={handleCommand}
                onHistoryPrev={historyPrev}
                onHistoryNext={historyNext}
                onHistoryReset={historyReset}
                onClear={clearOutput}
            />
        </div>
    );
}

interface OutputPaneProps {
    lines: OutputLine[];
    onScroll: () => void;
    outputRef: React.RefObject<HTMLDivElement>;
}

function OutputPane({ lines, onScroll, outputRef }: OutputPaneProps) {
    return (
        <div
            className="bb-terminal__output"
            role="log"
            aria-live="polite"
            onScroll={onScroll}
            ref={outputRef}
        >
            {lines.map((line) => (
                <div
                    key={line.id}
                    className={`bb-terminal__line bb-terminal__line--${line.kind}`}
                >
                    {line.text}
                </div>
            ))}
        </div>
    );
}

interface InputLineProps {
    value: string;
    onChange: (value: string) => void;
    onSubmit: () => void;
    onHistoryPrev: () => void;
    onHistoryNext: () => void;
    onHistoryReset: () => void;
    onClear: () => void;
}

function InputLine({
    value,
    onChange,
    onSubmit,
    onHistoryPrev,
    onHistoryNext,
    onHistoryReset,
    onClear,
}: InputLineProps) {
    const inputRef = React.useRef<HTMLInputElement | null>(null);

    React.useEffect(() => {
        inputRef.current?.focus();
    }, []);

    const setSelection = React.useCallback((start: number, end: number) => {
        const el = inputRef.current;
        if (!el) return;
        const posStart = clamp(start, 0, el.value.length);
        const posEnd = clamp(end, 0, el.value.length);
        globalThis.setTimeout(() => {
            const target = inputRef.current;
            target?.setSelectionRange(posStart, posEnd);
        }, 0);
    }, []);

    const handleSubmit = React.useCallback(() => {
        onSubmit();
        inputRef.current?.focus();
    }, [onSubmit]);

    const handleChange = React.useCallback(
        (event: React.ChangeEvent<HTMLInputElement>) => {
            onChange(event.currentTarget.value);
        },
        [onChange],
    );

    const handleKeyDown = React.useCallback(
        (event: React.KeyboardEvent<HTMLInputElement>) => {
            const el = event.currentTarget;
            if (el === inputRef.current) {
                event.stopPropagation();
            }

            if (event.key === 'Enter') {
                event.preventDefault();
                handleSubmit();
                return;
            }
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                onHistoryPrev();
                return;
            }
            if (event.key === 'ArrowDown') {
                event.preventDefault();
                onHistoryNext();
                return;
            }
            if (event.key === 'Escape') {
                event.preventDefault();
                onHistoryReset();
                return;
            }
            if (event.ctrlKey && !event.altKey && !event.metaKey) {
                switch (event.key) {
                    case 'a':
                    case 'A':
                        event.preventDefault();
                        setSelection(0, 0);
                        return;
                    case 'e':
                    case 'E':
                        event.preventDefault();
                        setSelection(el.value.length, el.value.length);
                        return;
                    case 'b':
                    case 'B': {
                        event.preventDefault();
                        const start = el.selectionStart ?? 0;
                        const pos = Math.max(0, start - 1);
                        setSelection(pos, pos);
                        return;
                    }
                    case 'f':
                    case 'F': {
                        event.preventDefault();
                        const start = el.selectionStart ?? el.value.length;
                        const pos = Math.min(el.value.length, start + 1);
                        setSelection(pos, pos);
                        return;
                    }
                    case 'k':
                    case 'K': {
                        event.preventDefault();
                        const start = el.selectionStart ?? el.value.length;
                        const end = el.selectionEnd ?? el.value.length;
                        const newValue = el.value.slice(
                            0,
                            Math.min(start, end),
                        );
                        onChange(newValue);
                        setSelection(newValue.length, newValue.length);
                        return;
                    }
                    case 'l':
                    case 'L':
                        event.preventDefault();
                        onClear();
                        return;
                    default:
                        break;
                }
            }
            if (event.altKey && !event.ctrlKey && !event.metaKey) {
                switch (event.key) {
                    case 'b':
                    case 'B': {
                        event.preventDefault();
                        const start = el.selectionStart ?? 0;
                        const pos = findWordBoundaryBackward(el.value, start);
                        setSelection(pos, pos);
                        return;
                    }
                    case 'f':
                    case 'F': {
                        event.preventDefault();
                        const start = el.selectionStart ?? 0;
                        const pos = findWordBoundaryForward(el.value, start);
                        setSelection(pos, pos);
                        return;
                    }
                    case 'Backspace': {
                        event.preventDefault();
                        const start = el.selectionStart ?? 0;
                        const end = el.selectionEnd ?? 0;
                        const segmentStart =
                            start === end
                                ? findWordBoundaryBackward(el.value, start)
                                : start;
                        const newValue =
                            el.value.slice(0, segmentStart)
                            + el.value.slice(end);
                        onChange(newValue);
                        setSelection(segmentStart, segmentStart);
                        return;
                    }
                    default:
                        break;
                }
            }
        },
        [
            handleSubmit,
            onChange,
            onClear,
            onHistoryNext,
            onHistoryPrev,
            onHistoryReset,
            setSelection,
        ],
    );

    return (
        <div className="bb-terminal__input">
            <label className="bb-terminal__label" htmlFor="bb-terminal-input">
                Command input
            </label>
            <input
                id="bb-terminal-input"
                aria-label="Command input"
                ref={inputRef}
                value={value}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                className="bb-terminal__input-field"
                autoComplete="off"
            />
        </div>
    );
}

function summarizePids(pids: number[]): string {
    if (pids.length === 0) {
        return '';
    }
    if (pids.length === 1) {
        return `(pid ${pids[0]})`;
    }
    return `(pids ${pids.join(', ')})`;
}

function formatError(err: unknown): string {
    if (err instanceof Error) {
        const base = err.message || err.name;
        return err.name && err.message ? `${err.name}: ${err.message}` : base;
    }
    return String(err);
}

function caretLine(index: number): string {
    return `${' '.repeat(Math.max(0, index + 2))}^`;
}

function helpText(): string {
    return [
        'Bitburner launch terminal',
        '',
        'Usage:',
        '  <script> [args...]',
        '',
        'Quoting rules:',
        '  - Use \'single\' or "double" quotes to include spaces.',
        '  - Use \\ to escape the next character.',
        '',
        'Built-ins:',
        '  clear  Clear all output',
        '  help   Show this message',
    ].join('\n');
}

function ensureStyles(theme: ReturnType<typeof useTheme>): void {
    const root = assertEl(globalThis['root'], 'No root element found');
    let styleEl: HTMLStyleElement = globalThis[STYLE_ID];
    if (!styleEl) {
        styleEl = globalThis['document'].createElement('style');
        styleEl.id = STYLE_ID;
        root.parentElement?.appendChild(styleEl);
        globalThis[STYLE_ID] = styleEl;
    }
    styleEl.textContent = makeCss(theme);
}

function makeCss(theme: ReturnType<typeof useTheme>): string {
    return `
    .bb-terminal {
        height: 100%;
        display: flex;
        flex-direction: column;
        font-family: monospace;
        color: ${theme.primary};
        background: ${theme.backgroundprimary};
        padding: 8px;
        box-sizing: border-box;
    }
    .bb-terminal__output {
        flex: 1;
        overflow-y: auto;
        white-space: pre-wrap;
        word-break: break-word;
        font-size: 12px;
        padding: 4px;
        border: 1px solid ${theme.primarydark};
        margin-bottom: 8px;
        background: ${theme.backgroundsecondary};
    }
    .bb-terminal__line {
        line-height: 1.4;
    }
    .bb-terminal__line--echo {
        color: ${theme.secondary};
    }
    .bb-terminal__line--info {
        color: ${theme.primary};
    }
    .bb-terminal__line--warn {
        color: ${theme.warning};
    }
    .bb-terminal__line--error {
        color: ${theme.error};
    }
    .bb-terminal__input {
        display: flex;
        flex-direction: column;
    }
    .bb-terminal__label {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        border: 0;
    }
    .bb-terminal__input-field {
        border: 1px solid ${theme.primarydark};
        background: ${theme.backgroundprimary};
        color: ${theme.primary};
        padding: 6px;
        font-family: monospace;
        font-size: 12px;
        outline: none;
    }
    .bb-terminal__input-field:focus {
        border-color: ${theme.success};
        box-shadow: 0 0 0 1px ${theme.success};
    }
    `;
}

function rootStyle(theme: ReturnType<typeof useTheme>): React.CSSProperties {
    return {
        background: theme.backgroundprimary,
        color: theme.primary,
        height: '100%',
    };
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function findWordBoundaryBackward(value: string, index: number): number {
    let pos = Math.max(0, index);
    while (pos > 0 && value[pos - 1] === ' ') {
        pos -= 1;
    }
    while (pos > 0 && value[pos - 1] !== ' ') {
        pos -= 1;
    }
    return pos;
}

function findWordBoundaryForward(value: string, index: number): number {
    let pos = Math.min(value.length, Math.max(0, index));
    while (pos < value.length && value[pos] === ' ') {
        pos += 1;
    }
    while (pos < value.length && value[pos] !== ' ') {
        pos += 1;
    }
    return pos;
}
