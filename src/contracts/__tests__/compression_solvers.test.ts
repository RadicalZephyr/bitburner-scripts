import { solve as solveRLE } from "../Compression-I-RLE-Compression";
import { solve as solveLZ } from "../Compression-II-LZ-Decompression";

import { describe, expect, test } from '@jest/globals';

describe("compression contract solvers", () => {

    test("RLE Compression", () => {
        expect(solveRLE("aaaaabccc")).toBe("5a1b3c");
        expect(solveRLE("aAaAaA")).toBe("1a1A1a1A1a1A");
        expect(solveRLE("111112333")).toBe("511233");
        expect(solveRLE("zzzzzzzzzzzzzzzzzzz")).toBe("9z9z1z");
        expect(solveRLE("QQQQQQQQNXXXXXddW200bbhhhhhhhkkHHHHHuu77ii4GGGGGGGIk44hwwwwwwwwSSEIIIIIIIIrrr2DDppppppppppp6")).toBe("8Q1N5X2d1W12202b7h2k5H2u272i147G1I1k241h8w2S1E8I3r122D9p2p16");
    });

    test("LZ Decompression", () => {
        expect(solveLZ("5aaabb450723abb")).toBe("aaabbaaababababaabb");
        expect(solveLZ("4VqKd714rdpU439QtJGa3y6o028G422FH6320y522zl925xVanO8490ybJtpzFF")).toBe("VqKddddddddrdpUdpUdQtJGa3y6o8G8G8GFHGFHGFH0y0y0y0zlzlzlzlzlzxVanOVanOVanO0ybJtpzFF");
    });
});
