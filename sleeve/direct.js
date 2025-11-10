import { parseFlags } from 'util/flags';
const FLAGS = [['help', false]];
export function autocomplete(data) {
    data.flags(FLAGS);
    return [];
}
export async function main(ns) {
    const flags = await parseFlags(ns, FLAGS);
    if (flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

Prepares sleeves for work by doing shock recovery and synchronization.

Example:
  > run ${ns.getScriptName()}

OPTIONS
  --help   Show this help message
`);
        return;
    }
    await directSleeves(ns);
}
async function directSleeves(ns) {
    while (true) {
        const numSleeves = ns.sleeve.getNumSleeves();
        let shockedSleeves = 0;
        let syncingSleeves = 0;
        for (let i = 0; i < numSleeves; i++) {
            const sleeve = ns.sleeve.getSleeve(i);
            if (sleeve.shock > 0) {
                ns.sleeve.setToShockRecovery(i);
                shockedSleeves += 1;
            }
            else if (sleeve.sync < 100) {
                ns.sleeve.setToSynchronize(i);
                syncingSleeves += 1;
            }
            else {
                ns.sleeve.setToIdle(i);
            }
        }
        if (shockedSleeves === 0 && syncingSleeves === 0)
            return;
        await ns.sleep(1000);
    }
}
