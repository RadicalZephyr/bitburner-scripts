import type { NS, AutocompleteData, BladeburnerSkillName } from '@ns';
import { FlagsSchema, parseFlags } from 'util/flags';

import { CONFIG } from 'bladeburner/config';

const SKILLS = [
    "Blade's Intuition",
    'Cloak',
    'Short-Circuit',
    'Digital Observer',
    'Tracer',
    'Overclock',
    'Reaper',
    'Evasive System',
    'Datamancer',
    "Cyber's Edge",
    'Hands of Midas',
    'Hyperdrive',
] as const satisfies readonly `${BladeburnerSkillName}`[];

const PRESETS = {
    'black-ops': [
        "Blade's Intuition",
        'Digital Observer',
        'Overclock',
        'Reaper',
        'Evasive System',
        'Hyperdrive',
    ],
    'late-game': ['Hands of Midas', 'Hyperdrive'],
} as const satisfies Record<string, readonly `${BladeburnerSkillName}`[]>;

const FLAGS = [
    ['skill', []],
    ['preset', [] as string[]],
    ['help', false],
] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData, args: string[]): string[] {
    data.flags(FLAGS);

    const skillFlag = '--skill';
    const presetFlag = '--preset';

    const last = args.at(-1);
    if (last === skillFlag) return SKILLS.map((s) => `"${s}"`);
    if (last === presetFlag) return Object.keys(PRESETS);

    const secondLast = args.at(-2);
    if (secondLast === skillFlag)
        return SKILLS.map((s) => `"${s}"`).filter((s) => s.startsWith(last));
    if (secondLast === presetFlag)
        return Object.keys(PRESETS).filter((p) => p.startsWith(last));

    return [];
}

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    if (flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

Continuously buy the cheapest Bladeburner skill available.

If no skills or presets are specified then all skills are purchased.

Example:
  > run ${ns.getScriptName()} --skill Hyperdrive
  > run ${ns.getScriptName()} --preset black-ops

OPTIONS
  --skill      Add a skill to buy (can be specified multiple times)
  --preset     Add a predefined group of skills to buy (can be specified multiple times)
  --help       Show this help message

CONFIGURATION
  BLADE_skillBuyAmount  How many skill levels to buy each cycle
  BLADE_skillBuyRateMs  How many milliseconds to sleep between buying skill levels
`);
        return;
    }

    ns.disableLog('asleep');
    ns.disableLog('sleep');

    const skills = buildSkills(ns, flags.skill, flags.preset);
    await buySkills(ns, skills);
}

function buildSkills(
    ns: NS,
    skills: string[],
    presets: string[],
): `${BladeburnerSkillName}`[] {
    const _allSkills = ns.bladeburner.getSkillNames();
    if (skills.length === 0 && presets.length === 0) return _allSkills;

    const allSkills = new Set(_allSkills as string[]);
    const isSkill = (s: string): s is `${BladeburnerSkillName}` =>
        allSkills.has(s);

    const skillsToBuy = new Set<`${BladeburnerSkillName}`>();
    for (const s of skills) {
        const skill = s.trim();
        if (isSkill(skill)) {
            skillsToBuy.add(skill);
        } else {
            ns.tprint(`WARN: Unknown Bladeburner skill: '${skill}'`);
        }
    }

    for (const p of presets) {
        const preset = p.trim().toLocaleLowerCase();
        if (!(preset in PRESETS)) {
            ns.tprint(`WARN: unknown preset: '${preset}'`);
            continue;
        }

        const presetSkills = PRESETS[preset].filter(isSkill);
        for (const s of presetSkills) {
            const skill = s.trim();
            if (isSkill(skill)) {
                skillsToBuy.add(skill);
            } else {
                ns.tprint(
                    `WARN: Unknown Bladeburner skill '${skill}' in preset '${preset}'`,
                );
            }
        }
    }

    return Array.from(skillsToBuy);
}

async function buySkills(ns: NS, skillNames: `${BladeburnerSkillName}`[]) {
    while (true) {
        const skills = skillNames
            .map((s) => new Skill(ns, s))
            .filter((s) => Number.isFinite(s.cost) && s.levelsToBuy > 0)
            .sort((a, b) => a.cost - b.cost);

        if (skills.length < 1) throw new Error(`empty skills list!`);

        const skillToBuy = skills[0];
        const skillDescription = `${skillToBuy.name} ${skillToBuy.level + skillToBuy.levelsToBuy} for ${skillToBuy.cost}`;
        ns.print(`INFO: trying to buy ${skillDescription}`);

        await untilPoints(ns, skillToBuy.cost);

        if (
            !ns.bladeburner.upgradeSkill(
                skillToBuy.name,
                skillToBuy.levelsToBuy,
            )
        )
            throw new Error(`ERROR: failed to buy ${skillDescription}`);

        ns.print(`SUCCESS: bought ${skillDescription}`);

        await ns.asleep(CONFIG.skillBuyRateMs);
    }
}

type SkillName = BladeburnerSkillName | `${BladeburnerSkillName}`;

class Skill {
    name: SkillName;
    level: number;
    levelsToBuy: number;
    cost: number;

    constructor(ns: NS, name: SkillName) {
        this.name = name;
        this.level = ns.bladeburner.getSkillLevel(name);
        this.levelsToBuy = Math.min(
            CONFIG.skillBuyAmount,
            skillMaxUpgradeCount(this.name, this.level),
        );
        this.cost = ns.bladeburner.getSkillUpgradeCost(name, this.levelsToBuy);
    }
}

async function untilPoints(ns: NS, points: number) {
    while (ns.bladeburner.getSkillPoints() < points) {
        await ns.asleep(1_000);
    }
}

function skillMaxUpgradeCount(name: SkillName, level: number): number {
    if (name === 'Overclock') return 90 - level;
    return Number.MAX_SAFE_INTEGER - level;
}
