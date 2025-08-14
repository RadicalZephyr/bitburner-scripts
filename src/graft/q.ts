import type { NS, AutocompleteData, Multipliers } from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';

import { canAfford } from 'util/money';

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
] as const satisfies readonly (keyof Multipliers)[];

const FLAGS = [
    ['dry-run', false],
    ['mult', ['hacking_speed', 'hacking_chance']],
    ['help', false],
] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData, args: string[]): string[] {
    data.flags(FLAGS);

    const multFlag = '--mult';

    const last = args.at(-1);
    if (last === multFlag) return MULTIPLIERS;

    const secondLast = args.at(-2);
    if (secondLast === multFlag)
        return MULTIPLIERS.filter((m) => m.startsWith(last));

    return [];
}

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    if (flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

Graft augments in order of least time and selecting for specific multipliers.

Example:
  > run ${ns.getScriptName()} --mult faction_rep
  > run ${ns.getScriptName()} --mult hacking --mult hacking_exp

OPTIONS
  --dry-run  Don't buy anything, just display the augments that would be chosen
  --mult     Augmentation multipliers to filter by, may be specified multiple times
             Default: hacking_speed, hacking_chance
             Available multipliers: ${MULTIPLIERS.join(', ')}
  --help     Show this help message
`);
        return;
    }

    await graftAugments(ns, flags['dry-run'], flags.mult);

    ns.ui.openTail();
}

async function graftAugments(ns: NS, dryRun: boolean, mult: string[]) {
    const mults = mult
        .map((m) => m.trim())
        .filter((m): m is keyof Multipliers => m.length > 0);

    for (const m of mults) {
        if (!MULTIPLIERS.includes(m)) {
            ns.tprint(`ERROR: Unknown multiplier '${m}'.`);
            return;
        }
    }

    const graftableAugs = ns.grafting
        .getGraftableAugmentations()
        .map((a) => augment(ns, a))
        .filter((a) => mults.some((m) => m in a));

    graftableAugs.sort((a, b) => {
        if (Math.abs(a.price - b.price) < 1) {
            return a.installTime - b.installTime;
        } else {
            return a.price - b.price;
        }
    });

    if (dryRun || ns.singularity.isBusy()) {
        ns.disableLog('ALL');
        ns.clearLog();

        ns.print(JSON.stringify(graftableAugs, null, 2));

        if (ns.singularity.isBusy()) {
            ns.print(
                'WARN: Player is busy with an action, refusing to start grafting while busy.',
            );
        }
        return;
    }

    for (const aug of graftableAugs) {
        if (!canAfford(ns, aug.price)) {
            ns.print(
                `could not afford to buy ${aug.name} for $${ns.formatNumber(aug.price)}`,
            );
            break;
        }

        ns.grafting.graftAugmentation(aug.name, true);
        await ns.grafting.waitForOngoingGrafting();

        ns.print(`finished grafting ${aug.name}`);
        await ns.sleep(1000);
    }
}

interface Augment extends Partial<Multipliers> {
    name: string;
    price: number;
    installTime: number;
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
    for (const k in aug) {
        if (aug[k] === 1) delete aug[k];
    }
    return aug;
}
