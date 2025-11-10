import { parseFlags } from 'util/flags';
import { connectTo } from 'automation/connect';
import { canInstallBackdoor, needsBackdoor } from 'util/backdoor';
import { FACTION_SERVERS } from 'util/faction-servers';
export async function main(ns) {
    await parseFlags(ns, []);
    while (true) {
        if (!FACTION_SERVERS.some((h) => needsBackdoor(ns.getServer(h)))) {
            ns.print('SUCCESS: finished backdooring all faction servers!');
            return;
        }
        const factionMissing = backdoorableFactionServers(ns);
        const startingHost = ns.singularity.getCurrentServer();
        for (const host of factionMissing) {
            await connectTo(ns, host);
            await ns.singularity.installBackdoor();
            await ns.asleep(0);
        }
        const currentHost = ns.singularity.getCurrentServer();
        if (startingHost !== currentHost) {
            await connectTo(ns, startingHost);
        }
        await ns.sleep(10_000);
    }
}
function backdoorableFactionServers(ns) {
    const factionMissing = [];
    for (const host of FACTION_SERVERS) {
        const info = ns.getServer(host);
        if (needsBackdoor(info) && canInstallBackdoor(ns, info)) {
            factionMissing.push(host);
        }
    }
    return factionMissing;
}
