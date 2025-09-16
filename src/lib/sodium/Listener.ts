/* eslint-disable @typescript-eslint/no-unused-vars */

import { Source, Vertex } from 'lib/sodium/Vertex.js';

export class Listener<A> {
    constructor(h: (a: A) => void, target: Vertex) {
        this.h = h;
        this.target = target;
    }
    h: (a: A) => void;
    target: Vertex;
}
