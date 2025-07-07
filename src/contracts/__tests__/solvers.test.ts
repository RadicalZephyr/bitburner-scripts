import { solve as solveExpr } from "../Find-All-Valid-Math-Expressions";
import { solve as solveIP } from "../Generate-IP-Addresses";
import { solve as solveMerge } from "../Merge-Overlapping-Intervals";
import { solve as solveColor } from "../Proper-2-Coloring-of-a-Graph";
import { solve as solveParens } from "../Sanitize-Parentheses-in-Expression";


describe("contract solvers", () => {

    test("Math Expressions", () => {
        expect(solveExpr(["29787", -8])).toEqual(["2-97+87"]);
    });

    test("Generate IP Addresses", () => {
        expect(solveIP("2261743611")).toEqual(["226.174.36.11"]);
    });

    test("Merge Overlapping Intervals", () => {
        expect(solveMerge([[7, 13], [13, 19], [18, 24]])).toEqual([[7, 24]]);
    });

    test("Proper 2 Coloring", () => {
        expect(solveColor([7, [[2, 4], [1, 5], [0, 4], [0, 6], [0, 5]]])).toEqual([0, 0, 0, 0, 1, 1, 1]);
    });

    test("Sanitize Parentheses", () => {
        expect(solveParens("((())((a")).toEqual(["(())a"]);
    });
});
