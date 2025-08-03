import type { NS, AutocompleteData, GymType, GymLocationName } from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';
import { CONFIG } from 'automation/config';
import { travelTo } from 'automation/travel';

const FLAGS = [['help', false]] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return [];
}

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    const targetLevel = flags._[0];
    if (flags.help || typeof targetLevel !== 'number') {
        ns.tprint(`
USAGE: run ${ns.getScriptName()} LEVEL

Train all combat stats in the gym to the specified level.

Example:
> run ${ns.getScriptName()} 300

OPTIONS
  --help   Show this help message

CONFIGURATION
  AUTO_combatTrainTimeMs  Number of milliseconds to train one stat before switching
`);
        return;
    }

    await trainCombat(ns, targetLevel);
}

/**
 * Train all combat stats to the target level.
 *
 * @param ns          - Netscript API instance
 * @param targetLevel - Level to train all combat stats to
 */
export async function trainCombat(ns: NS, targetLevel: number) {
    const powerhouseGym = ns.enums.LocationName.Sector12PowerhouseGym;
    const GymType = ns.enums.GymType;

    travelTo(ns, ns.enums.CityName.Sector12);

    const combatSkills = new Set([
        'strength',
        'defense',
        'dexterity',
        'agility',
    ]);
    while (true) {
        const playerSkills = ns.getPlayer().skills;
        const skillsToTrain = Object.keys(playerSkills)
            .filter((s) => combatSkills.has(s))
            .map((s) => {
                return { name: s, level: playerSkills[s] };
            })
            .filter((s) => s.level < targetLevel);

        if (skillsToTrain.length === 0) return;

        skillsToTrain.sort((a, b) => a.level - b.level);

        const skill = skillsToTrain[0];
        gymWorkout(ns, powerhouseGym, GymType[skill.name]);

        await ns.sleep(CONFIG.combatTrainTimeMs);
    }
}

function gymWorkout(
    ns: NS,
    location: GymLocationName | `${GymLocationName}`,
    stat: GymType,
) {
    if (!ns.singularity.gymWorkout(location, stat, false))
        throw new Error(`failed to workout ${stat} at ${location}`);
}
