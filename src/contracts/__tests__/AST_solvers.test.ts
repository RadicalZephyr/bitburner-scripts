import { solve as solveAST1 } from "../Algorithmic-Stock-Trader-I";
import { solve as solveAST2 } from "../Algorithmic-Stock-Trader-II";
import { solve as solveAST3 } from "../Algorithmic-Stock-Trader-III";
import { solve as solveAST4 } from "../Algorithmic-Stock-Trader-IV";

describe("algorithmic stock trader solvers", () => {
    test("Algorithmic Stock Trader I", () => {
        expect(solveAST1([72, 148, 128, 33, 71, 9, 2, 163, 155, 107, 2, 98])).toBe(161);
    });

    test("Algorithmic Stock Trader II", () => {
        expect(solveAST2([127, 191, 145, 88, 127, 1, 145, 13, 19, 13, 195, 75, 198, 47, 149, 8])).toBe(660);
    });

    test("Algorithmic Stock Trader III", async () => {
        expect(await solveAST3(undefined, [36, 84, 162, 118, 111, 59, 199, 106, 23, 49, 121, 77, 188, 5, 191, 139, 69, 104, 186, 78, 73, 87, 97, 193, 193, 73, 68, 5, 196, 169, 116, 82, 180, 1, 107, 123, 111, 51, 184, 89, 101, 3, 140, 109, 85])).toBe(379);
    });

    test("Algorithmic Stock Trader IV", async () => {
        expect(await solveAST4(undefined, [10, [5, 90, 66, 133, 66, 57, 137, 159, 102, 30, 109, 193, 125, 151, 40, 32, 22, 79, 200, 32, 141, 91, 187, 164, 113, 1, 175, 133, 32, 123, 59, 95, 103, 115, 135, 171, 152, 95, 69, 74, 176, 152, 181, 39, 48, 159, 145, 17, 168, 38]])).toBe(1422);
    });
});
