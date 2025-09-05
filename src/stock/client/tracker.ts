import type { NS } from 'netscript';

import { BaseClient, defineProtocol } from 'util/protocol';
import {
    isArrayOf,
    isLiteral,
    isNumber,
    isObjectLike,
    isRecordOf,
    type Validator,
} from 'util/validate';

import type { TickData } from 'stock/indicators';

export const TRACKER_PORT = 30;
export const TRACKER_RESPONSE_PORT = 31;

export const MessageType = {
    RequestTicks: 'RequestTicks',
    RequestIndicators: 'RequestIndicators',
} as const;

const TickDataRequest = 'STR_TickDataRequest';

const isTickDataRequest: Validator<typeof TickDataRequest> =
    isLiteral(TickDataRequest);

const isTickData: Validator<TickData> = isObjectLike({
    ts: isNumber,
    askPrice: isNumber,
    bidPrice: isNumber,
    volatility: isNumber,
    forecast: isNumber,
});

const IndicatorsRequest = 'STR_IndicatorsRequest';

const isIndicatorsRequest: Validator<typeof IndicatorsRequest> =
    isLiteral(IndicatorsRequest);

export interface BasicIndicators {
    count: number;
    mean: number;
    min: number;
    max: number;
    std: number;
}

export interface Indicators extends BasicIndicators {
    median: number;
    zScore: number;
    sma: Record<number, number>;
    ema: Record<number, number>;
    percentiles: Record<number, number>;
    roc: Record<number, number>;
    bollinger: Record<number, { lower: number; upper: number }>;
    maxDrawdown: number;
    maxRunUp: number;
}

const isIndicators: Validator<Indicators> = isObjectLike({
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
    bollinger: isRecordOf(
        isObjectLike({
            lower: isNumber,
            upper: isNumber,
        }),
    ),
    maxDrawdown: isNumber,
    maxRunUp: isNumber,
});

export const TrackerProtocol = defineProtocol({
    [MessageType.RequestTicks]: {
        payload: isTickDataRequest,
        response: isRecordOf(isArrayOf(isTickData)),
    },
    [MessageType.RequestIndicators]: {
        payload: isIndicatorsRequest,
        response: isRecordOf(isIndicators),
    },
});

export type TrackerProtocolDef = (typeof TrackerProtocol)['def'];

/**
 * Client for interacting with the stock tracker daemon.
 */
export class TrackerClient extends BaseClient<TrackerProtocolDef> {
    constructor(ns: NS) {
        super(
            TrackerProtocol,
            ns.getPortHandle(TRACKER_PORT),
            ns.getPortHandle(TRACKER_RESPONSE_PORT),
        );
    }

    /** Request raw tick data for all tracked symbols. */
    requestTicks() {
        return this.sendMessageReceiveResponse(
            MessageType.RequestTicks,
            TickDataRequest,
        );
    }

    /** Request computed indicators for all tracked symbols. */
    requestIndicators() {
        return this.sendMessageReceiveResponse(
            MessageType.RequestIndicators,
            IndicatorsRequest,
        );
    }
}
