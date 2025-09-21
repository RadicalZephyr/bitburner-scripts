import { NS } from '@ns';

import { isArrayOf, isNumber, isObjectLike, Validator } from 'util/validate';

import { CONFIG } from 'stock/config';

export interface TickData {
    ts: number;
    askPrice: number;
    bidPrice: number;
    volatility: number;
    forecast: number;
}

export const isTickData: Validator<TickData> = isObjectLike({
    ts: isNumber,
    askPrice: isNumber,
    bidPrice: isNumber,
    volatility: isNumber,
    forecast: isNumber,
});

export const isTickDataArray: Validator<TickData[]> = isArrayOf(isTickData);

/**
 * Read tick data for symbol from the canonical stored stock data
 */
export function readStoredTickData(ns: NS, sym: string): TickData[] {
    const dataPath = CONFIG.dataPath;
    const path = `${dataPath}${sym}.json`;
    if (!ns.fileExists(path)) return [];

    const tickData = JSON.parse(ns.read(path));
    if (!isTickDataArray(tickData)) {
        ns.print(
            `WARN: stored tick data for symbol ${sym} format is unrecognized`,
        );
        return [];
    }
    return tickData;
}
