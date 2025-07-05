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
export async function main(ns) {
    let scriptName = ns.getScriptName();
    let contractPortNum = ns.args[0];
    if (typeof contractPortNum !== 'number') {
        ns.tprintf('%s contract run with non-number answer port argument', scriptName);
        return;
    }
    let contractDataJSON = ns.args[1];
    if (typeof contractDataJSON !== 'string') {
        ns.tprintf('%s contract run with non-string data argument. Must be a JSON string containing file, host and contract data.', scriptName);
        return;
    }
    let contractData = JSON.parse(contractDataJSON);
    ns.tprintf('contract data: %s', JSON.stringify(contractData));
    let answer = solve(contractData);
    ns.writePort(contractPortNum, answer);
}
const ALPHABET = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
function solve(data) {
    let [plaintext, n] = data;
    let leftShift = ALPHABET.length - n;
    let upcase_plaintext = plaintext.toUpperCase();
    return upcase_plaintext.split('').map((c) => shift(c, leftShift)).join('');
}
const A_CODE = "A".codePointAt(0);
function shift(c, n) {
    // Spaces remain unchanged
    if (c === ' ') {
        return c;
    }
    let index = c.codePointAt(0) - A_CODE;
    // If c is not in the uppercase alphabet just return it.
    if (index >= ALPHABET.length || index < 0) {
        return c;
    }
    let shiftedIndex = (index + n) % ALPHABET.length;
    return ALPHABET[shiftedIndex];
}
