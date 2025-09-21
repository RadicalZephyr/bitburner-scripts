import { isArrayOf, isNumber, isObjectLike, Validator } from 'util/validate';

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
