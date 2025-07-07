/* Spiralize Matrix

Given the following array of arrays of numbers representing a 2D
matrix, return the elements of the matrix as an array in spiral order:

    [
        [37,29,17,26,32, 3,23,46,43]
        [38,44,35,22,44,38, 2,29, 4]
        [50,14, 4,32,33, 5,10,26,37]
        [30,42,36,28,29,27,16,26,50]
        [11,37,23,39,18,45,19,38,33]
        [19, 8,12,14,27,24,23,26, 6]
        [24,40,40,31,25,33,10,11, 5]
        [20,34,36,45,28,28,44,13, 2]
        [49,40,38,18, 5,24, 2,40,50]
        [48,38,22,12,29,41, 5,43,14]
        [18,14,12,35,43,43,43, 7,24]
        [ 6, 7,45, 7,39,17,29,24,50]
    ]

Here is an example of what spiral order should be:

    [
        [1, 2, 3]
        [4, 5, 6]
        [7, 8, 9]
    ]

Answer: [1, 2, 3, 6, 9, 8 ,7, 4, 5]

Note that the matrix will not always be square:

    [
        [1,  2,  3,  4]
        [5,  6,  7,  8]
        [9, 10, 11, 12]
    ]

Answer: [1, 2, 3, 4, 8, 12, 11, 10, 9, 5, 6, 7]
 */

import type { NS } from "netscript";

export async function main(ns: NS) {
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
    let contractData: any = JSON.parse(contractDataJSON);
    ns.tprintf('contract data: %s', JSON.stringify(contractData));
    let answer = solve(contractData);
    ns.writePort(contractPortNum, JSON.stringify(answer));
}

export function solve(data: number[][]): number[] {
    const rows = data.length;
    if (rows === 0) return [];
    const cols = data[0].length;

    const result: number[] = [];
    let top = 0;
    let bottom = rows - 1;
    let left = 0;
    let right = cols - 1;

    while (top <= bottom && left <= right) {
        for (let col = left; col <= right; col++) {
            result.push(data[top][col]);
        }
        top++;
        for (let row = top; row <= bottom; row++) {
            result.push(data[row][right]);
        }
        right--;
        if (top <= bottom) {
            for (let col = right; col >= left; col--) {
                result.push(data[bottom][col]);
            }
            bottom--;
        }
        if (left <= right) {
            for (let row = bottom; row >= top; row--) {
                result.push(data[row][left]);
            }
            left++;
        }
    }

    return result;
}
