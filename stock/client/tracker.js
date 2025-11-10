import { BaseClient, defineProtocol } from 'util/protocol';
import { isArrayOf, isLiteral, isNumber, isObjectLike, isRecordOf, isString, } from 'util/validate';
export const TRACKER_PORT = 30;
export const TRACKER_RESPONSE_PORT = 31;
export const MessageType = {
    RequestStockTicks: 'RequestStockTicks',
    RequestAllTicks: 'RequestAllTicks',
    RequestIndicators: 'RequestIndicators',
};
const AllTickDataRequest = 'STR_AllTickDataRequest';
const isAllTickDataRequest = isLiteral(AllTickDataRequest);
const isTickData = isObjectLike({
    ts: isNumber,
    askPrice: isNumber,
    bidPrice: isNumber,
    volatility: isNumber,
    forecast: isNumber,
});
const isStockTickDataRequest = isString;
const IndicatorsRequest = 'STR_IndicatorsRequest';
const isIndicatorsRequest = isLiteral(IndicatorsRequest);
const isIndicators = isObjectLike({
    count: isNumber,
    mean: isNumber,
    min: isNumber,
    max: isNumber,
    std: isNumber,
    median: isNumber,
    zScore: isNumber,
    sma: isRecordOf(isNumber),
    ema: isRecordOf(isNumber),
    percentiles: isRecordOf(isNumber),
    roc: isRecordOf(isNumber),
    bollinger: isRecordOf(isObjectLike({
        lower: isNumber,
        upper: isNumber,
    })),
    maxDrawdown: isNumber,
    maxRunUp: isNumber,
});
export const TrackerProtocol = defineProtocol({
    [MessageType.RequestStockTicks]: {
        payload: isStockTickDataRequest,
        response: isArrayOf(isTickData),
    },
    [MessageType.RequestAllTicks]: {
        payload: isAllTickDataRequest,
        response: isRecordOf(isArrayOf(isTickData)),
    },
    [MessageType.RequestIndicators]: {
        payload: isIndicatorsRequest,
        response: isRecordOf(isIndicators),
    },
});
/**
 * Client for interacting with the stock tracker daemon.
 */
export class TrackerClient extends BaseClient {
    #ns;
    constructor(ns) {
        super(TrackerProtocol, ns.getPortHandle(TRACKER_PORT), ns.getPortHandle(TRACKER_RESPONSE_PORT));
        this.#ns = ns;
    }
    /** Request raw stock tick data for one symbol. */
    requestStockTicks(sym) {
        const syms = new Set(this.#ns.stock.getSymbols());
        if (!syms.has(sym))
            throw new Error(`Unknown stock symbol ${sym}.`);
        return this.sendMessageReceiveResponse(MessageType.RequestStockTicks, sym);
    }
    /** Request raw tick data for all tracked symbols. */
    requestAllTicks() {
        return this.sendMessageReceiveResponse(MessageType.RequestAllTicks, AllTickDataRequest);
    }
    /** Request computed indicators for all tracked symbols. */
    requestIndicators() {
        return this.sendMessageReceiveResponse(MessageType.RequestIndicators, IndicatorsRequest);
    }
}
