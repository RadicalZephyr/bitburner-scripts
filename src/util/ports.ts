import type { NS, NetscriptPort } from "netscript";

export const EMPTY_SENTINEL: string = "NULL PORT DATA";
export const DONE_SENTINEL: string = "PORT CLOSED";

export function* readAllFromPort(ns: NS, port: NetscriptPort) {
    while (true) {
        let nextMsg = port.read();
        if (typeof nextMsg === "string" && (nextMsg === EMPTY_SENTINEL || nextMsg === DONE_SENTINEL)) {
            return;
        }
        yield nextMsg;
    }
}
