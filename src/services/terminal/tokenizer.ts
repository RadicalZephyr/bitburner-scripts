/**
 * Result produced by {@link tokenize} when parsing succeeds.
 */
export interface TokenizeOk {
    ok: true;
    tokens: string[];
}

/**
 * Result produced by {@link tokenize} when parsing fails.
 */
export interface TokenizeErr {
    ok: false;
    message: string;
    index: number;
}

export type TokenizeResult = TokenizeOk | TokenizeErr;

export type Mode = 'normal' | 'single' | 'double';

/**
 * Metadata describing a parsed token within the raw input string.
 */
export interface TokenSpan {
    /**
     * Parsed token value after processing escapes and quotes.
     */
    value: string;
    /**
     * Index where the token begins in the raw string (including any opening quote).
     */
    tokenStart: number;
    /**
     * Index immediately after the last token character in the raw string.
     */
    tokenEnd: number;
    /**
     * Index where the token content starts (excludes an opening quote when present).
     */
    contentStart: number;
    /**
     * Index immediately after the last content character.
     */
    contentEnd: number;
    /**
     * Quote character used to open the token or null when unquoted.
     */
    quote: '"' | "'" | null;
}

export interface ScanOptions {
    /**
     * Allow unterminated quotes without producing an error.
     */
    allowIncomplete?: boolean;
    /**
     * Stop parsing once this index is reached.
     */
    stopAt?: number;
}

export interface ScanOk {
    ok: true;
    tokens: TokenSpan[];
}

export type ScanResult = ScanOk | TokenizeErr;

/**
 * Parse the input string and produce token metadata.
 *
 * @param input - Raw command line text.
 * @param options - Optional parser configuration.
 * @returns Parsed tokens or an error with failure metadata.
 */
export function scanTokens(input: string, options: ScanOptions = {}): ScanResult {
    const limit = options.stopAt ?? input.length;
    const tokens: TokenSpan[] = [];

    let tokenStart = -1;
    let contentStart = -1;
    let contentEnd = -1;
    let current = '';
    let mode: Mode = 'normal';
    let quote: '"' | "'" | null = null;
    let quoteStart = -1;

    const flushToken = (end: number) => {
        if (tokenStart === -1) {
            return;
        }
        const span: TokenSpan = {
            value: current,
            tokenStart,
            tokenEnd: end,
            contentStart,
            contentEnd: Math.max(contentStart, contentEnd),
            quote,
        };
        tokens.push(span);
        tokenStart = -1;
        contentStart = -1;
        contentEnd = -1;
        current = '';
        quote = null;
        quoteStart = -1;
    };

    let i = 0;
    while (i < limit) {
        const ch = input[i];

        if (mode === 'normal' && tokenStart === -1) {
            if (ch === ' ' || ch === '\t') {
                i += 1;
                continue;
            }
            tokenStart = i;
            if (ch === '"' || ch === "'") {
                quote = ch;
                mode = ch === '"' ? 'double' : 'single';
                quoteStart = i;
                contentStart = i + 1;
                contentEnd = contentStart;
                i += 1;
                continue;
            }
            quote = null;
            contentStart = i;
            contentEnd = contentStart;
        }

        if (mode === 'normal') {
            if (ch === '\\') {
                if (i + 1 < limit) {
                    current += input[i + 1];
                    contentEnd = i + 2;
                    i += 2;
                } else {
                    current += '\\';
                    contentEnd = i + 1;
                    i += 1;
                }
                continue;
            }
            if (ch === '"' || ch === "'") {
                mode = ch === '"' ? 'double' : 'single';
                if (quote == null) {
                    quote = ch;
                    quoteStart = i;
                }
                i += 1;
                continue;
            }
            if (ch === ' ' || ch === '\t') {
                flushToken(i);
                i += 1;
                continue;
            }
            current += ch;
            contentEnd = i + 1;
            i += 1;
            continue;
        }

        if (ch === '\\') {
            if (i + 1 < limit) {
                current += input[i + 1];
                contentEnd = i + 2;
                i += 2;
            } else {
                current += '\\';
                contentEnd = i + 1;
                i += 1;
            }
            continue;
        }

        if ((mode === 'double' && ch === '"') || (mode === 'single' && ch === "'")) {
            mode = 'normal';
            i += 1;
            continue;
        }

        current += ch;
        contentEnd = i + 1;
        i += 1;
    }

    if (mode !== 'normal' && !options.allowIncomplete) {
        return {
            ok: false,
            message: `unterminated ${mode === 'double' ? 'double' : 'single'} quote`,
            index: quoteStart >= 0 ? quoteStart : limit,
        };
    }

    if (tokenStart !== -1) {
        flushToken(limit);
    }

    return { ok: true, tokens };
}

/**
 * Split a terminal command into whitespace separated tokens while honoring quotes
 * and backslash escapes.
 *
 * @param input - Raw command line text.
 * @returns A structured result containing the parsed tokens or an error message
 *          with the index where parsing failed.
 */
export function tokenize(input: string): TokenizeResult {
    const result = scanTokens(input);
    if (!result.ok) {
        return result as TokenizeErr;
    }
    return { ok: true, tokens: result.tokens.map((token) => token.value) };
}
