import type { NS, Server, Player } from "netscript";

/**
 * Calculate the expected monetary value generated per RAM-second for a full
 * hacking batch.
 *
 * @param ns      - Netscript API instance
 * @param server  - Target server information
 * @param player  - Player stats used for formula calculations
 * @param spacing - Delay (ms) between batch phases
 * @returns Expected value per RAM-second
 */
export function expectedValuePerRamSecond(
    ns: NS,
    server: Server,
    player: Player,
    spacing: number,
): number {
    const maxMoney = (server as any).maxMoney ?? server.moneyMax ?? 0;

    const expectedHackValue =
        maxMoney *
        ns.formulas.hacking.hackPercent(server, player) *
        ns.formulas.hacking.hackChance(server, player);

    const growThreads = ns.formulas.hacking.growThreads(
        server,
        player,
        maxMoney - expectedHackValue,
        maxMoney,
    );

    const hackingFormulas = ns.formulas.hacking as any;
    const hackSecInc = hackingFormulas.hackSecurity(server, player, 1);
    const growSecInc = hackingFormulas.growSecurity(server, player, growThreads);
    const weakenThreads = (hackSecInc + growSecInc) / 0.05;

    const ramUse =
        ns.getScriptRam("/batch/h.js") +
        growThreads * ns.getScriptRam("/batch/g.js") +
        weakenThreads * ns.getScriptRam("/batch/w.js");

    const batchTime = ns.formulas.hacking.weakenTime(server, player) + 2 * spacing;

    return expectedHackValue / (batchTime * ramUse);
}
