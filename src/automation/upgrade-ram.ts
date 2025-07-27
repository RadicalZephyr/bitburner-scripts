import type { NS } from 'netscript';
import { MEM_TAG_FLAGS } from 'services/client/memory_tag';

export async function main(ns: NS) {
    ns.flags(MEM_TAG_FLAGS);

    while (true) {
        tryUpgradeRam(ns);
        tryUpgradeCores(ns);
        await ns.sleep(10_000);
    }
}

function tryUpgradeRam(ns: NS) {
    const myMoney = ns.getServerMoneyAvailable('home');
    if (ns.singularity.getUpgradeHomeRamCost() < myMoney) {
        ns.singularity.upgradeHomeRam();
    }
}

function tryUpgradeCores(ns: NS) {
    const myMoney = ns.getServerMoneyAvailable('home');
    if (ns.singularity.getUpgradeHomeCoresCost() < myMoney) {
        ns.singularity.upgradeHomeCores();
    }
}
