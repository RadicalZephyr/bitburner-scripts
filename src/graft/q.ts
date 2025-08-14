import type { NS, AutocompleteData, Multipliers } from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';
import { canAfford } from '/util/money';

const FLAGS = [
    ['dry-run', false],
    ['help', false],
] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return [];
}

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    if (flags.help) {
        ns.tprint(`
        USAGE: run ${ns.getScriptName()}

        Graft augments in order of least time and selecting for specific skill increases.

        Example:
        > run ${ns.getScriptName()}

        OPTIONS
        --help   Show this help message
        {{ other FLAGS options }}

        CONFIGURATION
        {{ CONFIG values used }}
`);
        return;
    }

    ns.disableLog('ALL');
    ns.clearLog();

    await graftAugments(ns, flags['dry-run']);

    ns.ui.openTail();
}

async function graftAugments(ns: NS, dryRun: boolean) {
    const graftableAugs = ns.grafting
        .getGraftableAugmentations()
        .map((a) => augment(ns, a))
        .filter((a) => 'hacking_speed' in a || 'hacking_chance' in a); // TODO: make which multipliers to filter buy configurable

    graftableAugs.sort((a, b) => {
        if (Math.abs(a.price - b.price) < 1) {
            return a.installTime - b.installTime;
        } else {
            return a.price - b.price;
        }
    });

    if (dryRun || ns.singularity.isBusy()) {
        ns.print(JSON.stringify(graftableAugs, null, 2));

        if (ns.singularity.isBusy()) {
            ns.print(
                'WARN: Player is busy with an action, refusing to start grafting while busy.',
            );
        }
        return;
    }

    for (const aug of graftableAugs) {
        if (!canAfford) {
            ns.tprint(
                `could not afford to buy ${aug.name} for $${ns.formatNumber(aug.price)}`,
            );
            break;
        }

        ns.grafting.graftAugmentation(aug.name, true);
        await ns.grafting.waitForOngoingGrafting();
        ns.tprint(`finished grafting ${aug.name}`);
        break;
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
