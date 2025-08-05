#!/usr/bin/env ts-node
/**
 * Bitburner Netscript RAM‑audit tool
 *
 * Scans a TypeScript entrypoint plus all *transitively* imported `.ts` sources,
 * detects every `ns.xxx` Netscript API used, looks up the RAM cost from
 * `NetScriptDefinitions.d.ts`, and prints either a human‑readable table or
 * JSON (when `--json` flag is passed).
 *
 * Usage
 *   npx ts-node audit-ram.ts <entry-file> [--defs <path>] [--json]
 *
 * Example
 *   npx ts-node audit-ram.ts src/batch/main.ts --json > ram-report.json
 */

import {
    Project,
    SourceFile,
    InterfaceDeclaration,
    Node,
    PropertyAccessExpression,
    JSDoc,
    Identifier,
    Symbol as MorphSymbol,
} from 'ts-morph';
import path from 'node:path';
import fs from 'node:fs';
import yargs from 'yargs';
import { hideBin } from 'yargs/helpers';
import Table from 'cli-table3';

interface ApiInfo {
    name: string;
    ram: number | null; // null → unknown RAM cost
}

/**
 * Parse CLI args
 */
const argv = yargs(hideBin(process.argv))
    .scriptName('audit-ram')
    .usage('$0 <entry> [options]')
    .command('$0 <entry>', 'the default command', (yargs) => {
        yargs.positional('entry', {
            describe: 'Entry TypeScript file to audit (e.g., src/main.ts)',
            type: 'string',
            demandOption: true,
        });
    })
    .option('defs', {
        type: 'string',
        describe: 'Path to NetScriptDefinitions.d.ts',
        default: 'NetScriptDefinitions.d.ts',
    })
    .option('tsconfig', {
        type: 'string',
        describe: 'Path to tsconfig.json',
        default: 'tsconfig.json',
    })
    .option('json', {
        type: 'boolean',
        describe: 'Emit JSON instead of a table',
        default: false,
    })
    .parseSync();

const DEFINITIONS_PATH = path.resolve(argv.defs);
const TSCONFIG_PATH = path.resolve(argv.tsconfig);
const ENTRY_PATH = path.resolve(argv.entry as string);

if (!fs.existsSync(DEFINITIONS_PATH)) {
    console.error(
        `✖ Netscript definitions file not found: ${DEFINITIONS_PATH}`,
    );
    process.exit(1);
}
if (!fs.existsSync(TSCONFIG_PATH)) {
    console.error(`✖ TSConfig file not found: ${TSCONFIG_PATH}`);
    process.exit(1);
}
if (!fs.existsSync(ENTRY_PATH)) {
    console.error(`✖ Entry file not found: ${ENTRY_PATH}`);
    process.exit(1);
}

// ---------------------------------------------------------------------------
// 1. Build RAM catalog from NetScriptDefinitions.d.ts
// ---------------------------------------------------------------------------

const project = new Project({
    tsConfigFilePath: TSCONFIG_PATH,
    skipAddingFilesFromTsConfig: true,
});

const defsFile = project.addSourceFileAtPath(DEFINITIONS_PATH);
const nsInterface = defsFile.getInterfaceOrThrow('NS');
const nsSymbol = nsInterface.getSymbol();

const ramCatalog = new Map<string, number>();

function harvestInterface(iface: InterfaceDeclaration, prefix = ''): void {
    iface.getMembers().forEach((member) => {
        // Method = terminal Netscript API with RAM cost
        if (Node.isMethodSignature(member)) {
            const name = prefix + member.getName();
            const docs = member.getJsDocs();
            const ram = extractRam(member, docs);
            if (ram !== null) ramCatalog.set(name, ram);
        }
        // Property that itself is an interface → recurse (e.g., gang, stock)
        else if (Node.isPropertySignature(member)) {
            const propName = member.getName();
            const targetInterface = member
                .getType()
                .getSymbol()
                ?.getDeclarations()
                .find(Node.isInterfaceDeclaration);
            if (targetInterface) {
                harvestInterface(targetInterface, `${prefix}${propName}.`);
            }
        }
    });
}

function extractRam(node: Node, docs: JSDoc[]): number | null {
    const tag = docs
        .flatMap((d) => d.getTags())
        .find((t) => t.getTagName() === 'remarks');
    if (!tag) return null;
    const comment = tag.getCommentText() ?? '';
    const match = /RAM\s+cost:\s*([\d.]+)/i.exec(comment);
    return match ? Number(match[1]) : null;
}

defsFile.refreshFromFileSystemSync();
harvestInterface(nsInterface);

// ---------------------------------------------------------------------------
// 2. Collect all .ts source files reachable from the entrypoint
// ---------------------------------------------------------------------------

project.addSourceFileAtPath(ENTRY_PATH);
project.resolveSourceFileDependencies();

const visited = new Set<SourceFile>();
const pending: SourceFile[] = [project.getSourceFileOrThrow(ENTRY_PATH)];

while (pending.length) {
    const file = pending.pop()!;
    if (visited.has(file)) continue;
    visited.add(file);

    // enqueue referenced source files (transitive imports)
    for (const ref of file.getReferencedSourceFiles()) {
        // Only traverse real .ts files (skip .d.ts and .js transpiled outputs)
        const isTs =
            ref.getFilePath().endsWith('.ts')
            && !ref.getFilePath().endsWith('.d.ts');
        if (isTs) pending.push(ref);
    }
}

// ---------------------------------------------------------------------------
// 3. Scan each source file for ns.* API usage
// ---------------------------------------------------------------------------

const usedApis = new Set<string>();

for (const file of visited) {
    const aliases = collectNsAliases(file);
    file.forEachDescendant((node) => {
        if (Node.isCallExpression(node)) {
            const expr = node.getExpression();

            // Handle ns.foo.bar() patterns (PropertyAccessExpression / Chain)
            if (Node.isPropertyAccessExpression(expr)) {
                const api = extractNsChain(
                    expr as PropertyAccessExpression,
                    aliases,
                );
                if (api) usedApis.add(api);
            }
        }
    });
}

function isNsIdentifier(id: Identifier): boolean {
    const type = id.getType();
    const symbol = type.getSymbol();
    if (!symbol) return false;
    if (symbol === nsSymbol) return true;
    const alias = symbol.getAliasedSymbol?.();
    return alias === nsSymbol;
}

function collectNsAliases(file: SourceFile): Map<MorphSymbol, string> {
    const aliases = new Map<MorphSymbol, string>();
    file.forEachDescendant((node) => {
        if (Node.isVariableDeclaration(node)) {
            const nameNode = node.getNameNode();
            const init = node.getInitializer();
            if (!init) return;

            if (
                Node.isIdentifier(nameNode)
                && Node.isPropertyAccessExpression(init)
            ) {
                const chain = extractNsChain(init as PropertyAccessExpression);
                if (chain) {
                    const sym = nameNode.getSymbol();
                    if (sym) aliases.set(sym, chain);
                }
            } else if (
                Node.isObjectBindingPattern(nameNode)
                && Node.isIdentifier(init)
                && isNsIdentifier(init)
            ) {
                for (const elem of nameNode.getElements()) {
                    const prop =
                        elem.getPropertyNameNode()?.getText() ?? elem.getName();
                    const sym = elem.getNameNode().getSymbol();
                    if (sym) aliases.set(sym, prop);
                }
            }
        }
    });
    return aliases;
}

function extractNsChain(
    node: PropertyAccessExpression,
    aliases?: Map<MorphSymbol, string>,
): string | null {
    const parts: string[] = [];
    let current: Node = node;

    // Walk backwards through property access chain, collecting names
    while (Node.isPropertyAccessExpression(current)) {
        parts.unshift(current.getName());
        current = current.getExpression();
    }

    if (Node.isIdentifier(current)) {
        if (isNsIdentifier(current)) {
            return parts.join('.');
        }
        const sym = current.getSymbol();
        const alias = sym && aliases?.get(sym);
        if (alias) {
            return [alias, ...parts].join('.');
        }
    }
    return null;
}

// ---------------------------------------------------------------------------
// 4. Build report
// ---------------------------------------------------------------------------

const apiList: ApiInfo[] = Array.from(usedApis)
    .map<ApiInfo>((name) => ({ name, ram: ramCatalog.get(name) ?? null }))
    .sort((a, b) => {
        // APIs with known RAM first, then by RAM desc, then alphabetically
        if (a.ram === null && b.ram !== null) return 1;
        if (a.ram !== null && b.ram === null) return -1;
        if (a.ram !== null && b.ram !== null && Math.abs(b.ram - a.ram) > 0.001)
            return b.ram - a.ram;
        return a.name.localeCompare(b.name);
    });

const totalRam = apiList.reduce((sum, api) => sum + (api.ram ?? 0), 0);

// ---------------------------------------------------------------------------
// 5. Output
// ---------------------------------------------------------------------------

if (argv.json) {
    const out = {
        totalRam,
        apis: apiList,
    };
    console.log(JSON.stringify(out, null, 2));
} else {
    const table = new Table({
        head: ['Netscript API', 'RAM GB'],
        style: { head: ['bold'] },
    });
    apiList.forEach((api) => {
        table.push([api.name, api.ram === null ? '?' : api.ram.toFixed(2)]);
    });
    table.push([{ content: 'TOTAL', hAlign: 'right' }, totalRam.toFixed(2)]);
    console.log(table.toString());
}
