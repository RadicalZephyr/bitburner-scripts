export class Worker {
    ns;
    name;
    usedRam;
    maxRam;
    scripts;
    constructor(ns, host) {
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
    availableRam() {
        return this.maxRam - this.usedRam;
    }
}
