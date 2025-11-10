import { parseFlags } from 'util/flags';
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
];
const PRESETS = {
    'black-ops': [
        "Blade's Intuition",
        'Digital Observer',
        'Overclock',
        'Reaper',
        'Evasive System',
        'Hyperdrive',
    ],
    'late-game': ['Reaper', 'Evasive System', 'Hands of Midas', 'Hyperdrive'],
};
const FLAGS = [
    ['skill', []],
    ['preset', []],
    ['help', false],
];
export function autocomplete(data, args) {
    data.flags(FLAGS);
    const skillFlag = '--skill';
    const presetFlag = '--preset';
    const last = args.at(-1);
    if (last === skillFlag)
        return SKILLS.map((s) => `"${s}"`);
    if (last === presetFlag)
        return Object.keys(PRESETS);
    const secondLast = args.at(-2);
    if (secondLast === skillFlag)
        return SKILLS.map((s) => `"${s}"`).filter((s) => s.startsWith(last));
    if (secondLast === presetFlag)
        return Object.keys(PRESETS).filter((p) => p.startsWith(last));
    return [];
}
export async function main(ns) {
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
  BLADE_skillBuyRateMs        How many milliseconds to sleep between buying skill levels
  BLADE_skillBuySpendPercent  How much of current skill points to spend on skills per purchase
`);
        return;
    }
    ns.disableLog('asleep');
    ns.disableLog('sleep');
    const skills = buildSkills(ns, flags.skill, flags.preset);
    await buySkills(ns, skills);
}
function buildSkills(ns, skills, presets) {
    const _allSkills = ns.bladeburner.getSkillNames();
    if (skills.length === 0 && presets.length === 0)
        return _allSkills;
    const allSkills = new Set(_allSkills);
    const isSkill = (s) => allSkills.has(s);
    const skillsToBuy = new Set();
    for (const s of skills) {
        const skill = s.trim();
        if (isSkill(skill)) {
            skillsToBuy.add(skill);
        }
        else {
            ns.tprint(`WARN: Unknown Bladeburner skill: '${skill}'`);
        }
    }
    for (const p of presets) {
        const preset = p.trim().toLocaleLowerCase();
        if (!isPreset(preset)) {
            ns.tprint(`WARN: unknown preset: '${preset}'`);
            continue;
        }
        const presetSkills = PRESETS[preset].filter(isSkill);
        for (const s of presetSkills) {
            const skill = s.trim();
            if (isSkill(skill)) {
                skillsToBuy.add(skill);
            }
            else {
                ns.tprint(`WARN: Unknown Bladeburner skill '${skill}' in preset '${preset}'`);
            }
        }
    }
    return Array.from(skillsToBuy);
}
function isPreset(name) {
    return Object.hasOwn(PRESETS, name);
}
async function buySkills(ns, skillNames) {
    while (true) {
        const skills = skillNames
            .map((s) => new Skill(ns, s))
            .filter((s) => Number.isFinite(s.cost) && s.levelsToBuy > 0)
            .sort((a, b) => a.cost - b.cost);
        if (skills.length < 1)
            throw new Error(`empty skills list!`);
        const skillToBuy = skills[0];
        const skillDescription = `${skillToBuy.name} ${skillToBuy.level + skillToBuy.levelsToBuy} for ${skillToBuy.cost}`;
        ns.print(`INFO: trying to buy ${skillDescription}`);
        await untilPoints(ns, skillToBuy.cost);
        if (!ns.bladeburner.upgradeSkill(skillToBuy.name, skillToBuy.levelsToBuy))
            throw new Error(`ERROR: failed to buy ${skillDescription}`);
        ns.print(`SUCCESS: bought ${skillDescription}`);
        await ns.asleep(CONFIG.skillBuyRateMs);
    }
}
class Skill {
    name;
    level;
    levelsToBuy;
    cost;
    constructor(ns, name) {
        this.name = name;
        this.level = ns.bladeburner.getSkillLevel(name);
        const totalSkillPoints = ns.bladeburner.getSkillPoints();
        const fraction = skillMaxUpgradeCount(ns, this.name, this.level, Math.round(totalSkillPoints * CONFIG.skillBuySpendPercent));
        this.levelsToBuy = Math.min(Math.max(1, fraction), skillUpgradeLimit(this.name, this.level));
        if (this.levelsToBuy > 0) {
            this.cost = ns.bladeburner.getSkillUpgradeCost(name, this.levelsToBuy);
        }
        else {
            this.cost = Infinity;
        }
    }
}
async function untilPoints(ns, points) {
    while (ns.bladeburner.getSkillPoints() < points) {
        await ns.asleep(1_000);
    }
}
function skillUpgradeLimit(name, level) {
    if (name === 'Overclock')
        return 90 - level;
    return Number.MAX_SAFE_INTEGER - level;
}
function skillMaxUpgradeCount(ns, name, level, skillPoints) {
    if (ns.fileExists('Formulas.exe', 'home')) {
        return ns.formulas.bladeburner.skillMaxUpgradeCount(name, level, skillPoints);
    }
    else {
        return calculateMaxUpgradeCount(level, skillPoints);
    }
}
function calculateMaxUpgradeCount(currentLevel, cost) {
    // Use highest values so we underestimate how many we can buy
    const baseCost = 3;
    const costInc = 3;
    const m = -baseCost - costInc * currentLevel + costInc / 2;
    const delta = Math.sqrt(m * m + 2 * costInc * cost);
    const result = Math.round((m + delta) / costInc);
    /**
     * Due to floating-point rounding and edge-cases, we cannot ensure that rounding x_1 will give us the correct
     * integer. In other words, we cannot be sure that x_1 is within 0.5 of the integer value we want. However, we can
     * be sure that it is within 1 of the value we want, which means that checking the numbers above and below the
     * rounded value are sufficient to find our correct integer.
     */
    const costOfResultPlus1 = calculateCost(currentLevel, result + 1);
    if (costOfResultPlus1 <= cost) {
        return result + 1;
    }
    const costOfResult = calculateCost(currentLevel, result);
    if (costOfResult <= cost) {
        return result;
    }
    return result - 1;
}
function calculateCost(currentLevel, count = 1) {
    // Use highest values so we underestimate how many we can buy
    const baseCost = 3;
    const costInc = 3;
    const actualCount = currentLevel + count - currentLevel;
    return Math.round(actualCount
        * (baseCost + costInc * (currentLevel + (actualCount - 1) / 2)));
}
