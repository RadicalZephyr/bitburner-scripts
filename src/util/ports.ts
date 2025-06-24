import type { NS, NetscriptPort } from "netscript";

function toPort(name: string): number {
    return name.split('').map((s) => s.codePointAt(0)).reduce((p, n) => p + n);
}

export const EMPTY_SENTINEL: string = "NULL PORT DATA";
export const DONE_SENTINEL: string = "PORT CLOSED";

export const TILL_PORT: number = toPort("till");
export const SOW_PORT: number = toPort("sow");
export const HARVEST_PORT: number = toPort("harvest");

export const MONITOR_PORT: number = toPort("monitor");

export const HOSTS_PORT: number = 100;
export const TARGETS_PORT: number = 101;

export const WorkerType = "worker";
export const TargetType = "target";

export type HostType = "worker" | "target";

export type HostMsg = {
    type: HostType
    host: string
};

export function workerMsg(host: string): HostMsg {
    return {
        type: "worker",
        host: host
    };
}

export function targetMsg(host: string): HostMsg {
    return {
        type: "target",
        host: host
    };
}

export function* readAllFromPort(ns: NS, port: NetscriptPort) {
    while (true) {
        let nextMsg = port.read();
        if (typeof nextMsg === "string" && (nextMsg === EMPTY_SENTINEL || nextMsg === DONE_SENTINEL)) {
            return;
        }
        yield nextMsg;
    }
}

export async function main(ns: NS) {
    ns.tprintf(
        "Till Port: %s\n"
        + "Sow Port: %s\n"
        + "Harvest Port: %s\n"
        + "Monitor Port: %s\n"
        + "Hosts Port: %s\n"
        + "Targets Port: %s\n",
        TILL_PORT,
        SOW_PORT,
        HARVEST_PORT,
        MONITOR_PORT,
        HOSTS_PORT,
        TARGETS_PORT
    );
}
