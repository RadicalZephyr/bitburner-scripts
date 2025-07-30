import type {
    AutocompleteData,
    CompanyName,
    CompanyPositionInfo,
    Player,
    NS,
} from 'netscript';
import { MEM_TAG_FLAGS } from 'services/client/memory_tag';
import { FlagsSchema } from 'util/flags';

import { CONFIG } from 'automation/config';

import { Toggle, FocusToggle } from 'util/focus';
import {
    KARMA_HEIGHT,
    STATUS_WINDOW_HEIGHT,
    STATUS_WINDOW_WIDTH,
} from 'util/ui';

const FLAGS = [
    ['focus', false],
    ['help', false],
] satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return [];
}

export async function main(ns: NS) {
    const flags = ns.flags([...FLAGS, ...MEM_TAG_FLAGS]);

    if (flags.help || typeof flags.focus !== 'boolean') {
        ns.print(`
USAGE: run ${ns.getScriptName()}

Work for companies until reaching the reputation needed for their faction invite.

OPTIONS
  --help           Show this help message

CONFIGURATION
  AUTO_companyRepForFaction  Sets the target reputation for getting invited to the company faction.
`);
        return;
    }

    ns.disableLog('ALL');
    ns.clearLog();

    ns.ui.openTail();
    ns.ui.resizeTail(STATUS_WINDOW_WIDTH, KARMA_HEIGHT);
    const [ww] = ns.ui.windowSize();
    ns.ui.moveTail(
        ww - STATUS_WINDOW_WIDTH,
        STATUS_WINDOW_HEIGHT + KARMA_HEIGHT,
    );

    const focus = new Toggle(ns, flags.focus as boolean);
    ns.printRaw(<FocusToggle ns={ns} focus={focus} />);
    ns.ui.renderTail();

    await workForCompanies(ns, focus);
    ns.tprint('finished company work');
}

class Company {
    name: CompanyName;
    rep: number;

    constructor(ns: NS, name: CompanyName) {
        this.name = name;
        this.rep = ns.singularity.getCompanyRep(name);
    }
}

async function workForCompanies(ns: NS, focus: Toggle) {
    const cmpEnum = ns.enums.CompanyName;
    const companies: CompanyName[] = [
        cmpEnum.BachmanAndAssociates,
        cmpEnum.BladeIndustries,
        cmpEnum.ClarkeIncorporated,
        cmpEnum.ECorp,
        cmpEnum.FourSigma,
        cmpEnum.FulcrumTechnologies,
        cmpEnum.KuaiGongInternational,
        cmpEnum.MegaCorp,
        cmpEnum.NWO,
        cmpEnum.OmniTekIncorporated,
    ];

    const sing = ns.singularity;

    while (true) {
        const myJobs = ns.getPlayer().jobs;

        const unfinished = companies
            .map((c) => new Company(ns, c))
            .filter((c) => c.rep < CONFIG.companyRepForFaction);

        if (unfinished.length === 0) return;

        unfinished.sort((a, b) => a.rep - b.rep);
        const target = unfinished[0];

        const job = bestJob(ns, target.name);
        if (myJobs[target.name] !== job.name) {
            if (!sing.applyToCompany(target.name, job.field)) {
                ns.print(`WARN: failed to apply to ${target.name}`);
            }
        }

        if (!sing.workForCompany(target.name, focus.value)) {
            ns.print(`WARN: failed to start work for ${target.name}`);
            return;
        }

        await ns.asleep(60_000);
    }
}

function bestJob(ns: NS, c: CompanyName) {
    const sing = ns.singularity;

    const favor = sing.getCompanyFavor(c);
    const player = ns.getPlayer();

    const companyRep = sing.getCompanyRep(c);

    const jobs = sing
        .getCompanyPositions(c)
        .map((j) => {
            const jobInfo = sing.getCompanyPositionInfo(c, j);
            const gains = ns.formulas.work.companyGains(player, c, j, favor);
            return {
                name: j,
                ...jobInfo,
                ...gains,
            };
        })
        .filter((j) => {
            return isHireable(player, companyRep, j);
        })
        .sort((a, b) => b.reputation - a.reputation);

    return jobs[0];
}

function isHireable(
    player: Player,
    companyRep: number,
    info: CompanyPositionInfo,
) {
    if (companyRep < info.requiredReputation) return false;
    for (const skill in player.skills) {
        if (player[skill] < info.requiredSkills[skill]) return false;
    }
    return true;
}
