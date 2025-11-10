import { parseFlags } from 'util/flags';
const FLAGS = [['help', false]];
export function autocomplete(data) {
    data.flags(FLAGS);
    return [];
}
export async function main(ns) {
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
function trainAllSkills(ns) {
    const roles = [
        'str',
        'def',
        'dex',
        'agi',
        'Algorithms',
        'Leadership',
        'Algorithms',
        'Leadership',
    ];
    const gymRole = ['str', 'def', 'dex', 'agi'];
    const isWorkout = (role) => gymRole.some((gr) => gr === role);
    const courseRole = [
        'Computer Science',
        'Data Structures',
        'Networks',
        'Algorithms',
        'Management',
        'Leadership',
    ];
    const isCourse = (role) => courseRole.some((cr) => cr === role);
    const numSleeves = ns.sleeve.getNumSleeves();
    for (let i = 0; i < numSleeves; i++) {
        const role = roles[i];
        if (isWorkout(role)) {
            sleeveWorkout(ns, i, role);
        }
        else if (isCourse(role)) {
            sleeveStudy(ns, i, role);
        }
        else {
            ns.tprint(`Could not find role '${roles[i]}' for sleeve ${i}`);
        }
    }
}
function sleeveWorkout(ns, i, stat) {
    if (!ns.sleeve.travel(i, 'Sector-12'))
        throw new Error(`Sleeve ${i} failed to travel to Sector-12 to workout.`);
    if (!ns.sleeve.setToGymWorkout(i, 'Powerhouse Gym', stat))
        throw new Error(`Sleeve ${i} failed to start working out ${stat} at Powerhouse Gym`);
}
function sleeveStudy(ns, i, courseName) {
    if (!ns.sleeve.travel(i, 'Volhaven'))
        throw new Error(`Sleeve ${i} failed to travel to Volhave to study.`);
    if (!ns.sleeve.setToUniversityCourse(i, 'ZB Institute of Technology', courseName))
        throw new Error(`Sleeve ${i} failed to start studying ${courseName} at ZBU`);
}
