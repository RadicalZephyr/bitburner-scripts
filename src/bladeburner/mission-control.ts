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
  BLADE_highStaminaPercent      Percent of max stamina that is considered "high"
  BLADE_lowStaminaPercent       Percent of max stamina that is considered "low"
  BLADE_maxChaos                Maximum allowed city chaos before we try to lower it
  BLADE_maxSuccessChanceSpread  Maxmimum allowed success chance spread before we need to survery population
  BLADE_minBlackOpSuccess       Minimum success chance to attempt next Black Op
  BLADE_minHealthPercent        Minimum percentage of health before we try to heal
  BLADE_minSROSuccess           Minimum success chance to attempt stealth retirement operations
  BLADE_minSurveySuccess        Minimum success chance to attempt surveying actions
`);
        return;
    }

    await directMissions(ns);
}

async function directMissions(ns: NS) {
    while (true) {
        await ns.bladeburner.nextUpdate();

        // 1) Heal if low HP ---------------------------------------------------
        if (await handleHealing(ns)) continue;

        // 2) Surveying (intel) ------------------------------------------------
        if (await handleSurveying(ns)) continue;

        // 3) Chaos control (SRO preferred) ------------------------------------
        if (await handleChaos(ns)) continue;

        // 4) BlackOps (gate) --------------------------------------------------
        if (await tryBlackOp(ns)) continue;

        // 5) EV selection across cities (rank/sec) ----------------------------
        const pick = bestAction(ns);

        // If best pick is in another city and sufficiently better,
        // we'll travel inside enactPick
        await enactPick(ns, pick);

        await ns.asleep(100);
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

async function handleHealing(ns: NS): Promise<boolean> {
    const player = ns.getPlayer();
    const health = player.hp;
    if (health.current < health.max * CONFIG.minHealthPercent) {
        return await startAction(ns, heal);
    }
    return false;
}

const heal: Action = {
    type: 'General',
    name: 'Hyperbolic Regeneration Chamber',
};

async function handleChaos(ns: NS): Promise<boolean> {
    const currentCity = ns.bladeburner.getCity();
    const currentChaos = ns.bladeburner.getCityChaos(currentCity);

    if (currentChaos > CONFIG.maxChaos) {
        const staminaStatus = getStaminaStatus(ns);
        if (
            staminaStatus !== Stamina.Low
            && actionChance(ns, sro) > CONFIG.minSROSuccess
        ) {
            return await startAction(ns, sro);
        }
        return await startAction(ns, diplomacy);
    }
    return false;
}

const diplomacy: Action = { type: 'General', name: 'Diplomacy' };
const sro: Action = {
    type: 'Operations',
    name: 'Stealth Retirement Operation',
};

async function handleSurveying(ns: NS): Promise<boolean> {
    const avgSuccessSpread = getAvgSuccessSpread(ns);
    if (avgSuccessSpread > CONFIG.maxSuccessChanceSpread) {
        const staminaStatus = getStaminaStatus(ns);
        if (staminaStatus !== Stamina.Low) {
            for (const surveyAction of surveyingActions) {
                if (actionChance(ns, surveyAction) > CONFIG.minSurveySuccess) {
                    return await startAction(ns, surveyAction);
                }
            }
        }
        return await startAction(ns, fieldAnalysis);
    }
    return false;
}

const fieldAnalysis: Action = { type: 'General', name: 'Field Analysis' };
const track: Action = { type: 'Contracts', name: 'Tracking' };
const investigation: Action = { type: 'Operations', name: 'Investigation' };
const undercover: Action = { type: 'Operations', name: 'Undercover Operation' };
const surveyingActions: readonly Action[] = [undercover, investigation, track];

function getAvgSuccessSpread(ns: NS): number {
    const all = allContractsAndOperations(ns);
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

function allContractsAndOperations(ns: NS): readonly Action[] {
    const contractActions = ns.bladeburner
        .getContractNames()
        .map((n) => action('Contracts', n));
    const operationActions = ns.bladeburner
        .getOperationNames()
        .map((n) => action('Operations', n));
    return [...contractActions, ...operationActions];
}

function action(
    type: BladeburnerActionType | `${BladeburnerActionType}`,
    name: BladeburnerActionName | `${BladeburnerActionName}`,
): Action {
    return { type, name };
}

async function tryBlackOp(ns: NS): Promise<boolean> {
    const currentRank = ns.bladeburner.getRank();
    const nextBlackOp = {
        type: 'Black Operations',
        ...ns.bladeburner.getNextBlackOp(),
    } satisfies Action;
    if (
        currentRank >= nextBlackOp.rank
        && actionChance(ns, nextBlackOp) > CONFIG.minBlackOpSuccess
    ) {
        return await startAction(ns, nextBlackOp);
    }
    return false;
}

function bestAction(ns: NS): Action {
    const staminaStatus = getStaminaStatus(ns);
    if (staminaStatus === Stamina.Low)
        return { type: 'General', name: 'Field Analysis' };

    const allActionCandidates = allContractsAndOperations(ns)
        .map((a) => candidate(ns, a))
        .filter((c) => c.count > 1);
    allActionCandidates.sort(
        (a, b) => b.expectedRankPerSecond - a.expectedRankPerSecond,
    );

    if (allActionCandidates.length === 0) return increaseChaos;

    return allActionCandidates[0];
}

interface ActionCandidate extends Action {
    count: number;
    rankGain: number;
    duration: number;
    successChance: number;
    expectedRankPerSecond: number;
}

function candidate(ns: NS, action: Action): ActionCandidate {
    const count = ns.bladeburner.getActionCountRemaining(
        action.type,
        action.name,
    );
    const rankGain = ns.bladeburner.getActionRepGain(action.type, action.name);
    const duration = ns.bladeburner.getActionTime(action.type, action.name);
    const successChance = actionChance(ns, action);
    const expectedRankPerSecond = (rankGain * successChance) / duration / 1000;
    return {
        count,
        rankGain,
        duration,
        successChance,
        expectedRankPerSecond,
        ...action,
    };
}

async function enactPick(ns: NS, pick: Action) {
    await startAction(ns, pick);
}

async function startAction(ns: NS, action: Action): Promise<boolean> {
    const actionTime = ns.bladeburner.getActionTime(action.type, action.name);
    if (!ns.bladeburner.startAction(action.type, action.name)) return false;

    await ns.asleep(actionTime + 1000);
    return true;
}

function actionChance(ns: NS, action: Action): number {
    const [lo, hi] = ns.bladeburner.getActionEstimatedSuccessChance(
        action.type,
        action.name,
    );
    return (lo + hi) / 2;
}

const increaseChaos: Action = { type: 'General', name: 'Incite Violence' };

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const recruit: Action = { type: 'General', name: 'Recruitment' };
