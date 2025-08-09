import type { NS } from 'netscript';
import { allFactions } from 'automation/factions';
import { parseFlags } from 'util/flags';

export async function main(ns: NS) {
    await parseFlags(ns, []);

    acceptInvites(ns);
    pursueInvites(ns);

    while (true) {
        await ns.asleep(60_000);
    }
}

async function acceptInvites(ns: NS) {
    let running = true;
    ns.atExit(() => {
        running = false;
    }, 'acceptInvites');

    const sing = ns.singularity;
    while (running) {
        const factionInvites = sing.checkFactionInvitations();

        for (const f of factionInvites) {
            if (sing.getFactionEnemies(f).length > 0) continue;
            sing.joinFaction(f);
        }
        await ns.asleep(1000);
    }
}

async function pursueInvites(ns: NS) {
    const myFactions = new Set(ns.getPlayer().factions);
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const factionsToJoin = allFactions(ns).filter((f) => !myFactions.has(f));
}
