export async function main(ns) {
    const taskNames = ns.gang.getTaskNames();
    const gangData = `
export const taskNames = ${JSON.stringify(taskNames)};
`;
    ns.write("/gang/data.js", gangData);
}
