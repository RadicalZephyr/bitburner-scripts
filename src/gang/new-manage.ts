import type { NS } from "netscript";

import { CONFIG } from "gang/config";

const MAX_GANG_MEMBERS = 12;

const NAMES = [
    "Hamma",
    "Ruwen",

    "Sift",
    "Lylan",

    "Madda",
    "Padda",

    "Overlord",
    "Uruziel",

    "Kysandra",
    "Tremain",

    "Eiru",
    "Miranda",
];

export async function main(ns: NS) {
    const flags = ns.flags([
        ["help", false],
    ]);

    if (flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

Automate gang recruitment and task assignments.

Example:
> run ${ns.getScriptName()}

CONFIG VALUES
GANG_ascendThreshold   Ascension multiplier required to ascend
GANG_trainingPercent   Fraction of members training
GANG_maxWantedPenalty  Maximum wanted penalty before cooling
GANG_minWantedLevel    Wanted level where heating resumes
GANG_jobCheckInterval  Delay between evaluations
`);
        return;
    }

    let deltaT = 0;
    while (true) {


        deltaT = await ns.gang.nextUpdate();
    }
}
