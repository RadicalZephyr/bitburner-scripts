import type { NS } from '@ns';

import type { LaunchClient } from 'services/client/launch';
import type { MemoryClient, FreeChunk } from 'services/client/memory';

import { assertEl } from 'util/assertEl';
import { useTheme } from 'util/hooks';

import {
    scanTokens,
    tokenize,
    type TokenSpan,
    type TokenizeErr,
} from 'services/terminal/tokenizer';
import type { ResolveErr, ScriptResolver } from 'services/terminal/resolver';
import {
    directoryExists,
    listImmediateChildren,
    normalizePath,
    splitDirBase,
    type PathChild,
} from 'services/terminal/vfs';

import { React } from 'lib/react';

const MAX_LINES = 1000;
const HISTORY_LIMIT = 100;
const SCROLL_THRESHOLD = 8;
const STYLE_ID = 'CustomTerminalStyles';
const DOUBLE_TAB_MS = 500;
const SCRIPT_INDEX_TTL = 5000;
const SCRIPT_EXTENSIONS = ['.js', '.ns'];

const BUILTIN_NAMES = ['clear', 'help', 'ls', 'cd', 'mem', 'free', 'rehash'] as const;
const PATH_COMMANDS = new Set(['ls', 'cd', 'mem']);
const FILE_ONLY_COMMANDS = new Set(['mem']);

type OutputKind = 'echo' | 'info' | 'warn' | 'error';

interface OutputLine {
    id: string;
    kind: OutputKind;
    text: string;
    ts: number;
}

interface SelectionRequest {
    start: number;
    end: number;
    version: number;
}

interface CompletionRequest {
    value: string;
    selectionStart: number;
    selectionEnd: number;
}

interface CompletionState {
    lastKeyWasTab: boolean;
    lastTabTs: number;
    lastInputSnapshot: string;
    scriptIndex: string[] | null;
    scriptIndexTs: number;
}

type BuiltinHandler = (
    argv: string[],
    context: BuiltinContext,
) => Promise<void> | void;

interface BuiltinContext {
    ns: NS;
    cwd: string;
    setCwd: (cwd: string) => void;
    appendLine: (kind: OutputKind, text: string) => void;
    appendLines: (kind: OutputKind, text: string) => void;
    clearOutput: () => void;
    resolveScript: ScriptResolver;
    memoryClient: MemoryClient;
    ensureScriptIndex: (force?: boolean) => Promise<string[]>;
}

const BUILTINS: Record<(typeof BUILTIN_NAMES)[number], BuiltinHandler> = {
    clear: (_, ctx) => ctx.clearOutput(),
    help: (_, ctx) => ctx.appendLines('info', helpText()),
    ls: lsBuiltin,
    cd: cdBuiltin,
    mem: memBuiltin,
    free: freeBuiltin,
    rehash: rehashBuiltin,
};

export interface TerminalAppProps {
    ns: NS;
    launcher: LaunchClient;
    resolveScript: ScriptResolver;
    memoryClient: MemoryClient;
}

/**
 * Interactive terminal UI rendered inside a tail window.
 *
 * @param ns - Netscript API instance.
 * @param launcher - Launch client used to run scripts.
 * @param resolveScript - Function that resolves script identifiers to files.
 * @param memoryClient - Memory client used to fetch free RAM summaries.
 * @returns The terminal React component tree.
 */
export function TerminalApp({
    ns,
    launcher,
    resolveScript,
    memoryClient,
}: TerminalAppProps) {
    const theme = useTheme(ns, 500);
    const [lines, setLines] = React.useState<OutputLine[]>([]);
    const [input, setInput] = React.useState('');
    const [history, setHistory] = React.useState<string[]>([]);
    const [historyIndex, setHistoryIndex] = React.useState<number | null>(null);
    const [cwd, setCwd] = React.useState('/');
    const [completion, setCompletion] = React.useState<CompletionState>({
        lastKeyWasTab: false,
        lastTabTs: 0,
        lastInputSnapshot: '',
        scriptIndex: null,
        scriptIndexTs: 0,
    });
    const [selectionRequest, setSelectionRequest] = React.useState<SelectionRequest | null>(null);

    const idRef = React.useRef(0);
    const draftRef = React.useRef('');
    const outputRef = React.useRef<HTMLDivElement | null>(null);
    const autoScrollRef = React.useRef(true);
    const selectionVersionRef = React.useRef(0);

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

    const setInputValue = React.useCallback((value: string) => {
        setInput(value);
        setCompletion((prev) => ({
            ...prev,
            lastKeyWasTab: false,
        }));
    }, []);

    const requestSelection = React.useCallback((start: number, end: number) => {
        selectionVersionRef.current += 1;
        setSelectionRequest({ start, end, version: selectionVersionRef.current });
    }, []);

    const ensureScriptIndex = React.useCallback(
        async (force = false) => {
            const now = Date.now();
            if (
                !force
                && completion.scriptIndex
                && now - completion.scriptIndexTs <= SCRIPT_INDEX_TTL
            ) {
                return completion.scriptIndex;
            }
            const files = ns.ls('home');
            const scripts = files
                .filter((file) =>
                    SCRIPT_EXTENSIONS.some((ext) => file.endsWith(ext)),
                )
                .map(toAbsolutePath);
            setCompletion((prev) => ({
                ...prev,
                scriptIndex: scripts,
                scriptIndexTs: now,
            }));
            return scripts;
        },
        [completion.scriptIndex, completion.scriptIndexTs, ns],
    );

    const handleNonTabKey = React.useCallback(() => {
        setCompletion((prev) => ({
            ...prev,
            lastKeyWasTab: false,
        }));
    }, []);

    const handleCommand = React.useCallback(async () => {
        const raw = input;
        if (raw === '') {
            return;
        }

        appendLine('echo', `$ ${raw}`);
        pushHistory(raw);
        resetHistoryState();
        setInputValue('');

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

        const builtin = BUILTINS[command as (typeof BUILTIN_NAMES)[number]];
        if (builtin) {
            await builtin(args, {
                ns,
                cwd,
                setCwd,
                appendLine,
                appendLines,
                clearOutput,
                resolveScript,
                memoryClient,
                ensureScriptIndex,
            });
            return;
        }

        const resolved = resolveScript(cwd, command);
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
                appendLine('error', `failed to launch ${resolved.absPath}`);
                return;
            }
            const pidSummary = summarizePids(response.pids);
            appendLine(
                'info',
                pidSummary
                    ? `launched ${resolved.absPath} ${pidSummary}`
                    : `launched ${resolved.absPath}`,
            );
        } catch (err) {
            appendLine(
                'error',
                `failed to launch ${resolved.absPath}: ${formatError(err)}`,
            );
        }
    }, [
        appendLine,
        appendLines,
        clearOutput,
        cwd,
        ensureScriptIndex,
        input,
        launcher,
        memoryClient,
        ns,
        pushHistory,
        resolveScript,
        resetHistoryState,
        setCwd,
        setInputValue,
    ]);

    const historyPrev = React.useCallback(() => {
        if (history.length === 0) {
            return;
        }
        setHistoryIndex((index) => {
            if (index == null) {
                draftRef.current = input;
                setInputValue(history[0]);
                return 0;
            }
            if (index >= history.length - 1) {
                return index;
            }
            const nextIndex = index + 1;
            setInputValue(history[nextIndex]);
            return nextIndex;
        });
    }, [history, input, setInputValue]);

    const historyNext = React.useCallback(() => {
        setHistoryIndex((index) => {
            if (index == null) {
                return index;
            }
            if (index === 0) {
                setInputValue(draftRef.current);
                draftRef.current = '';
                return null;
            }
            const nextIndex = index - 1;
            setInputValue(history[nextIndex]);
            return nextIndex;
        });
    }, [history, setInputValue]);

    const historyReset = React.useCallback(() => {
        if (historyIndex == null) {
            setInputValue('');
            return;
        }
        setInputValue(history[historyIndex]);
    }, [history, historyIndex, setInputValue]);

    const handleInputChange = React.useCallback(
        (value: string) => {
            setInputValue(value);
        },
        [setInputValue],
    );

    const handleTabComplete = React.useCallback(
        async ({ value, selectionStart, selectionEnd }: CompletionRequest) => {
            const now = Date.now();
            const cursor = selectionEnd;
            const scan = scanTokens(value, {
                stopAt: cursor,
                allowIncomplete: true,
            });
            if (!scan.ok) {
                setCompletion((prev) => ({
                    ...prev,
                    lastKeyWasTab: true,
                    lastTabTs: now,
                    lastInputSnapshot: value,
                }));
                return;
            }

            const tokens = scan.tokens;
            const collapsed = selectionStart === selectionEnd;
            const lastToken = tokens[tokens.length - 1];
            const editingCurrent =
                collapsed && lastToken && lastToken.tokenEnd === cursor;
            const precedingTokens = editingCurrent
                ? tokens.slice(0, -1).map((token) => token.value)
                : tokens.map((token) => token.value);
            const currentToken: TokenSpan | null = editingCurrent
                ? lastToken
                : null;
            const tokenIndex = precedingTokens.length;
            const typedValue = currentToken ? currentToken.value : '';

            const doubleTab =
                completion.lastKeyWasTab
                && now - completion.lastTabTs <= DOUBLE_TAB_MS
                && completion.lastInputSnapshot === value
                && collapsed;

            let matches: string[] = [];
            let listing: string[] = [];
            let prefix = '';
            let base = typedValue;

            if (tokenIndex === 0) {
                const isPathLike =
                    typedValue.includes('/')
                    || typedValue.startsWith('.')
                    || typedValue.startsWith('~');
                const scripts = await ensureScriptIndex();
                const pathResult = computePathMatches(
                    typedValue,
                    cwd,
                    scripts,
                );
                prefix = pathResult.prefix;
                base = pathResult.base;
                const pathMatches = pathResult.matches.map((entry) => entry.name);
                if (isPathLike) {
                    matches = pathMatches;
                } else {
                    const builtinMatches = BUILTIN_NAMES.filter((name) =>
                        name.startsWith(typedValue),
                    );
                    matches = [...builtinMatches, ...pathMatches];
                }
                listing = matches;
            } else {
                const command = precedingTokens[0] ?? '';
                if (PATH_COMMANDS.has(command)) {
                    const scripts = await ensureScriptIndex();
                    const pathResult = computePathMatches(
                        typedValue,
                        cwd,
                        scripts,
                    );
                    prefix = pathResult.prefix;
                    base = pathResult.base;
                    matches = pathResult.matches
                        .filter((entry) =>
                            !FILE_ONLY_COMMANDS.has(command)
                            || entry.kind === 'file',
                        )
                        .map((entry) => entry.name);
                    listing = matches;
                }
            }

            if (matches.length === 0) {
                setCompletion((prev) => ({
                    ...prev,
                    lastKeyWasTab: true,
                    lastTabTs: now,
                    lastInputSnapshot: value,
                }));
                return;
            }

            let insertText: string | null = null;
            if (matches.length === 1) {
                insertText = matches[0];
            } else {
                const lcp = longestCommonPrefix(matches);
                if (lcp.length > base.length) {
                    insertText = lcp;
                } else if (doubleTab) {
                    appendLine('info', formatCandidateList(listing));
                    setCompletion((prev) => ({
                        ...prev,
                        lastKeyWasTab: true,
                        lastTabTs: now,
                        lastInputSnapshot: value,
                    }));
                    return;
                }
            }

            if (insertText == null) {
                setCompletion((prev) => ({
                    ...prev,
                    lastKeyWasTab: true,
                    lastTabTs: now,
                    lastInputSnapshot: value,
                }));
                return;
            }

            const newTokenValue = `${prefix}${insertText}`;
            let formatted = formatTokenForInsertion(
                newTokenValue,
                currentToken?.quote ?? null,
            );
            let tokenStart = currentToken
                ? currentToken.tokenStart
                : selectionStart;
            if (currentToken?.quote) {
                tokenStart = currentToken.contentStart;
                formatted = escapeForQuote(newTokenValue, currentToken.quote);
            }
            const before = value.slice(0, tokenStart);
            const after = value.slice(selectionEnd);
            const newValue = `${before}${formatted}${after}`;
            const newCursor = before.length + formatted.length;

            setInput(newValue);
            requestSelection(newCursor, newCursor);
            setCompletion((prev) => ({
                ...prev,
                lastKeyWasTab: true,
                lastTabTs: now,
                lastInputSnapshot: newValue,
            }));
        },
        [
            appendLine,
            completion.lastInputSnapshot,
            completion.lastKeyWasTab,
            completion.lastTabTs,
            cwd,
            ensureScriptIndex,
            requestSelection,
            setCompletion,
            setInput,
        ],
    );

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
                onTabComplete={handleTabComplete}
                onNonTabKey={handleNonTabKey}
                selectionRequest={selectionRequest}
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
    onTabComplete: (request: CompletionRequest) => void;
    onNonTabKey: () => void;
    selectionRequest: SelectionRequest | null;
}

function InputLine({
    value,
    onChange,
    onSubmit,
    onHistoryPrev,
    onHistoryNext,
    onHistoryReset,
    onClear,
    onTabComplete,
    onNonTabKey,
    selectionRequest,
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

    React.useEffect(() => {
        if (!selectionRequest) {
            return;
        }
        setSelection(selectionRequest.start, selectionRequest.end);
    }, [selectionRequest, setSelection]);

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
            if (event.key === 'Tab') {
                event.preventDefault();
                onTabComplete({
                    value: el.value,
                    selectionStart: el.selectionStart ?? el.value.length,
                    selectionEnd: el.selectionEnd ?? el.value.length,
                });
                return;
            }

            onNonTabKey();

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
            onNonTabKey,
            onTabComplete,
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

function computePathMatches(
    tokenValue: string,
    cwd: string,
    paths: string[],
): { prefix: string; base: string; matches: PathChild[] } {
    const normalizedInput = tokenValue === '' ? '.' : tokenValue;
    const absPath = normalizePath(normalizedInput, cwd);
    const { dir, base } = splitDirBase(absPath);
    const listing = listImmediateChildren(paths, dir);
    const slashIndex = tokenValue.lastIndexOf('/');
    const prefix = slashIndex >= 0 ? tokenValue.slice(0, slashIndex + 1) : '';
    const localBase = slashIndex >= 0 ? tokenValue.slice(slashIndex + 1) : tokenValue;
    const matches = listing.entries.filter((entry) => entry.name.startsWith(base));
    return { prefix, base: localBase, matches };
}

function formatCandidateList(candidates: string[]): string {
    return candidates.join('  ');
}

function formatTokenForInsertion(value: string, quote: '"' | "'" | null): string {
    if (quote === '"' || quote === "'") {
        return `${quote}${escapeForQuote(value, quote)}${quote}`;
    }
    if (/\s/.test(value)) {
        return `"${escapeForQuote(value, '"')}"`;
    }
    return escapeUnquoted(value);
}

function escapeForQuote(value: string, quote: '"' | "'"): string {
    const escapeChar = quote === '"' ? '"' : "'";
    return value.replace(/\\/g, '\\\\').replace(
        new RegExp(`[${escapeChar}]`, 'g'),
        (match) => `\\${match}`,
    );
}

function escapeUnquoted(value: string): string {
    return value.replace(/[\\\s"']/g, (match) => `\\${match}`);
}

function longestCommonPrefix(items: string[]): string {
    if (items.length === 0) {
        return '';
    }
    let prefix = items[0];
    for (let i = 1; i < items.length; i += 1) {
        let j = 0;
        while (j < prefix.length && j < items[i].length) {
            if (prefix[j] !== items[i][j]) {
                break;
            }
            j += 1;
        }
        prefix = prefix.slice(0, j);
        if (prefix === '') {
            break;
        }
    }
    return prefix;
}

async function lsBuiltin(argv: string[], ctx: BuiltinContext) {
    const targetInput = argv[0] ?? '.';
    const target = normalizePath(targetInput, ctx.cwd);
    const files = ctx.ns.ls('home').map(toAbsolutePath);
    const listing = listImmediateChildren(files, target);
    if (!listing.exists) {
        ctx.appendLine('error', `no such file or directory: ${target}`);
        return;
    }
    if (listing.entries.length === 0) {
        ctx.appendLine('info', 'empty');
        return;
    }
    ctx.appendLine(
        'info',
        listing.entries.map((entry) => entry.name).join('  '),
    );
}

async function cdBuiltin(argv: string[], ctx: BuiltinContext) {
    const targetInput = argv[0] ?? '/';
    const target = normalizePath(targetInput, ctx.cwd);
    const files = ctx.ns.ls('home').map(toAbsolutePath);
    if (!directoryExists(files, target)) {
        ctx.appendLine('error', `no such directory: ${target}`);
        return;
    }
    ctx.setCwd(target);
    ctx.appendLine('info', `cwd: ${target}`);
}

async function memBuiltin(argv: string[], ctx: BuiltinContext) {
    if (argv.length !== 1) {
        ctx.appendLine('error', 'usage: mem <script>');
        return;
    }
    const resolved = ctx.resolveScript(ctx.cwd, argv[0]);
    if (!resolved.ok) {
        const err = resolved as ResolveErr;
        ctx.appendLines('error', err.message);
        return;
    }
    const ram = ctx.ns.getScriptRam(resolved.script, 'home');
    if (!ram || Number.isNaN(ram)) {
        ctx.appendLine('error', `cannot determine RAM for ${resolved.absPath}`);
        return;
    }
    ctx.appendLine('info', `${resolved.absPath}: ${ctx.ns.formatRam(ram)}`);
}

async function freeBuiltin(_: string[], ctx: BuiltinContext) {
    const free = await ctx.memoryClient.getFreeRam();
    const rows = [...free.chunks].sort((a, b) => b.freeRam - a.freeRam);
    if (rows.length === 0) {
        ctx.appendLine('info', 'no workers reported');
        return;
    }
    const lines = formatFreeTable(ctx.ns, rows);
    lines.forEach((line) => ctx.appendLine('info', line));
    ctx.appendLine(
        'info',
        `sum: ${ctx.ns.formatRam(free.freeRam)} free on ${rows.length} hosts`,
    );
}

async function rehashBuiltin(_: string[], ctx: BuiltinContext) {
    await ctx.ensureScriptIndex(true);
    ctx.appendLine('info', 'script index refreshed');
}

function formatFreeTable(ns: NS, rows: FreeChunk[]): string[] {
    const hostWidth = Math.max(4, ...rows.map((row) => row.hostname.length));
    const freeStrings = rows.map((row) => ns.formatRam(row.freeRam));
    const totals = rows.map((row) => {
        const total = (row as { totalRam?: number }).totalRam;
        if (typeof total === 'number') {
            return total;
        }
        return ns.getServerMaxRam(row.hostname);
    });
    const totalStrings = totals.map((total) => ns.formatRam(total));
    const freeWidth = Math.max(4, ...freeStrings.map((item) => item.length));
    const totalWidth = Math.max(5, ...totalStrings.map((item) => item.length));
    const header = `${padRight('HOST', hostWidth)}  ${padLeft('FREE', freeWidth)}  ${padLeft('TOTAL', totalWidth)}  UTIL%`;
    const lines = [header];
    rows.forEach((row, index) => {
        const freeText = padLeft(freeStrings[index], freeWidth);
        const totalText = padLeft(totalStrings[index], totalWidth);
        const totalRam = totals[index];
        const util = totalRam > 0 ? 1 - row.freeRam / totalRam : 0;
        const utilText = padLeft(ns.formatPercent(util), 7);
        lines.push(
            `${padRight(row.hostname, hostWidth)}  ${freeText}  ${totalText}  ${utilText}`,
        );
    });
    return lines;
}

function padRight(value: string, width: number): string {
    if (value.length >= width) {
        return value;
    }
    return value + ' '.repeat(width - value.length);
}

function padLeft(value: string, width: number): string {
    if (value.length >= width) {
        return value;
    }
    return ' '.repeat(width - value.length) + value;
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
        '  clear   Clear all output',
        '  help    Show this message',
        '  ls      List files in the current or provided directory',
        '  cd      Change the current working directory',
        '  mem     Show static RAM usage for a script',
        '  free    Display free RAM by host',
        '  rehash  Refresh the script autocomplete index',
        '',
        'Paths:',
        '  - / is the root directory; ~ is an alias for /.',
        '  - .. moves to the parent directory; . keeps the current directory.',
        '',
        'Completion:',
        '  - Press TAB to complete commands and paths.',
        '  - Press TAB twice quickly to list candidates.',
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

function toAbsolutePath(path: string): string {
    return path.startsWith('/') ? path : `/${path}`;
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
