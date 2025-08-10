import type {
    NS,
    AutocompleteData,
    BladeburnerActionName,
    BladeburnerActionType,
} from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';

import { CONFIG } from 'bladeburner/config';

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

Choose Bladeburner actions.

Example:
  > run ${ns.getScriptName()}

OPTIONS
  --help   Show this help message

CONFIGURATION
  BLADE_lowStaminaPercent   Percent of max stamina that is considered "low"
  BLADE_highStaminaPercent  Percent of max stamina that is considered "high"
  BLADE_minBlackOpSuccess   Minimum success chance to attempt next Black Op
`);
        return;
    }

    await directMissions(ns);
}

async function directMissions(ns: NS) {
    while (true) {
        await ns.bladeburner.nextUpdate();

        // 1) Heal if low HP ---------------------------------------------------
        if (handleHealing(ns)) continue;

        // 2) Surveying (intel) ------------------------------------------------
        if (handleSurveying(ns)) continue;

        // 3) Chaos control (SRO preferred) ------------------------------------
        if (handleChaos(ns)) continue;

        // 4) BlackOps (gate) --------------------------------------------------
        if (tryBlackOp(ns)) continue;

        // 5) EV selection across cities (rank/sec) ----------------------------
        const pick = bestAction();

        // If best pick is in another city and sufficiently better,
        // we'll travel inside enactPick
        enactPick(ns, pick);

        await ns.asleep(10_000);
    }
}

enum Stamina {
    Low,
    Working,
    High,
}

function getStaminaStatus(ns: NS): Stamina {
    const [currentStamina, maxStamina] = ns.bladeburner.getStamina();

    const lowStaminaThreshold = maxStamina * CONFIG.lowStaminaPercent;
    const highStaminaThreshold = maxStamina * CONFIG.highStaminaPercent;

    if (currentStamina < lowStaminaThreshold) {
        return Stamina.Low;
    } else if (currentStamina > highStaminaThreshold) {
        return Stamina.High;
    } else {
        return Stamina.Working;
    }
}

interface Action {
    type: BladeburnerActionType | `${BladeburnerActionType}`;
    name: BladeburnerActionName | `${BladeburnerActionName}`;
}

function handleHealing(ns: NS): boolean {
    const player = ns.getPlayer();
    const health = player.hp;
    if (health.current < health.max * CONFIG.minHealthPercent) {
        return startAction(ns, heal);
    }
    return false;
}

const heal: Action = {
    type: 'General',
    name: 'Hyperbolic Regeneration Chamber',
};

function handleChaos(ns: NS): boolean {
    const currentCity = ns.bladeburner.getCity();
    const currentChaos = ns.bladeburner.getCityChaos(currentCity);

    if (currentChaos > CONFIG.maxChaos) {
        const staminaStatus = getStaminaStatus(ns);
        if (
            staminaStatus !== Stamina.Low
            && actionChance(ns, sro) > CONFIG.minSROSuccess
        ) {
            return startAction(ns, sro);
        }
        return startAction(ns, diplomacy);
    }
    return false;
}

const diplomacy: Action = { type: 'General', name: 'Diplomacy' };
const sro: Action = {
    type: 'Operations',
    name: 'Stealth Retirement Operation',
};

function handleSurveying(ns: NS): boolean {
    const avgSuccessSpread = getAvgSuccessSpread(ns);
    if (avgSuccessSpread > CONFIG.minSuccessChanceSpread) {
        const staminaStatus = getStaminaStatus(ns);
        if (staminaStatus !== Stamina.Low) {
            for (const surveyAction of surveyingActions) {
                if (actionChance(ns, surveyAction) > CONFIG.minSurveySuccess) {
                    return startAction(ns, surveyAction);
                }
            }
        } else {
            return startAction(ns, fieldAnalysis);
        }
    }
    return false;
}

const fieldAnalysis: Action = { type: 'General', name: 'Field Analysis' };
const track: Action = { type: 'Contracts', name: 'Tracking' };
const investigation: Action = { type: 'Operations', name: 'Investigation' };
const undercover: Action = { type: 'Operations', name: 'Undercover Operation' };
const surveyingActions: readonly Action[] = [undercover, investigation, track];

function getAvgSuccessSpread(ns: NS): number {
    const all = allActions(ns);
    const spreadSum = all
        .map((a) => actionChanceSpread(ns, a))
        .reduce((sum, spread) => sum + spread, 0);
    return spreadSum / all.length;
}

function actionChanceSpread(ns: NS, action: Action): number {
    const [lo, hi] = ns.bladeburner.getActionEstimatedSuccessChance(
        action.type,
        action.name,
    );
    return hi - lo;
}

function allActions(ns: NS): readonly Action[] {
    const generalActions = ns.bladeburner
        .getGeneralActionNames()
        .map((n) => action('General', n));
    const contractActions = ns.bladeburner
        .getContractNames()
        .map((n) => action('Contracts', n));
    const operationActions = ns.bladeburner
        .getOperationNames()
        .map((n) => action('Operations', n));
    return [...generalActions, ...contractActions, ...operationActions];
}

function action(
    type: BladeburnerActionType | `${BladeburnerActionType}`,
    name: BladeburnerActionName | `${BladeburnerActionName}`,
): Action {
    return { type, name };
}

function tryBlackOp(ns: NS): boolean {
    const currentRank = ns.bladeburner.getRank();
    const nextBlackOp = {
        type: 'Black Operations',
        ...ns.bladeburner.getNextBlackOp(),
    } satisfies Action;
    if (
        currentRank >= nextBlackOp.rank
        && actionChance(ns, nextBlackOp) > CONFIG.minBlackOpSuccess
    ) {
        return startAction(ns, nextBlackOp);
    }
    return false;
}

function bestAction(): Action {
    return { type: 'General', name: 'Field Analysis' };
}

function enactPick(ns: NS, pick: Action) {
    startAction(ns, pick);
}

function startAction(ns: NS, action: Action): boolean {
    return ns.bladeburner.startAction(action.type, action.name);
}

function actionChance(ns: NS, action: Action): number {
    const [lo, hi] = ns.bladeburner.getActionEstimatedSuccessChance(
        action.type,
        action.name,
    );
    return (lo + hi) / 2;
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const increaseChaos: Action = { type: 'General', name: 'Incite Violence' };

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const recruit: Action = { type: 'General', name: 'Recruitment' };
