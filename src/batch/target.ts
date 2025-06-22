import type { NS, ProcessInfo } from "netscript";

export class Target {
    ns: NS;
    name: string;
    hckLevel: number;
    maxMoney: number;
    minSec: number;

    constructor(ns: NS, host: string) {
        this.ns = ns;
        this.name = host;
        this.hckLevel = ns.getServerRequiredHackingLevel(host);
        this.maxMoney = ns.getServerMaxMoney(host);
        this.minSec = ns.getServerMinSecurityLevel(host);
    }
}
