import { computeIndicators, computeCorrelations } from './indicators';

import { describe, expect, test } from '@jest/globals';

function t(ts: number, price: number) {
    return { ts, askPrice: price, bidPrice: price, volatility: 0, forecast: 0 };
}

test('basic stats', () => {
    const ticks = [t(0, 10), t(1, 12), t(2, 14)];
    const result = computeIndicators(ticks);
    expect(result.count).toBe(3);
    expect(result.mean).toBeCloseTo(12);
    expect(result.min).toBeCloseTo(10);
    expect(result.max).toBeCloseTo(14);
    expect(result.std).toBeCloseTo(1.63299, 4);
});

test('sma and ema', () => {
    const ticks = [t(0, 1), t(1, 2), t(2, 3), t(3, 4), t(4, 5)];
    const result = computeIndicators(ticks, {
        smaPeriods: [3],
        emaPeriods: [3],
        percentiles: [10, 90],
        rocPeriods: [2],
    });
    expect(result.median).toBeCloseTo(3);
    expect(result.sma[3]).toBeCloseTo(4);
    expect(result.ema[3]).toBeCloseTo(4.0625, 4);
    expect(result.percentiles[10]).toBeCloseTo(1.4, 2);
    expect(result.percentiles[90]).toBeCloseTo(4.6, 2);
    expect(result.roc[2]).toBeCloseTo(0.6666, 3);
    expect(result.bollinger[3].lower).toBeLessThan(result.sma[3]);
    expect(result.maxDrawdown).toBeCloseTo(0, 5);
    expect(result.maxRunUp).toBeGreaterThan(0);
});

test('drawdown and runup', () => {
    const ticks = [t(0, 1), t(1, 2), t(2, 1), t(3, 4)];
    const result = computeIndicators(ticks, { rocPeriods: [2] });
    expect(result.maxDrawdown).toBeCloseTo(0.5);
    expect(result.maxRunUp).toBeCloseTo(3);
});

test('correlations', () => {
    const seriesA = [t(0, 1), t(1, 1.1), t(2, 1.32), t(3, 1.716)];
    const seriesB = [t(0, 1), t(1, 1.1), t(2, 1.32), t(3, 1.716)];
    const seriesC = [t(0, 1), t(1, 0.9), t(2, 0.72), t(3, 0.504)];
    const corr = computeCorrelations({ A: seriesA, B: seriesB, C: seriesC });
    expect(corr.A.B).toBeCloseTo(1);
    expect(corr.A.C).toBeLessThan(0);
});
