import type {
    NS,
    AutocompleteData,
    BladeburnerActionName,
    BladeburnerActionType,
    CityName,
} from '@ns';
import { FlagsSchema, parseFlags } from 'util/flags';

import { clamp } from 'util/clamp';

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
  BLADE_dangerousActionPenalty  Percent of actual gains to count for dangerous actions
  BLADE_diplomacyPowerForChaos  Percent chaos reduction from diplomacy to consider increasing chaos
  BLADE_highStaminaPercent      Percent of max stamina that is considered "high"
  BLADE_includeDangerousActions Whether to consider performing dangerous actions
  BLADE_lowStaminaPercent       Percent of max stamina that is considered "low"
  BLADE_maxChaos                Maximum allowed city chaos before we try to lower it
  BLADE_maxChaosGenMs           Maximum time to generate chaos for
  BLADE_maxSuccessChanceSpread  Maxmimum allowed success chance spread before we need to survery population
  BLADE_minBlackOpSuccess       Minimum success chance to attempt next Black Op
  BLADE_minSuccessSpread        Minimum success chance used to estimate population accuracy
  BLADE_minHealthPercent        Minimum percentage of health before we try to heal
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
        await bestAction(ns);

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
        return await doAction(ns, heal);
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
        return await doAction(ns, diplomacy);
    }
    return false;
}

const diplomacy: Action = { type: 'General', name: 'Diplomacy' };

async function handleSurveying(ns: NS): Promise<boolean> {
    const avgSuccessSpread = getAvgSuccessSpread(ns);
    if (avgSuccessSpread > CONFIG.maxSuccessChanceSpread) {
        const staminaStatus = getStaminaStatus(ns);
        if (staminaStatus !== Stamina.Low) {
            for (const surveyAction of surveyingActions) {
                if (actionChance(ns, surveyAction) > CONFIG.minSurveySuccess) {
                    return await doAction(ns, surveyAction);
                }
            }
        }
        return await doAction(ns, fieldAnalysis);
    }
    return false;
}

const fieldAnalysis: Action = { type: 'General', name: 'Field Analysis' };
const track: Action = { type: 'Contracts', name: 'Tracking' };
const investigation: Action = { type: 'Operations', name: 'Investigation' };
const undercover: Action = { type: 'Operations', name: 'Undercover Operation' };
const surveyingActions: readonly Action[] = [undercover, investigation, track];

function getAvgSuccessSpread(ns: NS): number {
    const allOpsWithSpread = allFallibleActions(ns)
        .map((a) => actionChanceSpread(ns, a))
        .filter((s) => s > CONFIG.minSuccessSpread);
    if (allOpsWithSpread.length === 0) return 0;

    const spreadSum = allOpsWithSpread.reduce((sum, spread) => sum + spread, 0);
    return spreadSum / allOpsWithSpread.length;
}

function actionChanceSpread(ns: NS, action: Action): number {
    const [lo, hi] = ns.bladeburner.getActionEstimatedSuccessChance(
        action.type,
        action.name,
    );
    return hi - lo;
}

function allFallibleActions(ns: NS): readonly Action[] {
    const cAndOActions = allContractsAndOperations(ns);

    const nextBlackOp = ns.bladeburner.getNextBlackOp();
    if (nextBlackOp != null)
        return [...cAndOActions, action('Black Operations', nextBlackOp.name)];

    return cAndOActions;
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
    const blackOp = ns.bladeburner.getNextBlackOp();
    if (!blackOp) return false;

    const nextBlackOp = {
        type: 'Black Operations',
        ...blackOp,
    } satisfies Action;
    if (
        currentRank >= nextBlackOp.rank
        && actionChance(ns, nextBlackOp) > CONFIG.minBlackOpSuccess
    ) {
        return await doAction(ns, nextBlackOp);
    }
    return false;
}

async function bestAction(ns: NS) {
    const staminaStatus = getStaminaStatus(ns);
    if (staminaStatus === Stamina.Low) {
        await doAction(ns, fieldAnalysis);
        return;
    }

    const dangerousActionsPred: (c: ActionCandidate) => boolean =
        CONFIG.includeDangerousActions
            ? () => true
            : (c) => !DANGEROUS_ACTIONS.has(c.name);

    const allActionCandidates = allContractsAndOperations(ns)
        .map((a) => candidate(ns, a))
        .filter((c) => c.count > 1)
        .filter(dangerousActionsPred);
    allActionCandidates.sort(
        (a, b) => b.expectedRankPerSecond - a.expectedRankPerSecond,
    );

    let pick: Action;
    if (allActionCandidates.length === 0) {
        if (diplomacyPercent(ns) > CONFIG.diplomacyPowerForChaos) {
            await generateContracts(ns);
        } else {
            pick = recruit;
        }
    } else {
        pick = allActionCandidates[0];
    }

    if (pick != null) await doAction(ns, pick);
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
    const duration = getActionTime(ns, action);
    const penalty = getActionPenalty(action);
    const successChance = actionChance(ns, action);
    const expectedRankPerSecond =
        (rankGain * successChance * penalty) / (duration / 1000);
    return {
        count,
        rankGain,
        duration,
        successChance,
        expectedRankPerSecond,
        ...action,
    };
}

async function doAction(ns: NS, action: Action): Promise<boolean> {
    const actionTime = getActionTime(ns, action);

    const currentAction = ns.bladeburner.getCurrentAction() as Action;
    if (currentAction !== action) {
        if (!startAction(ns, action)) return false;
    }

    await ns.asleep(actionTime + CONFIG.actionBufferMs);
    return true;
}

const BONUS_TIME_SPEEDUP = 5;

function getActionTime(ns: NS, action: Action): number {
    const bonusTime = ns.bladeburner.getBonusTime();
    const actionTime = ns.bladeburner.getActionTime(action.type, action.name);

    if (bonusTime >= actionTime) return actionTime / BONUS_TIME_SPEEDUP;

    return actionTime;
}

function startAction(ns: NS, action: Action): boolean {
    return ns.bladeburner.startAction(action.type, action.name);
}

const DANGEROUS_ACTIONS: Set<`${BladeburnerActionName}`> = new Set([
    'Sting Operation',
    'Raid',
    'Stealth Retirement Operation',
]);

function getActionPenalty(action: Action): number {
    if (DANGEROUS_ACTIONS.has(action.name))
        return CONFIG.dangerousActionPenalty;
    return 1.0;
}

function actionChance(ns: NS, action: Action): number {
    const [lo, hi] = ns.bladeburner.getActionEstimatedSuccessChance(
        action.type,
        action.name,
    );
    return (lo + hi) / 2;
}

async function generateContracts(ns: NS) {
    // Generate chaos with our bonus time
    const bonusTime = ns.bladeburner.getBonusTime();
    const chaosGenTime = clamp(
        bonusTime / 2,
        getActionTime(ns, increaseChaos) + 100,
        CONFIG.maxChaosGenMs,
    );

    const startTime = Date.now();

    const res = startAction(ns, increaseChaos);
    if (!res)
        throw new Error(`Failed to increase chaos for an unknown reason!`);
    while (Date.now() < startTime + chaosGenTime) {
        await ns.sleep(1000);
    }

    // Travel around the cities reducing chaos with Diplomacy back to zero
    const cn = ns.enums.CityName;
    const cities = [
        cn.Sector12,
        cn.Aevum,
        cn.Ishima,
        cn.NewTokyo,
        cn.Chongqing,
        cn.Volhaven,
    ];
    for (const city of cities) {
        if (!ns.bladeburner.switchCity(city))
            throw new Error(`Failed to switch cities to ${city}`);

        await reduceChaos(ns, city);
    }
}

async function reduceChaos(ns: NS, city: CityName) {
    const res = startAction(ns, diplomacy);
    if (!res) throw new Error(`Failed to do Diplomacy in ${city}`);
    while (ns.bladeburner.getCityChaos(city) > 0.0001) {
        await ns.sleep(1000);
    }
}

const increaseChaos: Action = { type: 'General', name: 'Incite Violence' };

const recruit: Action = { type: 'General', name: 'Recruitment' };

function diplomacyPercent(ns: NS): number {
    const player = ns.getPlayer();
    // Returns a percentage by which the city's chaos level should be modified (e.g. 2 for 2%)
    const CharismaLinearFactor = 1e3;
    const CharismaExponentialFactor = 0.045;

    const charismaEff =
        Math.pow(player.skills.charisma, CharismaExponentialFactor)
        + player.skills.charisma / CharismaLinearFactor;
    return charismaEff / 100;
}
