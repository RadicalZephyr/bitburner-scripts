import { solve as solvePrime } from "../Find-Largest-Prime-Factor";
import { solve as solveSqrt } from "../Square-Root";
import { solve as solveSubarray } from "../Subarray-with-Maximum-Sum";
import { solve as solveSumII } from "../Total-Ways-to-Sum-II";
import { solve as solveSum } from "../Total-Ways-to-Sum";

describe("contract solvers", () => {

    test("Largest Prime Factor", () => {
        expect(solvePrime(129983129)).toBe(23629);
    });

    test("Square Root", () => {
        const n = BigInt(
            "76636433936619215452179562233742333839307106325670" +
            "61975398167118943092282945086534451832300906530898" +
            "64905281683020257041269137184833589831184702186447" +
            "97269974403770434931285058615020800883942343072767");
        expect(solveSqrt(n).toString()).toBe(
            "87542237769330077510751684702065805581501251061255" +
            "41442504562628597367310549773342865257429290014741");
    });

    test("Subarray Maximum Sum", () => {
        expect(solveSubarray([-8, -7, 2, 6, 6, -7, 2, 8, -3, -4, 4, 9, 1, 0, -8, 7, 1, 4, -1, 8, -6, -2, 8, 2, -6, 9, 0, 0])).toBe(40);
    });

    test("Total Ways to Sum II", () => {
        expect(solveSumII([21, [1, 4, 5, 6, 7, 8, 9, 13]])).toBe(95);
    });

    test("Total Ways to Sum", () => {
        expect(solveSum(93)).toBe(82010176);
    });
});
