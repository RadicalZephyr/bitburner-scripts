/* Shortest Path in a Grid

You are located in the top-left corner of the following grid:

  [[0,0,0,1,0,0,1,0,0,0],
   [0,0,1,0,1,1,1,0,1,1],
   [0,1,0,0,1,0,1,1,0,1],
   [0,0,0,0,0,1,0,0,1,0],
   [0,0,0,0,0,0,0,0,0,0],
   [1,0,0,1,0,1,1,1,0,0]]

You are trying to find the shortest path to the bottom-right corner of
the grid, but there are obstacles on the grid that you cannot move
onto. These obstacles are denoted by '1', while empty spaces are
denoted by 0.

Determine the shortest path from start to finish, if one exists. The
answer should be given as a string of UDLR characters, indicating the
moves along the path

NOTE: If there are multiple equally short paths, any of them is
accepted as answer. If there is no path, the answer should be an empty
string.  NOTE: The data returned for this contract is an 2D array of
numbers representing the grid.

Examples:

    [[0,1,0,0,0],
     [0,0,0,1,0]]

Answer: 'DRRURRD'

    [[0,1],
     [1,0]]

Answer: ''
 */

import type { NS } from "netscript";
import { MEM_TAG_FLAGS } from "services/client/memory_tag";

export async function main(ns: NS) {
    ns.flags(MEM_TAG_FLAGS);
    const scriptName = ns.getScriptName();
    const contractPortNum = ns.args[0];
    if (typeof contractPortNum !== 'number') {
        ns.tprintf('%s contract run with non-number answer port argument', scriptName);
        return;
    }
    const contractDataJSON = ns.args[1];
    if (typeof contractDataJSON !== 'string') {
        ns.tprintf('%s contract run with non-string data argument. Must be a JSON string containing file, host and contract data.', scriptName);
        return;
    }
    const contractData = JSON.parse(contractDataJSON);
    ns.tprintf('contract data: %s', JSON.stringify(contractData));
    const answer = solve(contractData);
    ns.writePort(contractPortNum, answer);
}

export function solve(data: number[][]): string {
    // Step 1: Determine grid dimensions and the start and goal cells.
    const numRows = data.length;
    if (numRows === 0) {
        return "";
    }
    const numCols = data[0].length;
    const start: [number, number] = [0, 0];
    const goal: [number, number] = [numRows - 1, numCols - 1];

    // Step 2: If the start or goal is blocked we can immediately return.
    if (data[start[0]][start[1]] === 1 || data[goal[0]][goal[1]] === 1) {
        return "";
    }

    // Step 3: Helper for retrieving valid neighbours.
    function neighbors([x, y]: [number, number]): [number, number, string][] {
        const possible: [number, number, string][] = [
            [x - 1, y, "U"],
            [x + 1, y, "D"],
            [x, y - 1, "L"],
            [x, y + 1, "R"],
        ];
        return possible.filter(([nx, ny]) => {
            return nx >= 0 && nx < numRows && ny >= 0 && ny < numCols && data[nx][ny] === 0;
        });
    }

    // Step 4: Breadth first search keeping track of the path taken to each cell.
    const queue: { pos: [number, number]; path: string }[] = [{ pos: start, path: "" }];
    const visited = new Set<string>([start.toString()]);
    while (queue.length > 0) {
        const { pos, path } = queue.shift() as { pos: [number, number]; path: string };
        if (pos[0] === goal[0] && pos[1] === goal[1]) {
            return path;
        }
        for (const [nx, ny, dir] of neighbors(pos)) {
            const key = `${nx},${ny}`;
            if (visited.has(key)) {
                continue;
            }
            visited.add(key);
            queue.push({ pos: [nx, ny], path: path + dir });
        }
    }

    // Step 5: No path found.
    return "";
}
