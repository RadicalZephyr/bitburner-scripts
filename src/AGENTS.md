# Minimizing Netscript RAM Usage

Each Netscript function has a RAM cost noted in its JSDoc comments.
Bitburner decides how much memory a script needs by scanning the text
of that script and any modules it imports. The scanner simply looks for
API function names. If the name appears anywhere—even in comments or in
unused functions—its RAM cost is added to the total.

This means that importing a module brings in the cost of **every** NS
function used in that module, regardless of which parts of it you
actually call. Mentioning an API function in a comment can also inflate
the cost.

To keep RAM usage low:

1. Avoid referencing NS APIs you do not use.
2. Keep modules small and focused so that imported files contain only
   the APIs you need.
3. Be careful when documenting code; quoting NS function names may raise
   the calculated cost.

Following these guidelines will prevent unused APIs from counting
against your script's RAM budget.

## RAM-Footprint Audit Policy

**Why we do this**

Auditing before and after every change makes sure we don’t
unintentionally pull in high-cost APIs.

---

### 1  When to audit

1. **New script** — run once before opening the PR.
2. **Modifying an existing script** — run **twice**:

   * **Baseline**: on the current `main` branch.
   * **Post-edit**: on your working branch.

---

### 2  How to audit

```bash
npm run audit-ram <path/to/script.ts>         # human-readable table
npm run audit-ram <path/to/script.ts> --json  # machine-readable dump
```

---

#### 3  What to do with the results

| Scenario                      | Action                                                                                                                        |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| **RAM unchanged or lower**    | Note it in the PR description (e.g., “No RAM delta”).                                                                         |
| **RAM increases**             | 1) List the new APIs added and their individual costs.<br>2) Explain why the extra RAM is justified (feature, bug fix, etc.). |
| **Unknown (‘?’) RAM entries** | Double-check you didn’t reference a dynamic property or typo; submit an issue if the definition file is missing data.         |
