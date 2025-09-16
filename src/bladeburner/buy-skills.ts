import type { NS, AutocompleteData, BladeburnerSkillName } from '@ns';
import { FlagsSchema, parseFlags } from 'util/flags';

import { CONFIG } from 'bladeburner/config';

const FLAGS = [
    ['black-ops', false],
    ['help', false],
] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return [];
}

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    if (flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

Continuously buy the cheapest Bladeburner skill available.

Example:
  > run ${ns.getScriptName()}

OPTIONS
  --black-ops  Prioritize skills for Black Ops success
  --help       Show this help message

CONFIGURATION
  BLADE_skillBuyRateMs  How many milliseconds to sleep between buying skill levels
`);
        return;
    }

    ns.disableLog('asleep');
    ns.disableLog('sleep');

    await buySkills(ns, flags['black-ops']);
}

async function buySkills(ns: NS, blackOps: boolean) {
    while (true) {
        const skillNames = blackOps
            ? blackOpsSkills()
            : ns.bladeburner.getSkillNames();

        const skills = skillNames
            .map((s) => new Skill(ns, s))
            .sort((a, b) => a.cost - b.cost);

        if (skills.length < 1) throw new Error(`empty skills list!`);

        const skillToBuy = skills[0];
        const skillDescription = `${skillToBuy.name} ${skillToBuy.level + 1} for ${skillToBuy.cost}`;
        ns.print(`INFO: trying to buy ${skillDescription}`);

        await untilPoints(ns, skillToBuy.cost);

        if (!ns.bladeburner.upgradeSkill(skillToBuy.name, 1))
            throw new Error(`ERROR: failed to buy ${skillDescription}`);

        ns.print(`SUCCESS: bought ${skillDescription}`);

        await ns.asleep(CONFIG.skillBuyRateMs);
    }
}

type SkillName = BladeburnerSkillName | `${BladeburnerSkillName}`;

class Skill {
    name: SkillName;
    level: number;
    cost: number;

    constructor(ns: NS, name: SkillName) {
        this.name = name;
        this.level = ns.bladeburner.getSkillLevel(name);
        this.cost = ns.bladeburner.getSkillUpgradeCost(name);
    }
}

async function untilPoints(ns: NS, points: number) {
    while (ns.bladeburner.getSkillPoints() < points) {
        await ns.asleep(1_000);
    }
}

function blackOpsSkills(): SkillName[] {
    return [
        "Blade's Intuition",
        'Digital Observer',
        'Overclock',
        'Reaper',
        'Evasive System',
        'Hyperdrive',
    ];
}
