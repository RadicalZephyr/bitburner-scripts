import type { GangGenInfo, NS } from "netscript";

/**
 * Track territory information and expose a bonus multiplier.
 *
 * The manager updates every four gang ticks. Consumers should call
 * {@link tick} once per {@link NS.gang.nextUpdate} cycle.
 */
export class TerritoryManager {
    private ns: NS;
    private ticks = 0;
    private bonus = 1;

    constructor(ns: NS) {
        this.ns = ns;
        this.refresh();
    }

    /** Notify the manager that a gang tick has passed. */
    tick() {
        this.ticks++;
        if (this.ticks >= 4) {
            this.refresh();
            this.ticks = 0;
        }
    }

    /** Get the current territory bonus multiplier. */
    getBonus() {
        return this.bonus;
    }

    private refresh() {
        const info: GangGenInfo = this.ns.gang.getGangInformation();
        this.bonus = computeTerritoryBonus(info.territory);
    }
}

/** Compute the territory bonus from the territory percentage. */
export function computeTerritoryBonus(territory: number): number {
    return 1 + territory;
}
