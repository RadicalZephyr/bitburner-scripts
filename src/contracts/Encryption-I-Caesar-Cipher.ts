/* Encryption I: Caesar Cipher

Caesar cipher is one of the simplest encryption technique. It is a
type of substitution cipher in which each letter in the plaintext is
replaced by a letter some fixed number of positions down the
alphabet. For example, with a left shift of 3, D would be replaced by
A, E would become B, and A would become X (because of rotation).

You are given an array with two elements:
  ["MEDIA MOUSE INBOX VIRUS DEBUG", 10]
The first element is the plaintext, the second element is the left shift value.

Return the ciphertext as uppercase string. Spaces remains the same.
 */

import type { NS } from 'netscript';
import { MEM_TAG_FLAGS } from 'services/client/memory_tag';

export async function main(ns: NS) {
  ns.flags(MEM_TAG_FLAGS);
  const scriptName = ns.getScriptName();
  const contractPortNum = ns.args[0];
  if (typeof contractPortNum !== 'number') {
    ns.tprintf(
      '%s contract run with non-number answer port argument',
      scriptName,
    );
    return;
  }
  const contractDataJSON = ns.args[1];
  if (typeof contractDataJSON !== 'string') {
    ns.tprintf(
      '%s contract run with non-string data argument. Must be a JSON string containing file, host and contract data.',
      scriptName,
    );
    return;
  }
  const contractData = JSON.parse(contractDataJSON);
  ns.tprintf('contract data: %s', JSON.stringify(contractData));
  const answer = solve(contractData);
  ns.writePort(contractPortNum, answer);
}

const ALPHABET: string[] = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'M',
  'N',
  'O',
  'P',
  'Q',
  'R',
  'S',
  'T',
  'U',
  'V',
  'W',
  'X',
  'Y',
  'Z',
];

export function solve(data: [string, number]): string {
  const [plaintext, n] = data;
  const leftShift = ALPHABET.length - n;
  const upcase_plaintext = plaintext.toUpperCase();
  return upcase_plaintext
    .split('')
    .map((c) => shift(c, leftShift))
    .join('');
}

const A_CODE: number = 'A'.codePointAt(0);

function shift(c: string, n: number): string {
  // Spaces remain unchanged
  if (c === ' ') {
    return c;
  }
  const index = c.codePointAt(0) - A_CODE;

  // If c is not in the uppercase alphabet just return it.
  if (index >= ALPHABET.length || index < 0) {
    return c;
  }

  const shiftedIndex = (index + n) % ALPHABET.length;
  return ALPHABET[shiftedIndex];
}
