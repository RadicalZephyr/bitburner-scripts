export interface TickData {
    ts: number;
    askPrice: number;
    bidPrice: number;
    volatility: number;
    forecast: number;
}

export interface BasicIndicators {
    count: number;
    mean: number;
    min: number;
    max: number;
    std: number;
}

export interface IndicatorOptions {
    smaPeriods?: number[];
    emaPeriods?: number[];
    percentiles?: number[];
}

export interface Indicators extends BasicIndicators {
    median: number;
    zScore: number;
    sma: Record<number, number>;
    ema: Record<number, number>;
    percentiles: Record<number, number>;
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

/** Compute statistical indicators over a list of ticks. */
export function computeIndicators(
    ticks: TickData[],
    opts: IndicatorOptions = {}
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
    };
}
