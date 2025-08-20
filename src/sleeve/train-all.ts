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

type Workout = `${GymType}`;
type UniversityClass = `${UniversityClassType}`;
type Role = GymType | Workout | UniversityClassType | UniversityClass;

function trainAllSkills(ns: NS) {
    const roles: Role[] = [
        'str',
        'def',
        'dex',
        'agi',
        'Algorithms',
        'Leadership',
        'Algorithms',
        'Leadership',
    ];

    const gymRole: Workout[] = ['str', 'def', 'dex', 'agi'];
    const isWorkout = (role: Role): role is Workout =>
        gymRole.some((gr) => gr === role);

    const courseRole: UniversityClass[] = [
        'Computer Science',
        'Data Structures',
        'Networks',
        'Algorithms',
        'Management',
        'Leadership',
    ];
    const isCourse = (role: Role): role is UniversityClass =>
        courseRole.some((cr) => cr === role);

    const numSleeves = ns.sleeve.getNumSleeves();

    for (let i = 0; i < numSleeves; i++) {
        const role = roles[i];
        if (isWorkout(role)) {
            sleeveWorkout(ns, i, role);
        } else if (isCourse(role)) {
            sleeveStudy(ns, i, role);
        } else {
            ns.tprint(`Could not find role '${roles[i]}' for sleeve ${i}`);
        }
    }
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
            courseName,
        )
    )
        throw new Error(
            `Sleeve ${i} failed to start studying ${courseName} at ZBU`,
        );
}
