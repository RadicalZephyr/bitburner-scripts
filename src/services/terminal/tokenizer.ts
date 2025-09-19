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

type Mode = 'normal' | 'single' | 'double';

/**
 * Split a terminal command into whitespace separated tokens while honoring quotes
 * and backslash escapes.
 *
 * @param input - Raw command line text.
 * @returns A structured result containing the parsed tokens or an error message
 *          with the index where parsing failed.
 */
export function tokenize(input: string): TokenizeResult {
    const tokens: string[] = [];
    let current = '';
    let tokenStarted = false;
    let mode: Mode = 'normal';
    let quoteStart = -1;

    const pushToken = () => {
        tokens.push(current);
        current = '';
        tokenStarted = false;
    };

    for (let i = 0; i < input.length; i += 1) {
        const ch = input[i];

        if (mode === 'normal') {
            if (ch === '\\') {
                if (i + 1 < input.length) {
                    current += input[i + 1];
                    tokenStarted = true;
                    i += 1;
                    continue;
                }
                current += '\\';
                tokenStarted = true;
                continue;
            }
            if (ch === '"') {
                mode = 'double';
                quoteStart = i;
                tokenStarted = true;
                continue;
            }
            if (ch === "'") {
                mode = 'single';
                quoteStart = i;
                tokenStarted = true;
                continue;
            }
            if (ch === ' ' || ch === '\t') {
                if (tokenStarted) {
                    pushToken();
                }
                continue;
            }
            current += ch;
            tokenStarted = true;
            continue;
        }

        if (ch === '\\') {
            if (i + 1 < input.length) {
                current += input[i + 1];
                i += 1;
            } else {
                current += '\\';
            }
            continue;
        }

        if (
            (mode === 'double' && ch === '"')
            || (mode === 'single' && ch === "'")
        ) {
            mode = 'normal';
            quoteStart = -1;
            continue;
        }

        current += ch;
    }

    if (mode !== 'normal') {
        return {
            ok: false,
            message: `unterminated ${mode === 'double' ? 'double' : 'single'} quote`,
            index: quoteStart >= 0 ? quoteStart : input.length,
        };
    }

    if (tokenStarted || current !== '') {
        pushToken();
    }

    return { ok: true, tokens };
}
