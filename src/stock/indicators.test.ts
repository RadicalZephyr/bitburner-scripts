import { computeIndicators } from './indicators';

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
    });
    expect(result.median).toBeCloseTo(3);
    expect(result.sma[3]).toBeCloseTo(4);
    expect(result.ema[3]).toBeCloseTo(4.0625, 4);
    expect(result.percentiles[10]).toBeCloseTo(1.4, 2);
    expect(result.percentiles[90]).toBeCloseTo(4.6, 2);
});
