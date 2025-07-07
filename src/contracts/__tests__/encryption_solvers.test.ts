import { solve as solveCaesar } from "../Encryption-I-Caesar-Cipher";
import { solve as solveVigenere } from "../Encryption-II-Vigenère-Cipher";

import { describe, expect, test } from '@jest/globals';

describe("encryption contract solvers", () => {

    test("Caesar Cipher", () => {
        expect(solveCaesar(["MEDIA MOUSE INBOX VIRUS DEBUG", 10])).toBe("CUTYQ CEKIU YDREN LYHKI TURKW");
    });

    test("Vigenere Cipher", () => {
        expect(solveVigenere(["DEBUGCACHEMODEMLOGINARRAY", "HARDWARE"])).toBe("KESXCCRGOEDRZEDPVGZQWRIEF");
    });
});
