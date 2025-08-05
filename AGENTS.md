# Contributor Guide

## Development instructions

- After you finish coding a feature look at the code you generated for
  possible refactorings you could do to improve the code clarity and
  structure. Try to simplify the code produced instead of adding
  complexity. When it makes sense reduce duplicated code by
  introducing new helper methods.
- Always include JSDoc formatted doc comments for exported functions
  (except the main and autocomplete functions). These functions should
  document the arguments and return values using standard
  formatting. And a clear but concise description of the function. The
  length of the doc comment should be inversely proportional to the
  length and complexity of the function.

    Example:

    ```typescript
    /**
     * Get available money on a host.
     *
     * @param ns - Netscript API
     * @param host - Host to query
     * @returns Amount of money on the server
     */
    export function getMoney(ns: NS, host: string): number {
        return ns.getServerMoneyAvailable(host);
    }
    ```

- Imports should never include the file extension and should be full
  paths specified relative to the `src/` directory. So
  `src/batch/sow.ts` would be referenced as `batch/sow`.
- When moving code, retain any existing explanatory comments.
- Particularly complex code segments should have comments describing
  important context for why the code is doing what it does.
- See also [`docs/contributing.md`](docs/contributing.md) for a quick
  overview of the build and release workflow.

## Terminology used to classify hosts

We use two terms to identify different types of hosts:

- Workers: any server where `ns.getServerMaxRam(host) > 0`
- Targets: any server where `ns.getServerMaxMoney(host) > 0`

Any individual host can be both a Worker and a Target simultaneously.

## Dev Environment Tips

- Only work on code in the `src` directory.
- When building UI elements always use colors from the theme, which
  can be retrieved with `ns.ui.getTheme()`.
- Reference the available Netscript APIs listed in
  `NetScriptDefinitions.d.ts`.
- When using `Config` values we should never cache the config value in
  a variable. These values can be updated by the user and we always
  want to use the current value. This lets the user affect the
  behavior of running scripts without having to restart them.

### Logging Tips

- Prefer to format logging calls using `ns.print()` and passing in an
  interpolation string.

You can color code messages passed to `ns.print` by prefixing your
string with one of these strings:

- `"ERROR: "`: The whole string will be printed in red. Use this prefix to indicate that an error has occurred.
- `"SUCCESS: "`: The whole string will be printed in green, similar to the default theme of the Terminal. Use this prefix to indicate that something is correct.
- `"WARN: "`: The whole string will be printed in yellow. Use this prefix to indicate that you or a user of your script should be careful of something.
- `"INFO: "`: The whole string will be printed in purplish blue. Use this prefix to remind yourself or a user of your script of something. Think of this prefix as indicating an FYI (for your information).

### Formatting Tips

- Always format RAM values with `ns.formatRam()`
- Always format time values with `ns.tFormat()`
- Always format percentage values with `ns.formatPercent()`
- Always format money values with `ns.formatNumber()`

### Using `ns.atExit` safely

The `ns.atExit` API provides a powerful capability to register code to
run when a script exits for any reason. It has a significant potential
gotcha though, in that the optional second `name` argument must be
unique. If multiple `atExit` handler functions are registered with the
same name (or no name), then only the last one gets saved and
eventually run.

When building reusable APIs that rely on `atExit` for proper cleanup
it is best-practice to always append an `Fuid` (`src/util/fuid.ts`) to
the descriptive name of your `atExit` handler to ensure that even if
the API is called multiple times in the same script, each `atExit`
handler will have a unique name.

## Authoring New Scripts

- Every script command-line argument, whether a flag or positional argument, should be type-checked using the typescript idiom (`typeof x != "string"`). The script should return early with an error message if the argument type is incorrect.
- Every new script that is created should have a `--help` flag that is shown when incorrect options are passed and displays a standard UNIX style usage message describing:
    - what the script does
    - examples of how to use it
    - all of the flags that the script takes
    - any CONFIG values that the script uses

Use this general structure:

```typescript
import type { NS, AutocompleteData, ScriptArg } from 'netscript';
import { FlagsSchema, parseFlags } from 'util/flags';

const FLAGS = [['help', false]] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData): string[] {
    data.flags(FLAGS);
    return [];
}

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    if (flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

{{ description }}

Example:
  > {{ exampleUsages }}

OPTIONS
  --help   Show this help message
  {{ other FLAGS options }}

CONFIGURATION
  {{ CONFIG values used }}
`);
        return;
    }
}
```

### Script File Organization

We organize the content of all script files in a consistent manner to
make navigating the code easier and quicker. Scripts should be
organized as follows:

```
{{ imports }}

{{ autocompleteFunction }}

{{ mainFunction }}

{{ exportedTypeDefinitions }}

{{ typeDefinitions }}

{{ exportedFunctions }}

{{ classDefinitions }}

{{ helperFunctions }}
```

- Any of these sections may be omitted if there is no corresponding
  content.
- Main functions should remain short and lean, delegating to helper
  functions for the majority of their functionality.

## Limitations of the Netscript2 Runtime Environment

- There is a bug in the implementation of `NetscriptPort.nextWrite`
  that makes it impossible to listen to two different ports from the
  same script. This is the reason that all services listen on a single
  port.

## Testing Instructions

- Run `npm install` to ensure dependencies are installed
- Check that the build still works with `npm run build`
- Check that the unit tests pass with `npm run codex-test`
- Check that the code conforms to quality standards with `npm run lint`
- Fix any type or lint errors until the build completes with no errors or warnings

## Commit Authoring Convention

- Before committing run `npm run format` to format code.

Prefix every commit message with the name of the folder in source in
square brackets like "[batch]". If a commit touches files in multiple
directories use the folder name that the commit is most conceptually
linked to.

Acceptable prefixes include `[batch]`, `[stock]`, `[util]`, `[services]` and other
directory names under `src/`.

For wide reaching changes that are not specific to one subsection of
the code, it is acceptable to instead use a prefix like `[refactor]`.

Other specific prefixes for specific parts of the code:

- Changes to `AGENTS.md` files should be prefixed with `[AGENTS]`.
- Changes to the scripts in the `build/` directory should be prefixed with `[build]`

The first word after the prefix should be capitalized.

The body of the commit should contain a summary of the intent of the
changes. Very simple pull requests that are adequately explained by
the summary line may omit the body.

## Pull Request Review Instructions

When you are asked to review a Pull Request diff,
take a deep breath and provide a comprehensive review, including:

### 1 Correctness

- **Logic & Edge-Cases** — All branches produce the expected outcome; check off-by-one loops, empty arrays, null/undefined inputs.
- **State Mutations** — Functions avoid hidden side-effects unless explicitly intended; verify shared objects aren’t mutated unexpectedly.
- **Error Handling** — Throw or return meaningful errors; no silent failures or swallowed promises.
- **Bitburner APIs** — Validate that every `ns.*` call uses correct argument types, respects game constraints (e.g., hacking levels, file paths).
- **Regression Risk** — Run existing tests or sanity scripts to ensure no previous behaviour breaks.

### 2 Design & Architecture

- **Single Responsibility** — Modules/classes/functions do one cohesive thing; large blobs should be split.
- **Abstraction Boundaries** — Public interfaces hide implementation details; low coupling, high cohesion.
- **Extensibility** — Can new game mechanics or scripts be added without major rewrites?
- **Duplication** — Identify copy-pasted logic; extract helpers or utilities.
- **Bitburner Context** — Consider whether widely used APIs could be turned into a service to reduce RAM usage.

### 3 Readability & Style

- **Naming** — Variables, functions, and files convey intent; no abbreviations like `idx` unless domain-standard.
- **Structure** — Consistent indentation, spacing, brace style; follow `eslint/prettier` rules.
- **Comment Quality** — Explain _why_, not _what_; remove outdated comments.
- **JSDoc / Type Annotations** — Exported APIs and complex functions have clear signatures and examples.
- **Commit Messages** — Imperative, descriptive, reference issue/PR when relevant.

### 4 Testing

- **Coverage** — New logic includes unit or integration tests; critical paths (money calculations, RAM estimators) are covered.
- **Edge-Case Assertions** — Tests include failure conditions and boundary inputs.
- **Determinism** — No reliance on wall-clock time or game RNG without seeding/mocking.
- **Speed** — Tests run quickly; avoid 3-second `ns.sleep` in test contexts.

### 5 Performance & Resource Usage

- **Async Patterns** — Avoid tight `while(true)` with zero sleeps; insert `await ns.sleep(0)` or batched intervals.
- **Algorithmic Complexity** — Evaluate worst-case loops over potentially large inputs.
- **Memory Leaks** — No unbounded arrays or global caches without eviction.

### 6 Security & Safety

- **Input Validation** — Sanitize data from user CLI args (`ns.args`).
- **No Eval / Dynamic Imports** — Unless absolutely necessary and audited.
- **Secrets & Credentials** — Ensure no API keys, private URLs, or personal info committed.
- **Graceful Degradation** — Script fails safely if a dependency file is missing or a server disappears.

### 7 Documentation

- **README / Wiki** — Update usage examples, new command-line flags, and dependency setup.
- **Inline Examples** — Provide minimal “how to call” snippets in code comments for public helpers.
- **CHANGELOG** — Record user-facing changes, breaking or otherwise.

### 8 CI / Tooling

- **Build Passes** — `npmx jest`, `tsc`, `eslint`, `prettier` all green.
- **Type Safety** — No `any` creep; leverage generics where useful.
- **Lint Rules** — No new warnings introduced; autofix applied.

### 9 Dead Code & Housekeeping

- **Unused Variables / Functions** — Remove or `// eslint-disable-next-line` with justification.
- **Feature Flags / TODOs** — Link to an issue or mark with actionable owner + date; avoid permanent TODO clutter.

---

> **Tip for Reviewers**
>
> 1. Skim the PR description and linked issue for context.
> 2. Do a high-level pass (Correctness → Design) before nit-picking style.
> 3. Mark blocking items vs. optional suggestions.
> 4. Offer concrete fixes or code snippets to demonstrate alternatives.

## Task Writing Instructions

- You don't need to include instructions from AGENTS.md in tasks you
  write. The running agent that the task is written for will already
  have access to the AGENTS.md file so we don't need to repeat it.
