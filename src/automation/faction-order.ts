import type {
    AutocompleteData,
    FactionName,
    NS,
    PlayerRequirement,
} from 'netscript';
import { allFactions, factionType } from 'automation/factions';
import { FlagsSchema, parseFlags } from 'util/flags';

const FLAGS = [
    ['help', false],
    ['limit', 0],
    ['type', ''],
] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return [];
}

interface FactionMetrics {
    faction: FactionName;
    desirability: number;
    difficulty: number;
    score: number;
    enemies: string[];
}

/**
 * Rank factions based on augment desirability and invite difficulty.
 *
 * @param ns - Netscript API
 * @param type - Optional category filter such as 'hacking' or 'company'
 * @returns Array of faction metrics ordered by recommendation score
 */
export function rankFactions(ns: NS, type = ''): FactionMetrics[] {
    let factions = allFactions(ns);
    if (type) factions = factions.filter((f) => factionType(ns, f) === type);

    const sing = ns.singularity;
    const metrics: FactionMetrics[] = factions.map((f) => {
        const difficulty = invitationDifficulty(
            ns,
            sing.getFactionInviteRequirements(f),
        );
        const desirability = augmentationDesirability(ns, f);
        const enemies = sing.getFactionEnemies(f);
        const score = desirability / (1 + difficulty);
        return { faction: f, desirability, difficulty, score, enemies };
    });

    metrics.sort((a, b) => b.score - a.score);

    const selected: FactionMetrics[] = [];
    for (const m of metrics) {
        if (
            selected.some(
                (s) =>
                    s.enemies.includes(m.faction)
                    || m.enemies.includes(s.faction),
            )
        )
            continue;
        selected.push(m);
    }
    return selected;
}

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);
    if (flags.help) {
        ns.tprint('Usage: run faction-order.js [--limit N] [--type CATEGORY]');
        ns.tprint('Rank factions by desirability and difficulty.');
        return;
    }

    let rankings = rankFactions(ns, flags.type);
    if (flags.limit > 0) rankings = rankings.slice(0, flags.limit);

    for (let i = 0; i < rankings.length; i++) {
        const r = rankings[i];
        const conflict = r.enemies.filter((e) =>
            rankings.some((s) => s.faction === e),
        );
        ns.tprint(
            `${i + 1}. ${r.faction} score=${r.score.toFixed(2)} desirability=${r.desirability.toFixed(2)} difficulty=${r.difficulty.toFixed(2)}${
                conflict.length ? ` conflicts: ${conflict.join(', ')}` : ''
            }`,
        );
    }
}

function invitationDifficulty(ns: NS, reqs: PlayerRequirement[]): number {
    let maxSkill = 0;
    const skills = new Set<string>();
    let money = 0;
    let karma = 0;
    let unique = 0;

    for (const r of reqs) {
        switch (r.type) {
            case 'skills':
                for (const [skill, level] of Object.entries(r.skills)) {
                    skills.add(skill);
                    if (level > maxSkill) maxSkill = level;
                }
                break;
            case 'money':
                if (r.money > money) money = r.money;
                break;
            case 'karma':
                karma = Math.min(karma, r.karma);
                break;
            case 'backdoorInstalled':
                maxSkill = Math.max(
                    maxSkill,
                    ns.getServerRequiredHackingLevel(r.server),
                );
                break;
            default:
                unique += 1;
                break;
        }
    }

    const skillScore = maxSkill / 100;
    const cashScore = money / 1e6;
    const karmaScore = Math.abs(karma);
    const skillCount = skills.size;
    return skillScore + cashScore + karmaScore + skillCount + unique * 2;
}

function augmentationDesirability(ns: NS, faction: FactionName): number {
    const sing = ns.singularity;
    const augs = sing.getAugmentationsFromFaction(faction);
    let best = 0;
    for (const aug of augs) {
        const stats = sing.getAugmentationStats(aug);
        let score = 0;
        score += stats.faction_rep - 1 + (stats.company_rep - 1); // reputation multipliers
        score +=
            stats.hacking_speed
            - 1
            + (stats.hacking_grow - 1)
            + (stats.hacking_money - 1)
            + (stats.hacking_chance - 1); // hacking power & speed
        score += stats.hacking - 1 + (stats.hacking_exp - 1); // hacking level/xp
        const allStat =
            stats.strength
            - 1
            + stats.defense
            - 1
            + stats.dexterity
            - 1
            + stats.agility
            - 1
            + stats.charisma
            - 1
            + stats.strength_exp
            - 1
            + stats.defense_exp
            - 1
            + stats.dexterity_exp
            - 1
            + stats.agility_exp
            - 1
            + stats.charisma_exp
            - 1;
        score += allStat;
        const combat =
            stats.strength
            - 1
            + stats.defense
            - 1
            + stats.dexterity
            - 1
            + stats.agility
            - 1
            + stats.strength_exp
            - 1
            + stats.defense_exp
            - 1
            + stats.dexterity_exp
            - 1
            + stats.agility_exp
            - 1;
        score += combat;
        score += stats.charisma - 1 + (stats.charisma_exp - 1); // charisma bonuses
        if (score > best) best = score;
    }
    return best;
}
