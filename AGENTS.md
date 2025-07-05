# Contributor Guide

## Development instructions

- After you finish coding a feature look at the code you generated for
  possible refactorings you could do to improve the code clarity and
  structure.
- Always include doc comments for exported functions (except the main
  and autocomplete functions).


## Terminology used to classify hosts

We use two terms to identify different types of hosts:

- Workers: any server where `ns.getServerMaxRam(host) > 0`
- Targets: any server where `ns.getServerMaxMoney(host) > 0`

Any individual host can be both a Worker and a Target simultaneously.


## Dev Environment Tips

- Only work on code in the `src` directory.
- When building UI elements always use colors from the theme, which
  can be retrieved with `ns.ui.getTheme()`.
- Reference the available Netcript APIs listed in
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

- `"ERROR: "`: The whole string will be printed in red. Use this prefix to indicate
  that an error has occurred.

- `"SUCCESS: "`: The whole string will be printed in green, similar to the default
  theme of the Terminal. Use this prefix to indicate that something is correct.

- `"WARN: "`: The whole string will be printed in yellow. Use this prefix to
  indicate that you or a user of your script should be careful of something.

- `"INFO: "`: The whole string will be printed in purplish blue. Use this prefix to
  remind yourself or a user of your script of something. Think of this prefix as
  indicating an FYI (for your information).



### Formatting Tips

- Always format RAM values with `ns.formatRam()`
- Always format time values with `ns.tFormat()`
- Always format percentage values with `ns.formatPercent()`
- Always format money values with `ns.formatNumber()`


## Authoring New Scripts

- Every script command-line argument, whether a flag or positional
  argument, should be type-checked using the typescript idiom (`typeof x !=
  "string"`). The script should return early with an error message if
  the argument type is incorrect.
- Every new script that is created should have a `--help` flag that is
  shown when incorrect options are passed and displays a standard UNIX
  style usage message describing:
  * what the script does
  * examples of how to use it
  * all of the flags that the script takes
  * any CONFIG values that the script uses

Use this general structure:

```typescript
export async function main(ns: NS) {
    const flags = ns.flags([
        ['help', false]
    ]);

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

## Limitations of the Netscript2 Runtime Environment

* There is a bug in the implementation of `NetscriptPort.nextWrite`
  that makes it impossible to listen to two different ports from the
  same script. This is the reason that all services listen on a single
  port.

## Testing Instructions

- Check that the build still works with `npm run build`
- Check that the unit tests still run with `npx jest`
- Fix any type errors until the build completes with no errors or warnings


## Commit Authoring Convention

Prefix every commit message with the name of the folder in source in
square brackets like "[batch]".
