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

function midPrice(t: TickData): number {
    return (t.askPrice + t.bidPrice) / 2;
}

/** Compute basic statistical indicators over a list of ticks. */
export function computeIndicators(ticks: TickData[]): BasicIndicators {
    const count = ticks.length;
    if (count === 0) {
        return { count: 0, mean: 0, min: 0, max: 0, std: 0 };
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
    return { count, mean, min, max, std };
}
