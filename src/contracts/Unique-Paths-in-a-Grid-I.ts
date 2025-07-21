/* Unique Paths in a Grid I

You are in a grid with 4 rows and 6 columns, and you are positioned in
the top-left corner of that grid. You are trying to reach the
bottom-right corner of the grid, but you can only move down or right
on each step. Determine how many unique paths there are from start to
finish.

NOTE: The data returned for this contract is an array with the number
of rows and columns:

[4, 6]
 */

import type { NS } from "netscript";
import { MEM_TAG_FLAGS } from "services/client/memory_tag";

export async function main(ns: NS) {
    const flags = ns.flags(MEM_TAG_FLAGS);
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
    const contractData: any = JSON.parse(contractDataJSON);
    ns.tprintf('contract data: %s', JSON.stringify(contractData));
    const answer = solve(contractData);
    ns.writePort(contractPortNum, JSON.stringify(answer));
}

/* The solution to this hinges on breaking the problem down. From each
 * square, you can only go one of two ways, right or down. From there,
 * the number of unique paths you have is just the sum of how many
 * unique exist from the square below the current position and the
 * square to the right of the current position.
 *
 * To actually calculate these, we can start from the goal. At the
 * goal, we can say as a base case that there is one unique path
 * because we're already at the goal. Similarly, if we are directly to
 * the left or above the goal, then there is one unique path. From
 * there we can simply use sums to fill in the number of unique paths
 * starting from any grid location.
 *
 * For calculating this, it's more convenient to treat 0,0 as the
 * target grid and fill in all the positions x,0 and 0,y with 1s.
 *
 * 1 1 1 1
 * 1
 * 1
 *
 * Then for every position from 1,1 to x_max,y_max we just fill in the
 * sum of the two positions up and to the left of the current
 * position.
 *
 * The only tricky thing is the iteration order needs to proceed in a
 * diagonal fashion across the grid, not row-wise or column-wise.
 *
 * 1 1 1 1
 * 1 2
 * 1
 *
 * 1 1 1 1
 * 1 2 3
 * 1 3
 *
 * 1 1 1 1
 * 1 2 3 4
 * 1 3 6
 *
 * 1 1 1 1
 * 1 2 3 4
 * 1 3 6 10
 *
 */
export function solve(data: [number, number]): any {
    const [numRows, numCols] = data;
    const pathsTable = new Paths(numRows, numCols);
    pathsTable.fillTable();
    return pathsTable.at([numRows - 1, numCols - 1]);
}

type Position = [number, number];

class Paths {
    numRows: number;
    numCols: number;
    paths: number[][];

    constructor(numRows: number, numCols: number) {
        this.numRows = numRows;
        this.numCols = numCols;
        this.paths = seedTable(numRows, numCols);
    }

    fillTable() {
        for (let x = 1; x < this.numRows; x++) {
            for (let y = 1; y < this.numCols; y++) {
                this.calculate([x, y]);
            }
        }
    }

    calculate(pos: Position) {
        const sum = this.prevNeighbors(pos).map((p) => this.at(p), this).reduce((p, c) => p + c);
        this.paths[pos[0]][pos[1]] = sum;
    }

    at([x, y]: Position): number {
        return this.paths[x][y];
    }

    prevNeighbors(position: Position): Position[] {
        const [x, y] = position;
        return [[x - 1, y], [x, y - 1]].filter(([x, y]) => x >= 0 && y >= 0, this) as Position[];
    }

}

function seedTable(numRows: number, numCols: number): number[][] {
    const firstRow = Array.from({ length: numCols }, (_v, _i) => 1);
    const rows = Array.from({ length: numRows - 1 }, (_v, _i) => {
        const row = Array.from({ length: numCols - 1 }, (_v, _i) => 0);
        row.unshift(1);
        return row;
    });
    rows.unshift(firstRow);
    return rows;
}
