import type { GangGenInfo, GangMemberInfo, NS } from 'netscript';

/**
 * Centralized board for staging gang member ascensions while preserving a
 * minimum respect quota.
 */
export class AscensionReviewBoard {
  private respectQuota: number;
  private requests: Set<string> = new Set();

  constructor(quota = 1) {
    this.respectQuota = quota;
  }

  /**
   * Add a gang member to the list of pending ascension requests.
   *
   * @param name - Member name requesting ascension
   */
  requestAscension(name: string): void {
    this.requests.add(name);
  }

  /**
   * Adjust the minimum respect quota maintained by the board.
   *
   * @param quota - Desired minimum gang respect
   */
  setRespectQuota(quota: number): void {
    this.respectQuota = quota;
  }

  /**
   * Check pending requests and return a member that can be safely ascended.
   * The returned member is removed from the request queue.
   *
   * @param ns - Netscript API
   * @returns Name of the member to ascend, or `undefined` if none qualify
   */
  reviewRequests(ns: NS): string | undefined {
    if (this.requests.size === 0) return undefined;

    const info: GangGenInfo = ns.gang.getGangInformation();
    const isHacking = info.isHacking;

    const candidates: { name: string; mult: number; respect: number }[] = [];
    for (const name of this.requests) {
      const member: GangMemberInfo = ns.gang.getMemberInformation(name);
      const mult = isHacking
        ? member.hack_asc_mult
        : (member.str_asc_mult
            + member.def_asc_mult
            + member.dex_asc_mult
            + member.agi_asc_mult)
          / 4;
      candidates.push({ name, mult, respect: member.earnedRespect });
    }

    candidates.sort((a, b) => a.mult - b.mult);

    for (const cand of candidates) {
      if (info.respect - cand.respect >= this.respectQuota) {
        this.requests.delete(cand.name);
        return cand.name;
      }
    }

    return undefined;
  }
}
