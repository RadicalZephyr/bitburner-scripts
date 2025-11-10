import { parseFlags } from 'util/flags';
import { canAfford } from 'util/money';
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

Buy augments for sleeves.

Example:
  > run ${ns.getScriptName()}

OPTIONS
  --help   Show this help message
`);
        return;
    }
    await watchForAugments(ns);
}
async function watchForAugments(ns) {
    while (true) {
        const numSleeves = ns.sleeve.getNumSleeves();
        for (let i = 0; i < numSleeves; i++) {
            if (ns.sleeve.getSleeve(i).shock > 0)
                continue;
            buyAugs(ns, i);
        }
        await ns.asleep(1000);
    }
}
function buyAugs(ns, sleeve) {
    const augs = ns.sleeve.getSleevePurchasableAugs(sleeve);
    for (const aug of augs) {
        if (canAfford(ns, aug.cost)) {
            const res = ns.sleeve.purchaseSleeveAug(sleeve, aug.name);
            if (!res) {
                ns.print(`WARN: tried to buy sleeve ${sleeve} '${aug.name}' but failed.`);
            }
        }
    }
}
