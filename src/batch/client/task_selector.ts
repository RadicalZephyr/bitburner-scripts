import type { NS } from 'netscript';

import { defineProtocol, BaseClient, AnyRequest } from 'util/protocol';
import { isLifecycle as isMonitorLifecycle } from 'batch/client/monitor';
import type { Lifecycle as MonitorLifecycle } from 'batch/client/monitor';
import {
    isAnyOf,
    isArrayOf,
    isLiteral,
    isNumber,
    isObjectLike,
    isString,
    Validator,
} from 'util/validate';

export const TASK_SELECTOR_PORT: number = 11;
export const TASK_SELECTOR_RESPONSE_PORT: number = 12;

export const MessageType = {
    NewTarget: 'NewTarget',
    FinishedTilling: 'FinishedTilling',
    FinishedSowing: 'FinishedSowing',
    Heartbeat: 'Heartbeat',
    RequestLifecycle: 'RequestLifecycle',
} as const;

export enum Lifecycle {
    Till,
    Sow,
    Harvest,
}

const isLifecycle = isAnyOf(
    isLiteral(Lifecycle.Till),
    isLiteral(Lifecycle.Sow),
    isLiteral(Lifecycle.Harvest),
);

export interface Heartbeat {
    pid: number;
    filename: string;
    target: string;
    lifecycle: Lifecycle;
}

const isHeartbeat = isObjectLike({
    pid: isNumber,
    filename: isString,
    target: isString,
    lifecycle: isLifecycle,
});

export const LifecycleRequest = 'BTS_LifecycleRequest';

const isLifecycleRequest: Validator<typeof LifecycleRequest> =
    isLiteral(LifecycleRequest);

export type LifecycleSnapshot = [string, MonitorLifecycle][];

const isLifecycleSnapshot = isArrayOf(
    (v): v is [string, MonitorLifecycle] =>
        Array.isArray(v)
        && v.length === 2
        && isString(v[0])
        && isMonitorLifecycle(v[1]),
);

export const TaskSelectorProtocol = defineProtocol({
    [MessageType.NewTarget]: { payload: isArrayOf(isString) },
    [MessageType.FinishedTilling]: { payload: isString },
    [MessageType.FinishedSowing]: { payload: isString },
    [MessageType.Heartbeat]: { payload: isHeartbeat },
    [MessageType.RequestLifecycle]: {
        payload: isLifecycleRequest,
        response: isLifecycleSnapshot,
    },
});

export type TaskSelectorProtocolDef = (typeof TaskSelectorProtocol)['def'];

export type Message = AnyRequest<TaskSelectorProtocolDef>;

/** Hide communication with the TaskSelector behind a simple API. */
export class TaskSelectorClient {
    #client: BaseClient<TaskSelectorProtocolDef>;

    constructor(ns: NS) {
        this.#client = new BaseClient(
            TaskSelectorProtocol,
            ns.getPortHandle(TASK_SELECTOR_PORT),
            ns.getPortHandle(TASK_SELECTOR_RESPONSE_PORT),
        );
    }

    newTarget(hostname: string) {
        return this.#client.sendMessage(MessageType.NewTarget, [hostname]);
    }

    finishedTilling(hostname: string) {
        return this.#client.sendMessage(MessageType.FinishedTilling, hostname);
    }

    finishedSowing(hostname: string) {
        return this.#client.sendMessage(MessageType.FinishedSowing, hostname);
    }

    /**
     * Send a heartbeat message to the manager.
     *
     * This allows the manager to recover running targets when it is restarted.
     */
    heartbeat(
        pid: number,
        filename: string,
        target: string,
        lifecycle: Lifecycle,
    ) {
        const hb: Heartbeat = { pid, filename, target, lifecycle };
        return this.#client.sendMessage(MessageType.Heartbeat, hb);
    }

    /**
     * Try to send a heartbeat message to the manager without waiting
     * for space in the port.
     *
     * This allows the manager to recover running targets when it is restarted.
     */
    tryHeartbeat(
        pid: number,
        filename: string,
        target: string,
        lifecycle: Lifecycle,
    ): boolean {
        const hb: Heartbeat = { pid, filename, target, lifecycle };
        return this.#client.trySendMessage(MessageType.Heartbeat, hb);
    }

    /**
     * Request a snapshot of lifecycle state for all tracked hosts.
     *
     * @returns Array of `[hostname, Lifecycle]` pairs describing current state.
     */
    requestLifecycle(): Promise<LifecycleSnapshot> {
        return this.#client.sendMessageReceiveResponse(
            MessageType.RequestLifecycle,
            LifecycleRequest,
        );
    }
}
