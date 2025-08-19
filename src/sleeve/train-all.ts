import type {
    NS,
    AutocompleteData,
    GymType,
    UniversityClassType,
} from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';

const FLAGS = [['help', false]] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return [];
}

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    if (flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

Train all skills with sleeves.

Example:
  > run ${ns.getScriptName()}

OPTIONS
  --help   Show this help message
`);
        return;
    }

    trainAllSkills(ns);
}

function trainAllSkills(ns: NS) {
    const numSleeves = ns.sleeve.getNumSleeves();

    let i = 0;

    if (numSleeves < 1) return;
    sleeveWorkout(ns, i, 'str');
    i += 1;

    if (numSleeves < 2) return;
    sleeveWorkout(ns, i, 'def');
    i += 1;

    if (numSleeves < 3) return;
    sleeveWorkout(ns, i, 'dex');
    i += 1;

    if (numSleeves < 4) return;
    sleeveWorkout(ns, i, 'agi');
    i += 1;

    if (numSleeves < 5) return;
    sleeveStudy(ns, i, 'Algorithms');
    i += 1;

    if (numSleeves < 6) return;
    sleeveStudy(ns, i, 'Leadership');
    i += 1;

    if (numSleeves < 7) return;
    sleeveStudy(ns, i, 'Algorithms');
    i += 1;

    if (numSleeves < 8) return;
    sleeveStudy(ns, i, 'Leadership');
    i += 1;
}

function sleeveWorkout(ns: NS, i: number, stat: GymType | `${GymType}`) {
    if (!ns.sleeve.travel(i, 'Sector-12'))
        throw new Error(
            `Sleeve ${i} failed to travel to Sector-12 to workout.`,
        );
    if (!ns.sleeve.setToGymWorkout(i, 'Powerhouse Gym', stat))
        throw new Error(
            `Sleeve ${i} failed to start working out ${stat} at Powerhouse Gym`,
        );
}

function sleeveStudy(
    ns: NS,
    i: number,
    courseName: UniversityClassType | `${UniversityClassType}`,
) {
    if (!ns.sleeve.travel(i, 'Volhaven'))
        throw new Error(`Sleeve ${i} failed to travel to Volhave to study.`);

    if (
        !ns.sleeve.setToUniversityCourse(
            i,
            'ZB Institute of Technology',
            'Leadership',
        )
    )
        throw new Error(
            `Sleeve ${i} failed to start studying ${courseName} at ZBU`,
        );
}
