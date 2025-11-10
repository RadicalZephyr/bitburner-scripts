/**
 * Parse the input string and produce token metadata.
 *
 * @param input - Raw command line text.
 * @param options - Optional parser configuration.
 * @returns Parsed tokens or an error with failure metadata.
 */
export function scanTokens(input, options = {}) {
    const limit = options.stopAt ?? input.length;
    const tokens = [];
    let tokenStart = -1;
    let contentStart = -1;
    let contentEnd = -1;
    let current = '';
    let mode = 'normal';
    let quote = null;
    let quoteStart = -1;
    const flushToken = (end) => {
        if (tokenStart === -1) {
            return;
        }
        const span = {
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
                }
                else {
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
            }
            else {
                current += '\\';
                contentEnd = i + 1;
                i += 1;
            }
            continue;
        }
        if ((mode === 'double' && ch === '"')
            || (mode === 'single' && ch === "'")) {
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
export function tokenize(input) {
    const result = scanTokens(input);
    if (!result.ok) {
        return result;
    }
    return { ok: true, tokens: result.tokens.map((token) => token.value) };
}
