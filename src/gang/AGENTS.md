# Gang Contributor Guide

- The gang APIs are available through the `Gang` object through
  `ns.gang` found in the file `NetScriptDefinitions.d.ts`.
- Any script using the gang APIs must check if the user is in a gang
  using `ns.gang.inGang()`.
- Gang scripts should only run once per gang update tick by using `await ns.gang.nextUpdate()`.
- When making changes or enhancements to the design of the gang
  manager update the spec in `GANG_MANAGER_SPEC.md` to match the
  implementation.

`GANG_MANAGER_SPEC.md` outlines a phased approach for building a full
gang management system. It details the expected APIs, the progression
from a minimal MVP to advanced features like territory warfare, and the
data needed for decision making. Review it before modifying the gang
scripts so the implementation stays aligned with the plan.
