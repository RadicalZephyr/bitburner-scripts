# Contributor Guide

## Development instructions

- After you finish coding a feature look at the code you generated for
  possible refactorings you could do to improve the code clarity and
  structure.
- Always include doc comments for exported functions (except the main
  and autocomplete functions).

## Dev Environment Tips

- Only work on code in the `src` directory.
- When building UI elements always use colors from the theme, which
  can be retrieved with `ns.ui.getTheme()`.
- Always format RAM values with `ns.formatRam()`
- Always format time values with `ns.tFormat()`
- Always format percentage values with `ns.formatPercent()`
- Always format money values with `ns.formatNumber()`

## Testing Instructions

- Check that the build still works with `npm run build`
- Fix any type errors until the build completes with no errors or warnings

## Commit Authoring Convention

Prefix every commit message with the name of the folder in source in
square brackets like "[batch]".
