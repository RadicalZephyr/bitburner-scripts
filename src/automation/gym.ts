import type {
    NS,
    AutocompleteData,
    GymType,
    GymLocationName,
    LocationName,
    NSEnums,
} from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';

import { CONFIG } from 'automation/config';
import { travelToCityForLocation } from 'automation/travel';

const FLAGS = [
    ['gym', ''],
    ['help', false],
] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData, args: string[]): string[] {
    data.flags(FLAGS);

    const secondLast = args.at(-2);
    const last = args.at(-1);

    const gymFlag = `--gym`;
    const gymLocs = gymLocations(data.enums).map((g) => `'${g}'`);

    if (last === gymFlag) return gymLocs;

    if (secondLast === gymFlag) {
        const c = gymLocs.filter((g) => g.startsWith(last));
        return c;
    }

    return [];
}

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    const powerhouseGym = ns.enums.LocationName.Sector12PowerhouseGym;
    const gym = flags.gym !== '' ? flags.gym : powerhouseGym;

    const targetLevel = flags._[0];
    if (
        flags.help
        || typeof targetLevel !== 'number'
        || targetLevel <= 0
        || !isGymLocation(ns, gym)
    ) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()} LEVEL

Train all combat stats in the gym to the specified level.

Example:
> run ${ns.getScriptName()} 300

OPTIONS
  --gym    Gym to train at
  --help   Show this help message

CONFIGURATION
  AUTO_combatTrainTimeMs  Number of milliseconds to train one stat before switching
`);
        return;
    }

    await trainCombat(ns, gym, targetLevel);
}

/**
 * Train all combat stats to the target level.
 *
 * @param ns          - Netscript API instance
 * @param targetLevel - Level to train all combat stats to
 */
export async function trainCombat(
    ns: NS,
    gymLocation: `${GymLocationName}`,
    targetLevel: number,
) {
    const GymType = ns.enums.GymType;

    travelToCityForLocation(ns, gymLocation as LocationName);

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
        gymWorkout(ns, gymLocation, GymType[skill.name]);

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

function isGymLocation(ns: NS, location: string): location is GymLocationName {
    const locs = new Set(gymLocations(ns.enums));
    return locs.has(location as LocationName);
}

function gymLocations(enums: NSEnums): LocationName[] {
    return [
        enums.LocationName.AevumCrushFitnessGym,
        enums.LocationName.AevumSnapFitnessGym,
        enums.LocationName.Sector12IronGym,
        enums.LocationName.Sector12PowerhouseGym,
        enums.LocationName.VolhavenMilleniumFitnessGym,
    ];
}
