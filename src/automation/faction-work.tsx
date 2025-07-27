import type { FactionWorkType, NS, UserInterfaceTheme } from 'netscript';
import { MEM_TAG_FLAGS } from 'services/client/memory_tag';
import {
    KARMA_HEIGHT,
    STATUS_WINDOW_HEIGHT,
    STATUS_WINDOW_WIDTH,
} from '/util/ui';

export async function main(ns: NS) {
    const flags = ns.flags([
        ['focus', false],
        ['help', false],
        ...MEM_TAG_FLAGS,
    ]);

    if (flags.help || typeof flags.focus !== 'boolean') {
        ns.print(`
USAGE: run ${ns.getScriptName()}

Continuously monitor for faction invitations and accept them aslong as that faction has no enemies.

OPTIONS
  --help           Show this help message
`);
    }

    ns.disableLog('ALL');
    ns.clearLog();

    ns.ui.openTail();
    ns.ui.resizeTail(STATUS_WINDOW_WIDTH, KARMA_HEIGHT);
    const [ww] = ns.ui.windowSize();
    ns.ui.moveTail(
        ww - STATUS_WINDOW_WIDTH,
        STATUS_WINDOW_HEIGHT + KARMA_HEIGHT,
    );

    const focus = new Toggle(ns, flags.focus as boolean);
    ns.printRaw(<FocusToggle ns={ns} focus={focus} />);
    ns.ui.renderTail();

    await workForFactions(ns, focus);
    ns.tprint('finished faction work');
}

class Toggle {
    ns: NS;
    value: boolean;

    constructor(ns: NS, value: boolean) {
        this.ns = ns;
        this.value = value;
    }

    toggle() {
        this.value = !this.value;
        this.ns.singularity.setFocus(this.value);
    }
}

interface FocusProps {
    ns: NS;
    focus: Toggle;
}

const buttonClass =
    'MuiButtonBase-root MuiButton-root MuiButton-text MuiButton-textPrimary MuiButton-sizeMedium MuiButton-textSizeMedium MuiButton-root MuiButton-text MuiButton-textPrimary MuiButton-sizeMedium MuiButton-textSizeMedium css-u8jh2y';

function FocusToggle({ ns, focus }: FocusProps) {
    const [theme, setTheme] = React.useState(
        ns.ui.getTheme() as UserInterfaceTheme,
    );

    React.useEffect(() => {
        const id = globalThis.setInterval(() => {
            setTheme(ns.ui.getTheme());
        }, 200);

        return () => {
            globalThis.clearInterval(id);
        };
    }, [ns]);

    return (
        <button
            className={buttonClass}
            style={{ color: theme.successlight }}
            onClick={() => focus.toggle()}
        >
            Toggle Focus
        </button>
    );
}

class Faction {
    name: string;
    rep: number;
    favor: number;
    favorToGain: number;
    targetRep: number;

    constructor(ns: NS, name: string, ownedAugs: Set<string>) {
        this.name = name;

        const sing = ns.singularity;
        this.rep = sing.getFactionRep(name);
        this.favor = sing.getFactionFavor(name);
        this.favorToGain = sing.getFactionFavorGain(name);

        const augs = sing
            .getAugmentationsFromFaction(name)
            .filter((aug) => !ownedAugs.has(aug));

        if (augs.length < 1) {
            this.targetRep = 0;
            return;
        }

        augs.sort(
            (a, b) =>
                sing.getAugmentationRepReq(b) - sing.getAugmentationRepReq(a),
        );

        this.targetRep = sing.getAugmentationRepReq(augs[0]);
    }
}

async function workForFactions(ns: NS, focus: Toggle) {
    const sing = ns.singularity;

    while (true) {
        const ownedAugs = getOwnedAugs(ns);

        const unfinishedFactions = getUnfinishedFactions(ns, ownedAugs);
        if (unfinishedFactions.length === 0) return;

        unfinishedFactions.sort((a, b) => a.rep - b.rep);

        const lowestRepFaction = unfinishedFactions[0];

        const workType = getBestWorkTypeForFaction(ns, lowestRepFaction.name);

        if (
            !sing.workForFaction(lowestRepFaction.name, workType, focus.value)
        ) {
            ns.print(
                `WARN: could not start working ${workType} for ${lowestRepFaction.name}`,
            );
            return;
        }

        await ns.asleep(10_000);
    }
}

function getBestWorkTypeForFaction(ns: NS, faction: string): FactionWorkType {
    const player = ns.getPlayer();
    const workTypes = ns.singularity.getFactionWorkTypes(faction).map((w) => {
        const favor = ns.singularity.getFactionFavor(faction);
        const gains = ns.formulas.work.factionGains(player, w, favor);
        return {
            type: w,
            ...gains,
        };
    });

    workTypes.sort((a, b) => b.reputation - a.reputation);

    return workTypes[0].type;
}

function getOwnedAugs(ns: NS): Set<string> {
    const reset = ns.getResetInfo();
    return new Set(reset.ownedAugs.keys());
}

function getUnfinishedFactions(ns: NS, ownedAugs: Set<string>) {
    const factions = ns
        .getPlayer()
        .factions.map((name) => new Faction(ns, name, ownedAugs));
    return factions.filter((f) => !haveNeededRepForFaction(ns, f));
}

function haveNeededRepForFaction(ns: NS, faction: Faction) {
    return (
        faction.targetRep <= faction.rep
        || faction.favor + faction.favorToGain >= ns.getFavorToDonate()
    );
}
