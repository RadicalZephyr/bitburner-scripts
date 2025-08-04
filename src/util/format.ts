//////////////////////////////////////////
// Formatting Utilities
//////////////////////////////////////////

export function formatMoney(value: number): string {
    const s = ['', 'k', 'm', 'b', 't', 'q'];
    const e = Math.floor(Math.log(value) / Math.log(1000));
    return (value / Math.pow(1000, e)).toFixed(2) + s[e];
}

const ramSuffixList = ['GiB', 'TiB', 'PiB'];
const ramExpList = ramSuffixList.map((_, i) => 1024 ** i);

/** Display standard ram formatting. */
export function formatRam(n: number, fractionalDigits = 2) {
    // NaN does not get formatted
    if (Number.isNaN(n)) return `NaN${ramSuffixList[0]}`;
    const nAbs = Math.abs(n);

    // Special handling for Infinities
    if (nAbs === Infinity)
        return `${n < 0 ? '-∞' : ''}∞${ramSuffixList.at(-1)}`;

    // Early return if using first suffix.
    if (nAbs < 1000)
        return getFormatter(fractionalDigits).format(n) + ramSuffixList[0];

    // Ram always uses a suffix and never goes to exponential
    const suffixIndex = Math.min(
        Math.floor(Math.log2(nAbs) / 10),
        ramSuffixList.length - 1,
    );
    n /= ramExpList[suffixIndex];
    /* Not really concerned with 1000-rounding or 1024-rounding for ram due to the actual values ram gets displayed at.
  If display of e.g. 1,000.00GB instead of 1.00TB for 999.995GB, or 1,024.00GiB instead of 1.00TiB for 1,023.995GiB
  becomes an actual issue we can add smart rounding, but ram values like that really don't happen ingame so it's
  probably not worth the performance overhead to check and correct these. */
    return (
        getFormatter(fractionalDigits).format(n) + ramSuffixList[suffixIndex]
    );
}

const digitFormats = {};

/** Makes a new formatter */
function makeFormatter(
    fractionalDigits: number,
    otherOptions: Intl.NumberFormatOptions = {},
): Intl.NumberFormat {
    return new Intl.NumberFormat('en', {
        minimumFractionDigits: 0,
        maximumFractionDigits: fractionalDigits,
        ...otherOptions,
    });
}
/** Returns a cached formatter if it already exists, otherwise makes and returns a new formatter */
function getFormatter(
    fractionalDigits: number,
    formatList = digitFormats,
    options: Intl.NumberFormatOptions = {},
): Intl.NumberFormat {
    if (formatList[fractionalDigits]) {
        return formatList[fractionalDigits];
    }
    return (formatList[fractionalDigits] = makeFormatter(
        fractionalDigits,
        options,
    ));
}
