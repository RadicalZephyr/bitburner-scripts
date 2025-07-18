import { AscensionReviewBoard } from "gang/ascension-review";
import type { NS, GangGenInfo, GangMemberInfo } from "netscript";
import { describe, expect, test } from "@jest/globals";

function makeNS(respect: number, members: Record<string, GangMemberInfo>): NS {
    return {
        gang: {
            getGangInformation: () => ({ respect, isHacking: true } as GangGenInfo),
            getMemberInformation: (name: string) => members[name],
        },
    } as unknown as NS;
}

describe("ascension review board", () => {
    test("returns candidate when quota satisfied", () => {
        const members = {
            A: { name: "A", earnedRespect: 200, hack_asc_mult: 1.2 } as unknown as GangMemberInfo,
            B: { name: "B", earnedRespect: 50, hack_asc_mult: 1.5 } as unknown as GangMemberInfo,
        };
        const ns = makeNS(300, members);
        const board = new AscensionReviewBoard(100);
        board.requestAscension("A");
        board.requestAscension("B");
        expect(board.reviewRequests(ns)).toBe("A");
    });

    test("returns undefined when quota would be broken", () => {
        const members = {
            C: { name: "C", earnedRespect: 200, hack_asc_mult: 1.1 } as unknown as GangMemberInfo,
        };
        const ns = makeNS(250, members);
        const board = new AscensionReviewBoard(100);
        board.requestAscension("C");
        expect(board.reviewRequests(ns)).toBeUndefined();
    });
});
