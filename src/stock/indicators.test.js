const { computeIndicators } = require('./indicators');

test('basic stats', () => {
    const ticks = [
        { ts: 0, askPrice: 10, bidPrice: 9, volatility: 0, forecast: 0 },
        { ts: 1, askPrice: 12, bidPrice: 11, volatility: 0, forecast: 0 },
        { ts: 2, askPrice: 14, bidPrice: 13, volatility: 0, forecast: 0 },
    ];
    const result = computeIndicators(ticks);
    expect(result.count).toBe(3);
    expect(result.mean).toBeCloseTo(11.5);
    expect(result.min).toBeCloseTo(9.5);
    expect(result.max).toBeCloseTo(13.5);
    expect(result.std).toBeCloseTo(1.63299, 4);
});
