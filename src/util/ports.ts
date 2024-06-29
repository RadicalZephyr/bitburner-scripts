import type { NS } from "netscript";

function toPort(name: string): number {
    return name.split('').map((s) => s.codePointAt(0)).reduce((p, n) => p + n);
}

export const SOFTEN_PORT: number = toPort("soften");
export const GROW_PORT: number = toPort("grow");
export const STEAL_PORT: number = toPort("steal");
export const MONITOR_PORT: number = toPort("monitor");

export async function main(ns: NS) {
    ns.tprintf(
        "Soften Port: %s\nGrow Port: %s\nSteal Port: %s\nMonitor Port: %s\n",
        SOFTEN_PORT,
        GROW_PORT,
        STEAL_PORT,
        MONITOR_PORT
    );
}
