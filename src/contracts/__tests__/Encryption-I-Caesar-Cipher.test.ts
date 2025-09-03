import { expect, test } from '@jest/globals';

import { solve as solveCaesar } from '../Encryption-I-Caesar-Cipher';

test('Caesar Cipher', () => {
    expect(solveCaesar(['MEDIA MOUSE INBOX VIRUS DEBUG', 10])).toBe(
        'CUTYQ CEKIU YDREN LYHKI TURKW',
    );
});
