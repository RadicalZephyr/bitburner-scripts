import { solve as solveAST1 } from "../Algorithmic-Stock-Trader-I";
import { solve as solveAST2 } from "../Algorithmic-Stock-Trader-II";
import { solve as solveAST3 } from "../Algorithmic-Stock-Trader-III";
import { solve as solveAST4 } from "../Algorithmic-Stock-Trader-IV";
import { solve as solveAJG2 } from "../Array-Jumping-Game-II";
import { solve as solveAJG } from "../Array-Jumping-Game";
import { solve as solveRLE } from "../Compression-I-RLE-Compression";
import { solve as solveLZ } from "../Compression-II-LZ-Decompression";
import { solve as solveCaesar } from "../Encryption-I-Caesar-Cipher";
import { solve as solveVigenere } from "../Encryption-II-Vigenère-Cipher";
import { solve as solveExpr } from "../Find-All-Valid-Math-Expressions";
import { solve as solvePrime } from "../Find-Largest-Prime-Factor";
import { solve as solveIP } from "../Generate-IP-Addresses";
import { solve as solveMerge } from "../Merge-Overlapping-Intervals";
import { solve as solveTriangle } from "../Minimum-Path-Sum-in-a-Triangle";
import { solve as solveColor } from "../Proper-2-Coloring-of-a-Graph";
import { solve as solveParens } from "../Sanitize-Parentheses-in-Expression";
import { solve as solveSpiral } from "../Spiralize-Matrix";
import { solve as solveSqrt } from "../Square-Root";
import { solve as solveSubarray } from "../Subarray-with-Maximum-Sum";
import { solve as solveSumII } from "../Total-Ways-to-Sum-II";
import { solve as solveSum } from "../Total-Ways-to-Sum";
import { solve as solveGridI } from "../Unique-Paths-in-a-Grid-I";
import { solve as solveGridII } from "../Unique-Paths-in-a-Grid-II";

describe("contract solvers", () => {
    test("Algorithmic Stock Trader I", () => {
        expect(solveAST1([72,148,128,33,71,9,2,163,155,107,2,98])).toBe(161);
    });

    test("Algorithmic Stock Trader II", () => {
        expect(solveAST2([127,191,145,88,127,1,145,13,19,13,195,75,198,47,149,8])).toBe(660);
    });

    test("Algorithmic Stock Trader III", async () => {
        expect(await solveAST3(undefined, [36,84,162,118,111,59,199,106,23,49,121,77,188,5,191,139,69,104,186,78,73,87,97,193,193,73,68,5,196,169,116,82,180,1,107,123,111,51,184,89,101,3,140,109,85])).toBe(379);
    });

    test("Algorithmic Stock Trader IV", async () => {
        expect(await solveAST4(undefined, [10,[5,90,66,133,66,57,137,159,102,30,109,193,125,151,40,32,22,79,200,32,141,91,187,164,113,1,175,133,32,123,59,95,103,115,135,171,152,95,69,74,176,152,181,39,48,159,145,17,168,38]])).toBe(1422);
    });

    test("Array Jumping Game II", () => {
        expect(solveAJG2([1,2,2])).toBe(2);
    });

    test("Array Jumping Game", () => {
        expect(solveAJG([7,5,7,0,0,3,0,0,5,7,0])).toBe(1);
    });

    test("RLE Compression", () => {
        expect(solveRLE("QQQQQQQQNXXXXXddW200bbhhhhhhhkkHHHHHuu77ii4GGGGGGGIk44hwwwwwwwwSSEIIIIIIIIrrr2DDppppppppppp6")).toBe("8Q1N5X2d1W12202b7h2k5H2u272i147G1I1k241h8w2S1E8I3r122D9p2p16");
    });

    test("LZ Decompression", () => {
        expect(solveLZ("4VqKd714rdpU439QtJGa3y6o028G422FH6320y522zl925xVanO8490ybJtpzFF")).toBe("VqKddddddddrdpUdpUdQtJGa3y6o8G8G8GFHGFHGFH0y0y0y0zlzlzlzlzlzxVanOVanOVanO0ybJtpzFF");
    });

    test("Caesar Cipher", () => {
        expect(solveCaesar(["MEDIA MOUSE INBOX VIRUS DEBUG", 10])).toBe("CUTYQ CEKIU YDREN LYHKI TURKW");
    });

    test("Vigenere Cipher", () => {
        expect(solveVigenere(["DEBUGCACHEMODEMLOGINARRAY", "HARDWARE"])).toBe("KESXCCRGOEDRZEDPVGZQWRIEF");
    });

    test("Math Expressions", () => {
        expect(solveExpr(["29787", -8])).toEqual(["2-97+87"]);
    });

    test("Largest Prime Factor", () => {
        expect(solvePrime(129983129)).toBe(23629);
    });

    test("Generate IP Addresses", () => {
        expect(solveIP("2261743611")).toEqual(["226.174.36.11"]);
    });

    test("Merge Overlapping Intervals", () => {
        expect(solveMerge([[7,13],[13,19],[18,24]])).toEqual([[7,24]]);
    });

    test("Minimum Path Sum Triangle", () => {
        const tri = [[4],[5,1],[4,4,5],[4,3,2,4],[5,8,1,5,8],[3,1,8,1,8,9],[2,1,3,8,5,5,4],[6,8,9,4,9,4,4,7]];
        expect(solveTriangle(tri)).toBe(22);
    });

    test("Proper 2 Coloring", () => {
        expect(solveColor([7,[[2,4],[1,5],[0,4],[0,6],[0,5]]])).toEqual([0,0,0,0,1,1,1]);
    });

    test("Sanitize Parentheses", () => {
        expect(solveParens("((())((a")).toEqual(["(())a"]);
    });

    test("Spiralize Matrix", () => {
        const matrix = [
            [37,29,17,26,32,3,23,46,43],
            [38,44,35,22,44,38,2,29,4],
            [50,14,4,32,33,5,10,26,37],
            [30,42,36,28,29,27,16,26,50],
            [11,37,23,39,18,45,19,38,33],
            [19,8,12,14,27,24,23,26,6],
            [24,40,40,31,25,33,10,11,5],
            [20,34,36,45,28,28,44,13,2],
            [49,40,38,18,5,24,2,40,50],
            [48,38,22,12,29,41,5,43,14],
            [18,14,12,35,43,43,43,7,24],
            [6,7,45,7,39,17,29,24,50]
        ];
        expect(solveSpiral(matrix)).toContain(50);
        expect(solveSpiral(matrix)).toHaveLength(108);
    });

    test("Square Root", () => {
        const n = BigInt("76636433936619215452179562233742333839307106325670619753981671189430922829450865344518323009065308986490528168302025704126913718483358983118470218644797269974403770434931285058615020800883942343072767");
        expect(solveSqrt(n).toString()).toBe("8754223776933007751075168470206580558150125106125541442504562628597367310549773342865257429290014741");
    });

    test("Subarray Maximum Sum", () => {
        expect(solveSubarray([-8,-7,2,6,6,-7,2,8,-3,-4,4,9,1,0,-8,7,1,4,-1,8,-6,-2,8,2,-6,9,0,0])).toBe(40);
    });

    test("Total Ways to Sum II", () => {
        expect(solveSumII([21,[1,4,5,6,7,8,9,13]])).toBe(95);
    });

    test("Total Ways to Sum", () => {
        expect(solveSum(93)).toBe(82010176);
    });

    test("Unique Paths Grid I", () => {
        expect(solveGridI([4,6])).toBe(56);
    });

    test("Unique Paths Grid II", () => {
        const grid = [
            [0,1,0,1,0,0,0,0,0],
            [0,0,1,0,0,0,0,0,0],
            [1,0,0,0,1,0,0,0,0],
            [0,0,0,0,0,0,0,0,1],
            [1,0,0,0,0,0,0,1,0],
            [0,1,0,0,1,0,0,0,0]
        ];
        expect(solveGridII(grid)).toBe(27);
    });
});
