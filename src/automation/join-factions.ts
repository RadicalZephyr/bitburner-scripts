import type { NS } from 'netscript';

export async function main(ns: NS) {
    const sing = ns.singularity;

    while (true) {
        const factionInvites = sing.checkFactionInvitations();

        for (const f of factionInvites) {
            if (sing.getFactionEnemies(f).length > 0) continue;
            sing.joinFaction(f);
        }
        await ns.sleep(1000);
    }
}
