import type { NS, AutocompleteData, Multipliers } from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';

import { travelTo } from 'automation/travel';

import { canAfford } from 'util/money';

type MultKey = keyof Multipliers;

const MULTIPLIERS = [
    'hacking',
    'hacking_exp',
    'strength',
    'strength_exp',
    'defense',
    'defense_exp',
    'dexterity',
    'dexterity_exp',
    'agility',
    'agility_exp',
    'charisma',
    'charisma_exp',
    'hacking_chance',
    'hacking_speed',
    'hacking_money',
    'hacking_grow',
    'company_rep',
    'faction_rep',
    'crime_money',
    'crime_success',
    'work_money',
    'hacknet_node_money',
    'hacknet_node_purchase_cost',
    'hacknet_node_ram_cost',
    'hacknet_node_core_cost',
    'hacknet_node_level_cost',
    'bladeburner_max_stamina',
    'bladeburner_stamina_gain',
    'bladeburner_analysis',
    'bladeburner_success_chance',
] as const satisfies readonly MultKey[];

const PRESETS = {
    hacking: [
        'hacking',
        'hacking_exp',
        'hacking_chance',
        'hacking_speed',
        'hacking_money',
        'hacking_grow',
    ],
    combat: [
        'strength',
        'strength_exp',
        'defense',
        'defense_exp',
        'dexterity',
        'dexterity_exp',
        'agility',
        'agility_exp',
    ],
    hacknet: [
        'hacknet_node_money',
        'hacknet_node_purchase_cost',
        'hacknet_node_ram_cost',
        'hacknet_node_core_cost',
        'hacknet_node_level_cost',
    ],
    bladeburner: [
        'bladeburner_max_stamina',
        'bladeburner_stamina_gain',
        'bladeburner_analysis',
        'bladeburner_success_chance',
    ],
} as const satisfies Record<string, MultKey[]>;

const FLAGS = [
    ['dry-run', false],
    ['mult', []],
    ['preset', [] as string[]],
    ['help', false],
] as const satisfies FlagsSchema;

export function autocomplete(
    data: AutocompleteData,
    args: string[],
): readonly string[] {
    data.flags(FLAGS);

    const multFlag = '--mult';
    const presetFlag = '--preset';

    const last = args.at(-1);
    if (last === multFlag) return MULTIPLIERS;
    if (last === presetFlag) return Object.keys(PRESETS);

    const secondLast = args.at(-2);
    if (secondLast === multFlag)
        return MULTIPLIERS.filter((m) => m.startsWith(last));
    if (secondLast === presetFlag)
        return Object.keys(PRESETS).filter((p) => p.startsWith(last));

    return [];
}

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    if (flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

Graft augments with specific multipliers. Augments are selected in order of:

 - best score
 - least time
 - least cost

If no multipliers or presets are specified then all augments will be purchased.

Will wait until any ongoing grafting finishes before beginning new grafting queue.

Example:
  > run ${ns.getScriptName()} --mult faction_rep
  > run ${ns.getScriptName()} --mult hacking --mult hacking_exp

OPTIONS
  --dry-run  Don't buy anything, just display the augments that would be chosen
  --preset   Specify a built-in bundle of related multipliers
             Available presets: ${Object.keys(PRESETS).join(', ')}
  --mult     Augmentation multipliers to filter by, may be specified multiple times
             Available multipliers: ${MULTIPLIERS.join(', ')}
  --help     Show this help message
`);
        return;
    }

    const multipliers = buildMultipliers(ns, flags.mult, flags.preset);
    await graftAugments(ns, flags['dry-run'], multipliers);

    ns.ui.openTail();
}

function buildMultipliers(
    ns: NS,
    mults: string[],
    presets: string[],
): MultKey[] {
    if (mults.length === 0 && presets.length === 0) return [...MULTIPLIERS];

    const graftableAugs = ns.grafting.getGraftableAugmentations();
    if (graftableAugs.length === 0)
        throw new Error('No graftable augmentations!');

    const exampleMultName = graftableAugs[0];
    const exampleMult = ns.singularity.getAugmentationStats(exampleMultName);
    const isMultKey = (m: string): m is MultKey =>
        Object.hasOwn(exampleMult, m);

    const multipliers: Set<MultKey> = new Set();
    for (const m of mults) {
        const mult = m.trim().toLocaleLowerCase();
        if (isMultKey(mult)) {
            multipliers.add(mult);
        } else {
            ns.tprint(`WARN: unknown multiplier: '${mult}'`);
        }
    }

    for (const p of presets) {
        const preset = p.trim().toLocaleLowerCase();
        if (!(preset in PRESETS)) {
            ns.tprint(`WARN: unknown preset: '${preset}'`);
            continue;
        }

        const presetMults = PRESETS[preset].filter(isMultKey);
        for (const pm of presetMults) {
            multipliers.add(pm);
        }
    }
    return Array.from(multipliers);
}

async function graftAugments(
    ns: NS,
    dryRun: boolean,
    mults: readonly MultKey[],
) {
    const graftableAugs = ns.grafting
        .getGraftableAugmentations()
        .map((a) => scoredAugment(ns, a, mults))
        .filter((a) => mults.some((m) => m in a));

    if (graftableAugs.length === 0) {
        ns.clearLog();
        ns.print(
            `WARN: no graftable augmetations found with desired multipliers ${mults.join(',')} `,
        );
        return;
    }

    graftableAugs.sort((a, b) => {
        if (Math.abs(b.score - a.score) > 0.001) {
            return b.score - a.score;
        } else if (Math.abs(a.installTime - b.installTime) > 1000) {
            return a.installTime - b.installTime;
        } else {
            return a.price - b.price;
        }
    });

    if (dryRun) {
        ns.disableLog('ALL');
        ns.clearLog();

        ns.print(JSON.stringify(graftableAugs, null, 2));

        return;
    }

    try {
        await ns.grafting.waitForOngoingGrafting();
    } catch (err) {
        ns.print(`ERROR: ${String(err)}`);
        ns.tprint(
            `not currently grafting, please cancel any other activities before starting grafting.`,
        );
        return;
    }

    await ns.sleep(0);
    if (ns.singularity.isBusy()) {
        ns.print(
            'WARN: Player is busy with an action, refusing to start grafting while busy.',
        );
    }

    const ownedAugs: Set<string> = new Set(
        ns.singularity.getOwnedAugmentations(true),
    );

    for (const aug of graftableAugs) {
        const result = await graftAugmentation(ns, ownedAugs, aug);

        if (result) {
            ns.print(`finished grafting ${aug.name}`);
        } else {
            ns.print(
                `failed to graft ${aug.name} or one of its pre-requisites`,
            );
        }

        await ns.sleep(1000);
    }
}

async function graftAugmentation(
    ns: NS,
    ownedAugs: Set<string>,
    aug: Augment,
): Promise<boolean> {
    const preReqs = ns.singularity.getAugmentationPrereq(aug.name);
    const graftableAugs = new Set(ns.grafting.getGraftableAugmentations());

    for (const preReqAug of preReqs) {
        if (ownedAugs.has(preReqAug)) continue;

        // TODO: (ZEFS 2025-08-17 #263) try to purchase augmentation before grafting it
        // Cannot graft pre-req, signal failure
        if (!graftableAugs.has(preReqAug)) return false;

        const result = await graftAugmentation(
            ns,
            ownedAugs,
            augment(ns, preReqAug),
        );

        if (!result) return false;
    }

    while (!canAfford(ns, aug.price + 200_000)) {
        await ns.asleep(1000);
    }

    travelTo(ns, 'New Tokyo');

    const res = ns.grafting.graftAugmentation(aug.name, true);
    if (!res) return false;

    try {
        await ns.grafting.waitForOngoingGrafting();
    } catch (e) {
        ns.print(`ERROR: Failed to graft augment ${aug.name}: ${String(e)}`);
        return false;
    }

    ownedAugs.add(aug.name);

    return true;
}

interface Augment extends Partial<Multipliers> {
    name: string;
    price: number;
    installTime: number;
}

interface ScoredAugment extends Augment {
    score: number;
}

function augment(ns: NS, name: string): Augment {
    const augMultipliers = ns.singularity.getAugmentationStats(name);
    return {
        name,
        price: ns.grafting.getAugmentationGraftPrice(name),
        installTime: ns.grafting.getAugmentationGraftTime(name),
        ...stripUnitMults(augMultipliers),
    };
}

function stripUnitMults(aug: Multipliers): Partial<Multipliers> {
    const out: Partial<Multipliers> = {};
    for (const k in aug) {
        if (aug[k] !== 1) out[k] = aug[k];
    }
    return out;
}

function scoredAugment(
    ns: NS,
    name: string,
    mults: readonly MultKey[],
): ScoredAugment {
    const aug = augment(ns, name);
    return {
        ...aug,
        score: scoreAug(aug, mults),
    };
}

function scoreAug(a: Augment, mults: readonly MultKey[]): number {
    let s = 0;
    for (const k of mults) {
        const v = a[k]; // only present if != 1
        if (typeof v === 'number') s += v - 1; // additive improvement over baseline
    }
    return s;
}
