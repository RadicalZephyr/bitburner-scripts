import type { NS } from "netscript";

export async function main(ns: NS) {
    const taskNames = ns.gang.getTaskNames();

    const gangData = `
export const taskNames = ${JSON.stringify(taskNames)};
`;
    ns.write("/gang/data.js", gangData);
}
