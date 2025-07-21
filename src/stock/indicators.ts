import { Indicators } from 'stock/client/tracker';

export interface TickData {
    ts: number;
    askPrice: number;
    bidPrice: number;
    volatility: number;
    forecast: number;
}

export interface IndicatorOptions {
    smaPeriods?: number[];
    emaPeriods?: number[];
    rocPeriods?: number[];
    percentiles?: number[];
    bollingerK?: number;
}

/**
 * Compute pairwise Pearson correlation coefficients between
 * symbol return series.
 */
export function computeCorrelations(
    ticks: Record<string, TickData[]>,
): Record<string, Record<string, number>> {
    const syms = Object.keys(ticks);
    const returns: Record<string, number[]> = {};
    let minLen = Infinity;
    for (const sym of syms) {
        const prices = ticks[sym].map(midPrice);
        const r: number[] = [];
        for (let i = 1; i < prices.length; i++) {
            const prev = prices[i - 1];
            const curr = prices[i];
            r.push((curr - prev) / prev);
        }
        returns[sym] = r;
        if (r.length < minLen) minLen = r.length;
    }
    const result: Record<string, Record<string, number>> = {};
    for (const a of syms) {
        result[a] = {};
        for (const b of syms) {
            if (a === b) {
                result[a][b] = 1;
                continue;
            }
            const r1 = returns[a].slice(0, minLen);
            const r2 = returns[b].slice(0, minLen);
            const mean1 = r1.reduce((s, x) => s + x, 0) / minLen;
            const mean2 = r2.reduce((s, x) => s + x, 0) / minLen;
            let cov = 0;
            let var1 = 0;
            let var2 = 0;
            for (let i = 0; i < minLen; i++) {
                const d1 = r1[i] - mean1;
                const d2 = r2[i] - mean2;
                cov += d1 * d2;
                var1 += d1 * d1;
                var2 += d2 * d2;
            }
            const denom = Math.sqrt(var1 * var2);
            result[a][b] = denom === 0 ? 0 : cov / denom;
        }
    }
    return result;
}

function midPrice(t: TickData): number {
    return (t.askPrice + t.bidPrice) / 2;
}

function median(values: number[]): number {
    if (values.length === 0) return 0;
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 === 0
        ? (sorted[mid - 1] + sorted[mid]) / 2
        : sorted[mid];
}

function percentile(sorted: number[], p: number): number {
    if (sorted.length === 0) return 0;
    const idx = (p / 100) * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    const weight = idx - lo;
    return sorted[lo] * (1 - weight) + sorted[hi] * weight;
}

function sma(values: number[], period: number): number {
    if (values.length < period) return NaN;
    const slice = values.slice(values.length - period);
    return slice.reduce((a, b) => a + b, 0) / period;
}

function ema(values: number[], period: number): number {
    if (values.length === 0) return NaN;
    const k = 2 / (period + 1);
    let val = values[0];
    for (let i = 1; i < values.length; i++) {
        val = values[i] * k + val * (1 - k);
    }
    return val;
}

function roc(values: number[], period: number): number {
    if (values.length <= period) return NaN;
    const curr = values[values.length - 1];
    const prev = values[values.length - 1 - period];
    return (curr - prev) / prev;
}

/** Compute statistical indicators over a list of ticks. */
export function computeIndicators(
    ticks: TickData[],
    opts: IndicatorOptions = {},
): Indicators {
    const count = ticks.length;
    if (count === 0) {
        return {
            count: 0,
            mean: 0,
            min: 0,
            max: 0,
            std: 0,
            median: 0,
            zScore: 0,
            sma: {},
            ema: {},
            percentiles: {},
            roc: {},
            bollinger: {},
            maxDrawdown: 0,
            maxRunUp: 0,
        };
    }
    const prices = ticks.map(midPrice);
    const mean = prices.reduce((a, b) => a + b, 0) / count;
    let min = prices[0];
    let max = prices[0];
    for (const p of prices) {
        if (p < min) min = p;
        if (p > max) max = p;
    }
    const variance = prices.reduce((s, p) => s + (p - mean) ** 2, 0) / count;
    const std = Math.sqrt(variance);
    const med = median(prices);
    const zScore = std === 0 ? 0 : (prices[prices.length - 1] - mean) / std;

    const smaRes: Record<number, number> = {};
    for (const p of opts.smaPeriods ?? []) {
        smaRes[p] = sma(prices, p);
    }

    const emaRes: Record<number, number> = {};
    for (const p of opts.emaPeriods ?? []) {
        emaRes[p] = ema(prices, p);
    }

    const rocRes: Record<number, number> = {};
    for (const p of opts.rocPeriods ?? []) {
        rocRes[p] = roc(prices, p);
    }

    const bollRes: Record<number, { lower: number; upper: number }> = {};
    const bollK = opts.bollingerK ?? 2;
    for (const p of opts.smaPeriods ?? []) {
        if (!isNaN(smaRes[p])) {
            bollRes[p] = {
                lower: smaRes[p] - bollK * std,
                upper: smaRes[p] + bollK * std,
            };
        }
    }

    let peak = prices[0];
    let trough = prices[0];
    let maxDrawdown = 0;
    let maxRunUp = 0;
    for (const price of prices) {
        if (price > peak) {
            peak = price;
        }
        const dd = (peak - price) / peak;
        if (dd > maxDrawdown) maxDrawdown = dd;

        if (price < trough) {
            trough = price;
        }
        const ru = (price - trough) / trough;
        if (ru > maxRunUp) maxRunUp = ru;
    }

    const pctRes: Record<number, number> = {};
    const sorted = [...prices].sort((a, b) => a - b);
    for (const p of opts.percentiles ?? []) {
        pctRes[p] = percentile(sorted, p);
    }

    return {
        count,
        mean,
        min,
        max,
        std,
        median: med,
        zScore,
        sma: smaRes,
        ema: emaRes,
        percentiles: pctRes,
        roc: rocRes,
        bollinger: bollRes,
        maxDrawdown,
        maxRunUp,
    };
}
