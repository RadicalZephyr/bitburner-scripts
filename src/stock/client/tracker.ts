import type { NS } from 'netscript';
import {
    Client,
    Message as ClientMessage,
    Response as ClientResponse,
} from 'util/client';

export const TRACKER_PORT = 30;
export const TRACKER_RESPONSE_PORT = 31;

export enum MessageType {
    RequestTicks,
    RequestIndicators,
}

type Payload = Record<string, Indicators>;

export type Messages =
    | { type: MessageType.RequestTicks; payload: object }
    | { type: MessageType.RequestIndicators; payload: object };

export type Message = ClientMessage<Messages>;
export type Response = ClientResponse<Record<string, Indicators>>;

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

export class TrackerClient extends Client<Messages, Payload | null> {
    constructor(ns: NS) {
        super(ns, TRACKER_PORT, TRACKER_RESPONSE_PORT);
    }

    /** Request raw tick data for all tracked symbols. */
    async requestTicks() {
        return await this.sendMessageReceiveResponse(
            MessageType.RequestTicks,
            {},
        );
    }

    /** Request computed indicators for all tracked symbols. */
    async requestIndicators() {
        return await this.sendMessageReceiveResponse(
            MessageType.RequestIndicators,
            {},
        );
    }
}
