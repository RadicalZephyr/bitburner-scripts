import { expect, test } from '@jest/globals';

import { solve as solveVigenere } from '../Encryption-II-Vigenère-Cipher';

test('Vigenere Cipher', () => {
    expect(solveVigenere(['DEBUGCACHEMODEMLOGINARRAY', 'HARDWARE'])).toBe(
        'KESXCCRGOEDRZEDPVGZQWRIEF',
    );
});
