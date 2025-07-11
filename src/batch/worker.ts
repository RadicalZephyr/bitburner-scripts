import type { NS, ProcessInfo } from "netscript";

export class Worker {
    ns: NS;
    name: string;
    usedRam: number;
    maxRam: number;
    scripts: ProcessInfo[];

    constructor(ns: NS, host: string) {
        this.ns = ns;
        this.name = host;
        this.usedRam = ns.getServerUsedRam(host);
        this.maxRam = ns.getServerMaxRam(host);
        this.scripts = ns.ps(host);
    }

    update() {
        this.usedRam = this.ns.getServerUsedRam(this.name);
        this.scripts = this.ns.ps(this.name);
    }

    availableRam(): number {
        return this.maxRam - this.usedRam;
    }
}
