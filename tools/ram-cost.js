#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const ts = require('typescript');

function usage() {
    console.log('Usage: node tools/ram-cost.js <script>');
}

const target = process.argv[2];
if (!target) {
    usage();
    process.exit(1);
}

const ROOT = path.resolve(__dirname, '..');
const DEFINITIONS = path.join(ROOT, 'NetScriptDefinitions.d.ts');

function parseApiCosts(defPath) {
    const text = fs.readFileSync(defPath, 'utf8');
    const sf = ts.createSourceFile(defPath, text, ts.ScriptTarget.Latest, true);
    const interfaces = new Map();
    ts.forEachChild(sf, node => {
        if (ts.isInterfaceDeclaration(node)) {
            interfaces.set(node.name.text, node);
        }
    });

    const costs = {};

    function getCost(node) {
        if (!node.jsDoc) return null;
        for (const doc of node.jsDoc) {
            const match = /RAM cost:\s*([0-9.]+)\s*GB/.exec(doc.getText());
            if (match) return parseFloat(match[1]);
        }
        return null;
    }

    function visit(name, prefix) {
        const iface = interfaces.get(name);
        if (!iface) return;
        for (const m of iface.members) {
            if (!m.name) continue;
            const memberName = m.name.getText();
            if (ts.isMethodSignature(m)) {
                const cost = getCost(m);
                if (cost != null) {
                    costs[`${prefix}.${memberName}`] = cost;
                }
            } else if (ts.isPropertySignature(m) && m.type && ts.isTypeReferenceNode(m.type)) {
                visit(m.type.typeName.getText(), `${prefix}.${memberName}`);
            }
        }
    }

    visit('NS', 'ns');
    return costs;
}

const API_COSTS = parseApiCosts(DEFINITIONS);

const importRegex = /^\s*import[^\n]*? from ["'](.+?)["']/gm;

function resolveImport(base, spec) {
    function withExt(p) {
        if (!p.endsWith('.ts') && !p.endsWith('.js')) {
            if (fs.existsSync(p + '.ts')) return p + '.ts';
            if (fs.existsSync(p + '.js')) return p + '.js';
        }
        return p;
    }
    if (spec.startsWith('./') || spec.startsWith('../')) {
        return withExt(path.resolve(path.dirname(base), spec));
    } else if (spec.startsWith('/')) {
        return withExt(path.resolve(ROOT, spec.slice(1)));
    }
    return withExt(path.resolve(ROOT, 'src', spec));
}

function collectDependencies(file, visited = new Set()) {
    file = withExtension(file);
    if (visited.has(file)) return visited;
    visited.add(file);
    const content = fs.readFileSync(file, 'utf8');
    let match;
    while ((match = importRegex.exec(content))) {
        const dep = resolveImport(file, match[1]);
        if (fs.existsSync(dep)) {
            collectDependencies(dep, visited);
        }
    }
    return visited;
}

function withExtension(file) {
    if (!file.endsWith('.ts') && !file.endsWith('.js')) {
        if (fs.existsSync(file + '.ts')) return file + '.ts';
        return file + '.js';
    }
    return file;
}

function scanApis(files, costs) {
    const used = new Set();
    const names = Object.keys(costs);
    for (const file of files) {
        const text = fs.readFileSync(file, 'utf8');
        for (const name of names) {
            const pattern = new RegExp('\\b' + name.replace(/\./g, '\\.') + '\\b');
            if (pattern.test(text)) {
                used.add(name);
            }
        }
    }
    return used;
}

const start = withExtension(path.resolve(ROOT, target));
if (!fs.existsSync(start)) {
    console.error(`File not found: ${start}`);
    process.exit(1);
}

const deps = collectDependencies(start);
const files = Array.from(deps);
files.push(start);

const usedApis = scanApis(files, API_COSTS);

let total = 0;
for (const name of Array.from(usedApis).sort()) {
    const cost = API_COSTS[name];
    total += cost;
    console.log(`${name} - ${cost} GB`);
}
console.log(`Total RAM: ${total} GB`);
