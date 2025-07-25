import type { NS } from 'netscript';

export async function main(ns: NS) {
    acceptInvites(ns);

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
