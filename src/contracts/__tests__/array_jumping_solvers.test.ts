import { solve as solveAJG2 } from "../Array-Jumping-Game-II";
import { solve as solveAJG } from "../Array-Jumping-Game";

describe("array jumping contract solvers", () => {

    test("Array Jumping Game II", () => {
        expect(solveAJG2([1, 2, 2])).toBe(2);
    });

    test("Array Jumping Game", () => {
        expect(solveAJG([7, 5, 7, 0, 0, 3, 0, 0, 5, 7, 0])).toBe(1);
    });
});
