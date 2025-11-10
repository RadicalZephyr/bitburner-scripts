import { isArrayOf, isNumber, isObjectLike } from 'util/validate';
import { CONFIG } from 'stock/config';
export const isTickData = isObjectLike({
    ts: isNumber,
    askPrice: isNumber,
    bidPrice: isNumber,
    volatility: isNumber,
    forecast: isNumber,
});
export const isTickDataArray = isArrayOf(isTickData);
/**
 * Read tick data for symbol from the canonical stored stock data
 */
export function readStoredTickData(ns, sym) {
    const dataPath = CONFIG.dataPath;
    const path = `${dataPath}${sym}.json`;
    if (!ns.fileExists(path))
        return [];
    const tickData = JSON.parse(ns.read(path));
    if (!isTickDataArray(tickData)) {
        ns.print(`WARN: stored tick data for symbol ${sym} format is unrecognized`);
        return [];
    }
    return tickData;
}
