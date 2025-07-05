export class Target {
    ns;
    name;
    hckLevel;
    maxMoney;
    minSec;
    constructor(ns, host) {
        this.ns = ns;
        this.name = host;
        this.hckLevel = ns.getServerRequiredHackingLevel(host);
        this.maxMoney = ns.getServerMaxMoney(host);
        this.minSec = ns.getServerMinSecurityLevel(host);
    }
}
