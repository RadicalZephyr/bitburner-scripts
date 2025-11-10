import { Source } from 'lib/sodium/Vertex.js';
/* eslint-disable @typescript-eslint/no-explicit-any */
export class Lambda1 {
    constructor(f, deps) {
        this.f = f;
        this.deps = deps;
    }
    f;
    deps;
}
export function lambda1(f, deps) {
    return new Lambda1(f, deps);
}
export function Lambda1_deps(f) {
    if (f instanceof Lambda1)
        return f.deps;
    else
        return [];
}
export function Lambda1_toFunction(f) {
    if (f instanceof Lambda1)
        return f.f;
    else
        return f;
}
export class Lambda2 {
    constructor(f, deps) {
        this.f = f;
        this.deps = deps;
    }
    f;
    deps;
}
export function lambda2(f, deps) {
    return new Lambda2(f, deps);
}
export function Lambda2_deps(f) {
    if (f instanceof Lambda2)
        return f.deps;
    else
        return [];
}
export function Lambda2_toFunction(f) {
    if (f instanceof Lambda2)
        return f.f;
    else
        return f;
}
export class Lambda3 {
    constructor(f, deps) {
        this.f = f;
        this.deps = deps;
    }
    f;
    deps;
}
export function lambda3(f, deps) {
    return new Lambda3(f, deps);
}
export function Lambda3_deps(f) {
    if (f instanceof Lambda3)
        return f.deps;
    else
        return [];
}
export function Lambda3_toFunction(f) {
    if (f instanceof Lambda3)
        return f.f;
    else
        return f;
}
export class Lambda4 {
    constructor(f, deps) {
        this.f = f;
        this.deps = deps;
    }
    f;
    deps;
}
export function lambda4(f, deps) {
    return new Lambda4(f, deps);
}
export function Lambda4_deps(f) {
    if (f instanceof Lambda4)
        return f.deps;
    else
        return [];
}
export function Lambda4_toFunction(f) {
    if (f instanceof Lambda4)
        return f.f;
    else
        return f;
}
export class Lambda5 {
    constructor(f, deps) {
        this.f = f;
        this.deps = deps;
    }
    f;
    deps;
}
export function lambda5(f, deps) {
    return new Lambda5(f, deps);
}
export function Lambda5_deps(f) {
    if (f instanceof Lambda5)
        return f.deps;
    else
        return [];
}
export function Lambda5_toFunction(f) {
    if (f instanceof Lambda5)
        return f.f;
    else
        return f;
}
export class Lambda6 {
    constructor(f, deps) {
        this.f = f;
        this.deps = deps;
    }
    f;
    deps;
}
export function lambda6(f, deps) {
    return new Lambda6(f, deps);
}
export function Lambda6_deps(f) {
    if (f instanceof Lambda6)
        return f.deps;
    else
        return [];
}
export function Lambda6_toFunction(f) {
    if (f instanceof Lambda6)
        return f.f;
    else
        return f;
}
export function toSources(deps) {
    const ss = [];
    for (let i = 0; i < deps.length; i++) {
        const dep = deps[i];
        ss.push(new Source(dep.getVertex__(), null));
    }
    return ss;
}
