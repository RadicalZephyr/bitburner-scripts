import type { NS } from "netscript";

function toPort(name: string): number {
    return name.split('').map((s) => s.codePointAt(0)).reduce((p, n) => p + n);
}

export const EMPTY_SENTINEL: string = "NULL PORT DATA";

export const TILL_PORT: number = toPort("till");
export const SOW_PORT: number = toPort("sow");
export const HARVEST_PORT: number = toPort("harvest");

export const MONITOR_PORT: number = toPort("monitor");

export const WORKERS_PORT: number = toPort("workers");
export const WORKERS_DONE: string = "WORKERS_DONE_SENTINEL";

export async function main(ns: NS) {
    ns.tprintf(
        "Till Port: %s\n"
        + "Sow Port: %s\n"
        + "Harvest Port: %s\n"
        + "Monitor Port: %s\n"
        + "Workers Port: %s\n",
        TILL_PORT,
        SOW_PORT,
        HARVEST_PORT,
        MONITOR_PORT,
        WORKERS_PORT
    );
}
