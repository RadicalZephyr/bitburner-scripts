import {
    assertAlmostEquals,
    assertEquals,
    assertGreaterThan,
    assertLessThan,
} from "https://deno.land/std/assert/mod.ts";
import { computeIndicators, computeCorrelations } from 'stock/indicators';

function t(ts: number, price: number) {
    return { ts, askPrice: price, bidPrice: price, volatility: 0, forecast: 0 };
}

Deno.test('basic stats', () => {
    const ticks = [t(0, 10), t(1, 12), t(2, 14)];
    const result = computeIndicators(ticks);
    assertEquals(result.count, 3);
    assertAlmostEquals(result.mean, 12);
    assertAlmostEquals(result.min, 10);
    assertAlmostEquals(result.max, 14);
    assertAlmostEquals(result.std, 1.63299, 1e-4);
});

Deno.test('sma and ema', () => {
    const ticks = [t(0, 1), t(1, 2), t(2, 3), t(3, 4), t(4, 5)];
    const result = computeIndicators(ticks, {
        smaPeriods: [3],
        emaPeriods: [3],
        percentiles: [10, 90],
        rocPeriods: [2],
    });
    assertAlmostEquals(result.median, 3);
    assertAlmostEquals(result.sma[3], 4);
    assertAlmostEquals(result.ema[3], 4.0625, 1e-4);
    assertAlmostEquals(result.percentiles[10], 1.4, 0.01);
    assertAlmostEquals(result.percentiles[90], 4.6, 0.01);
    assertAlmostEquals(result.roc[2], 0.6666, 1e-3);
    assertLessThan(result.bollinger[3].lower, result.sma[3]);
    assertAlmostEquals(result.maxDrawdown, 0, 1e-5);
    assertGreaterThan(result.maxRunUp, 0);
});

Deno.test('drawdown and runup', () => {
    const ticks = [t(0, 1), t(1, 2), t(2, 1), t(3, 4)];
    const result = computeIndicators(ticks, { rocPeriods: [2] });
    assertAlmostEquals(result.maxDrawdown, 0.5);
    assertAlmostEquals(result.maxRunUp, 3);
});

Deno.test('correlations', () => {
    const seriesA = [t(0, 1), t(1, 1.1), t(2, 1.32), t(3, 1.716)];
    const seriesB = [t(0, 1), t(1, 1.1), t(2, 1.32), t(3, 1.716)];
    const seriesC = [t(0, 1), t(1, 0.9), t(2, 0.72), t(3, 0.504)];
    const corr = computeCorrelations({ A: seriesA, B: seriesB, C: seriesC });
    assertAlmostEquals(corr.A.B, 1);
    assertLessThan(corr.A.C, 0);
});
