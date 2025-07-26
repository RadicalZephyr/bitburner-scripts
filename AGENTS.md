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

## Authoring New Scripts

- Every script command-line argument, whether a flag or positional argument, should be type-checked using the typescript idiom (`typeof x != "string"`). The script should return early with an error message if the argument type is incorrect.
- Every new script that is created should have a `--help` flag that is shown when incorrect options are passed and displays a standard UNIX style usage message describing:
    - what the script does
    - examples of how to use it
    - all of the flags that the script takes
    - any CONFIG values that the script uses

Use this general structure:

```typescript
export async function main(ns: NS) {
    const flags = ns.flags([['help', false]]);

    if (flags.help) {
        ns.tprint(`
USAGE: run ${ns.getScriptName()}

{{ description }}

Example:
  > {{ exampleUsages }}

OPTIONS
  --help   Show this help message
`);
        return;
    }
}
```

## Script File Organization

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
- Check that the unit tests still run with `npx jest`
- Check that the code conforms to quality standards with `npx eslint src/`
- Fix any type or lint errors until the build completes with no errors or warnings

## Commit Authoring Convention

- Before committing run `npx prettier . --write` to format code.

Prefix every commit message with the name of the folder in source in
square brackets like "[batch]". If a commit touches files in multiple
directories use the folder name that the commit is most conceptually
linked to.

Acceptable prefixes include `[batch]`, `[stock]`, `[util]`, `[services]` and other
directory names under `src/`.

## Pull Request Review Instructions

When you are asked to review a Pull Request diff,
take a deep breath and provide a comprehensive review, including:

- Provide a comprehensive critique of the code, focusing on code clarity, quality, and readability.
- Identify the purpose behind the changes the author made.
- Discuss the pros and cons of the approach the author took.
- Look for opportunities to refactor duplicated or very similar code.
- Look for new code that mixes a lot of different responsibilities in an overly complex way.
- Suggest breaking up long functions into discrete conceptual units.
- Check conformance to repository contribution guidelines.
- Look for bugs, audit for any dead code.
- Give feedback on whether the code change is conceptually complete.

## Task Writing Instructions

- You don't need to include instructions from AGENTS.md in tasks you
  write. The running agent that the task is written for will already
  have access to the AGENTS.md file so we don't need to repeat it.
