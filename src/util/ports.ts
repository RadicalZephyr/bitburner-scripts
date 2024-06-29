import type { NS } from "netscript";

function toPort(name: string): number {
    return name.split('').map((s) => s.codePointAt(0)).reduce((p, n) => p + n);
}

export const TILL_PORT: number = toPort("till");
export const SOW_PORT: number = toPort("sow");
export const HARVEST_PORT: number = toPort("harvest");

export const MONITOR_PORT: number = toPort("monitor");

export async function main(ns: NS) {
    ns.tprintf(
        "Till Port: %s\nSow Port: %s\nHarvest Port: %s\nMonitor Port: %s\n",
        TILL_PORT,
        SOW_PORT,
        HARVEST_PORT,
        MONITOR_PORT
    );
}
