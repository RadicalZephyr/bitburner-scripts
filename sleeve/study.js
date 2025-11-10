import { parseFlags } from 'util/flags';
const FLAGS = [
    ['course', 'Algorithms'],
    ['help', false],
];
export function autocomplete(data, args) {
    data.flags(FLAGS);
    const secondLast = args.at(-2);
    const last = args.at(-1);
    const courseFlag = '--course';
    const courses = courseTypes(data.enums).map((course) => `'${course}'`);
    if (last === courseFlag)
        return courses;
    if (secondLast === courseFlag)
        return courses.filter((c) => c.startsWith(last));
    return [];
}
export async function main(ns) {
    const flags = await parseFlags(ns, FLAGS);
    if (flags.help || !isCourse(ns, flags.course)) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

Set sleeves to study at a university.

Example:
  > run ${ns.getScriptName()}

OPTIONS
  --course Which course of study to start
  --help   Show this help message
`);
        return;
    }
    studyAtUniversity(ns, flags.course);
}
function studyAtUniversity(ns, course) {
    const numSleeves = ns.sleeve.getNumSleeves();
    for (let i = 0; i < numSleeves; i++) {
        if (!ns.sleeve.travel(i, 'Volhaven'))
            throw new Error('Failed to travel to Volhaven to study.');
        if (!ns.sleeve.setToUniversityCourse(i, 'ZB Institute of Technology', course))
            throw new Error(`failed to study ${course} at ZBU`);
    }
}
function isCourse(ns, course) {
    const courses = new Set(courseTypes(ns.enums));
    return courses.has(course);
}
function courseTypes(enums) {
    return [
        enums.UniversityClassType.computerScience,
        enums.UniversityClassType.dataStructures,
        enums.UniversityClassType.networks,
        enums.UniversityClassType.algorithms,
        enums.UniversityClassType.management,
        enums.UniversityClassType.leadership,
    ];
}
