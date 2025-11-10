import { defineProtocol, BaseClient } from 'util/protocol';
import { isLifecycle as isMonitorLifecycle } from 'batch/client/monitor';
import { isUnionOf, isArrayOf, isLiteral, isNumber, isObjectLike, isString, } from 'util/validate';
export const TASK_SELECTOR_PORT = 11;
export const TASK_SELECTOR_RESPONSE_PORT = 12;
export const MessageType = {
    NewTarget: 'NewTarget',
    FinishedTilling: 'FinishedTilling',
    FinishedSowing: 'FinishedSowing',
    Heartbeat: 'Heartbeat',
    RequestLifecycle: 'RequestLifecycle',
};
export var Lifecycle;
(function (Lifecycle) {
    Lifecycle[Lifecycle["Till"] = 0] = "Till";
    Lifecycle[Lifecycle["Sow"] = 1] = "Sow";
    Lifecycle[Lifecycle["Harvest"] = 2] = "Harvest";
})(Lifecycle || (Lifecycle = {}));
const isLifecycle = isUnionOf(isLiteral(Lifecycle.Till), isLiteral(Lifecycle.Sow), isLiteral(Lifecycle.Harvest));
const isHeartbeat = isObjectLike({
    pid: isNumber,
    filename: isString,
    target: isString,
    lifecycle: isLifecycle,
});
export const LifecycleRequest = 'BTS_LifecycleRequest';
const isLifecycleRequest = isLiteral(LifecycleRequest);
const isLifecycleSnapshot = isArrayOf((v) => Array.isArray(v)
    && v.length === 2
    && isString(v[0])
    && isMonitorLifecycle(v[1]));
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
/** Hide communication with the TaskSelector behind a simple API. */
export class TaskSelectorClient {
    #client;
    constructor(ns) {
        this.#client = new BaseClient(TaskSelectorProtocol, ns.getPortHandle(TASK_SELECTOR_PORT), ns.getPortHandle(TASK_SELECTOR_RESPONSE_PORT));
    }
    newTarget(hostname) {
        return this.#client.sendMessage(MessageType.NewTarget, [hostname]);
    }
    finishedTilling(hostname) {
        return this.#client.sendMessage(MessageType.FinishedTilling, hostname);
    }
    finishedSowing(hostname) {
        return this.#client.sendMessage(MessageType.FinishedSowing, hostname);
    }
    /**
     * Send a heartbeat message to the manager.
     *
     * This allows the manager to recover running targets when it is restarted.
     */
    heartbeat(pid, filename, target, lifecycle) {
        const hb = { pid, filename, target, lifecycle };
        return this.#client.sendMessage(MessageType.Heartbeat, hb);
    }
    /**
     * Try to send a heartbeat message to the manager without waiting
     * for space in the port.
     *
     * This allows the manager to recover running targets when it is restarted.
     */
    tryHeartbeat(pid, filename, target, lifecycle) {
        const hb = { pid, filename, target, lifecycle };
        return this.#client.trySendMessage(MessageType.Heartbeat, hb);
    }
    /**
     * Request a snapshot of lifecycle state for all tracked hosts.
     *
     * @returns Array of `[hostname, Lifecycle]` pairs describing current state.
     */
    requestLifecycle() {
        return this.#client.sendMessageReceiveResponse(MessageType.RequestLifecycle, LifecycleRequest);
    }
}
