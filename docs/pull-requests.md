# Pull Request Review Instructions

When you are asked to review a Pull Request diff,
take a deep breath and provide a comprehensive review, including:

## 1 Correctness

- **Logic & Edge-Cases** — All branches produce the expected outcome; check off-by-one loops, empty arrays, null/undefined inputs.
- **State Mutations** — Functions avoid hidden side-effects unless explicitly intended; verify shared objects aren’t mutated unexpectedly.
- **Error Handling** — Throw or return meaningful errors; no silent failures or swallowed promises.
- **Bitburner APIs** — Validate that every `ns.*` call uses correct argument types, respects game constraints (e.g., hacking levels, file paths).
- **Regression Risk** — Run existing tests or sanity scripts to ensure no previous behaviour breaks.

## 2 Design & Architecture

- **Single Responsibility** — Modules/classes/functions do one cohesive thing; large blobs should be split.
- **Abstraction Boundaries** — Public interfaces hide implementation details; low coupling, high cohesion.
- **Extensibility** — Can new game mechanics or scripts be added without major rewrites?
- **Duplication** — Identify copy-pasted logic; extract helpers or utilities.
- **Bitburner Context** — Consider whether widely used APIs could be turned into a service to reduce RAM usage.

## 3 Readability & Style

- **Naming** — Variables, functions, and files convey intent; no abbreviations like `idx` unless domain-standard.
- **Structure** — Consistent indentation, spacing, brace style; follow `eslint/prettier` rules.
- **Comment Quality** — Explain _why_, not _what_; remove outdated comments.
- **JSDoc / Type Annotations** — Exported APIs and complex functions have clear signatures and examples.
- **Commit Messages** — Imperative, descriptive, reference issue/PR when relevant.

## 4 Testing

- **Coverage** — New logic includes unit or integration tests; critical paths (money calculations, RAM estimators) are covered.
- **Edge-Case Assertions** — Tests include failure conditions and boundary inputs.
- **Determinism** — No reliance on wall-clock time or game RNG without seeding/mocking.
- **Speed** — Tests run quickly; avoid 3-second `ns.sleep` in test contexts.

## 5 Performance & Resource Usage

- **Async Patterns** — Avoid tight `while(true)` with zero sleeps; insert `await ns.sleep(0)` or batched intervals.
- **Algorithmic Complexity** — Evaluate worst-case loops over potentially large inputs.
- **Memory Leaks** — No unbounded arrays or global caches without eviction.

## 6 Security & Safety

- **Input Validation** — Sanitize data from user CLI args (`ns.args`).
- **No Eval / Dynamic Imports** — Unless absolutely necessary and audited.
- **Secrets & Credentials** — Ensure no API keys, private URLs, or personal info committed.
- **Graceful Degradation** — Script fails safely if a dependency file is missing or a server disappears.

## 7 Documentation

- **README / Wiki** — Update usage examples, new command-line flags, and dependency setup.
- **Inline Examples** — Provide minimal “how to call” snippets in code comments for public helpers.
- **CHANGELOG** — Record user-facing changes, breaking or otherwise.

## 8 CI / Tooling

- **Build Passes** — `npmx jest`, `tsc`, `eslint`, `prettier` all green.
- **Type Safety** — No `any` creep; leverage generics where useful.
- **Lint Rules** — No new warnings introduced; autofix applied.

## 9 Dead Code & Housekeeping

- **Unused Variables / Functions** — Remove or `// eslint-disable-next-line` with justification.
- **Feature Flags / TODOs** — Link to an issue or mark with actionable owner + date; avoid permanent TODO clutter.

---

> **Tip for Reviewers**
>
> 1. Skim the PR description and linked issue for context.
> 2. Do a high-level pass (Correctness → Design) before nit-picking style.
> 3. Mark blocking items vs. optional suggestions.
> 4. Offer concrete fixes or code snippets to demonstrate alternatives.
