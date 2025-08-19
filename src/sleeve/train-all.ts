import type { NS, AutocompleteData } from 'netscript';
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
    ns.sleeve.travel(i, 'Sector-12');
    ns.sleeve.setToGymWorkout(i, 'Powerhouse Gym', 'str');
    i += 1;

    if (numSleeves < 2) return;
    ns.sleeve.travel(i, 'Sector-12');
    ns.sleeve.setToGymWorkout(i, 'Powerhouse Gym', 'def');
    i += 1;

    if (numSleeves < 3) return;
    ns.sleeve.travel(i, 'Sector-12');
    ns.sleeve.setToGymWorkout(i, 'Powerhouse Gym', 'dex');
    i += 1;

    if (numSleeves < 4) return;
    ns.sleeve.travel(i, 'Sector-12');
    ns.sleeve.setToGymWorkout(i, 'Powerhouse Gym', 'agi');
    i += 1;

    if (numSleeves < 5) return;
    ns.sleeve.travel(i, 'Volhaven');
    ns.sleeve.setToUniversityCourse(
        i,
        'ZB Institute of Technology',
        'Algorithms',
    );
    i += 1;

    if (numSleeves < 6) return;
    ns.sleeve.travel(i, 'Volhaven');
    ns.sleeve.setToUniversityCourse(
        i,
        'ZB Institute of Technology',
        'Leadership',
    );
    i += 1;

    if (numSleeves < 7) return;
    ns.sleeve.travel(i, 'Volhaven');
    ns.sleeve.setToUniversityCourse(
        i,
        'ZB Institute of Technology',
        'Algorithms',
    );
    i += 1;

    if (numSleeves < 8) return;
    ns.sleeve.travel(i, 'Volhaven');
    ns.sleeve.setToUniversityCourse(
        i,
        'ZB Institute of Technology',
        'Leadership',
    );
    i += 1;
}
