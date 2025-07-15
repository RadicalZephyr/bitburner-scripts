## Comprehensive Gang Management Script Specification

This document outlines a phased development plan for a Bitburner gang management script, leveraging the available `ns.gang` APIs and exposed data structures to progress from a basic MVP to a full-featured, dynamic lifecycle controller including territory warfare.

---

### API Overview

#### Gang General Info (`ns.gang.getGangInformation()`)

Provides real-time metrics for decision-making:

```ts
interface GangGenInfo {
  faction: string;
  isHacking: boolean;
  moneyGainRate: number;
  power: number;
  respect: number;
  respectGainRate: number;
  respectForNextRecruit: number;
  territory: number;
  territoryClashChance: number;
  wantedLevel: number;
  wantedLevelGainRate: number;
  territoryWarfareEngaged: boolean;
  wantedPenalty: number;
}
```

#### Recruitment APIs

- `ns.gang.canRecruitMember(): boolean` — whether recruitment slot and respect permit recruiting
- `ns.gang.respectForNextRecruit(): number` — respect needed for next member
- `ns.gang.createMember(name: string)` — recruit new member

#### Member Info (`ns.gang.getMemberInformation(name)`)

Detailed per-member stats & gains:

```ts
interface GangMemberInfo { /* … see prompt for full fields … */ }
```

#### Task Stats (`ns.gang.getTaskStats(taskName)`)

Describes income, weights, and scaling:

```ts
interface GangTaskStats { /* … see prompt for full fields … */ }
```

#### Other Gangs & Warfare

- `ns.gang.getOtherGangInformation(): Record<string,GangOtherInfoObject>`
- `ns.gang.getChanceToWinClash(gangName): number`

---

## Phase 0: MVP — Recruit & Static Training

**Objective:** Automatically recruit up to 12 members and assign them to a fixed training task.

1. **RecruitmentManager**

   - Each tick: if `ns.gang.canRecruitMember()` is `true`, then:
     ```ts
     const nextReq = ns.gang.respectForNextRecruit();
     const curRespect = ns.gang.getGangInformation().respect;
     if (curRespect >= nextReq) {
       ns.gang.createMember(`GangMember${count+1}`);
     }
     ```

2. **TrainingAssignment**

   - Config: `trainingTask: string` (e.g. "Train Combat").
   - Each tick: for each `name` in `ns.gang.getMemberNames()`, call:
     ```ts
     ns.gang.setMemberTask(name, trainingTask);
     ```

3. **Configuration**

   - `MAX_MEMBERS = 12`
   - `trainingTask`

---

## Phase 1: Bootstrapping & Dynamic Thresholds

**Objective:** Ensure new recruits rapidly ascend to match existing multipliers before full deployment.

1. **Threshold Profiles by Member Count**

   ```ts
   interface Thresholds {
     trainLevel: number;
     ascendMult: number;
   }
   const thresholdsByCount: Record<number, Thresholds> = {
     1: {trainLevel: 100, ascendMult: 0.05},
     6: {trainLevel: 500, ascendMult: 0.10},
     12:{trainLevel:2000, ascendMult:0.15},
   };
   function getThresholds(n: number): Thresholds { /* find highest key ≤ n */ }
   ```

2. **LifecycleManager**

   - Track `MemberState` (`"bootstrapping" | "ready"`).
   - **Bootstrapping**: cycle between `trainingTask` and `ascend` until `ns.gang.getAscensionResult(name)` gain ≥ `ascendMult`.
   - Transition to `"ready"` once gain threshold met.

---

## Phase 2: Task Analysis & Split

**Objective:** Dynamically analyze available tasks and split ready members between respect and money earning.

1. **TaskAnalyzer**

   - Periodically fetch tasks:
     ```ts
     const tasks = ns.gang.getTaskNames().map(ns.gang.getTaskStats);
     const hackTasks = tasks.filter(t => t.isHacking);
     const combatTasks = tasks.filter(t => t.isCombat);
     ```
   - Compute yields using `GangMemberInfo` averages & current `territory` bonus.
   - Produce sorted lists:
     - `bestMoneyTasks`, `bestRespectTasks`, `bestWarTasks`.

2. **TaskBalancer**

   - Compute `respectDeficit = info.respectForNextRecruit - info.respect`.
   - Determine `respectFraction = clamp(respectDeficit / (respectGainRate * recruitHorizon), 0, 1)`.
   - Assign `respectFraction * readyCount` to `bestRespectTasks[0]`, rest to `bestMoneyTasks[0]`.

---

## Phase 3: Training Focus & Equipment

**Objective:** Select training tasks based on role profiles; purchase equipment via ROI.

1. **Role Profiles**

   - For each role (`bootstrapping`, `respectGrind`, `moneyGrind`, `warfare`), define:
     ```ts
     const profile: Partial<Record<Stat, number>> = averageWeights(tasksForRole);
     ```

2. **TrainingFocusManager**

   - Each tick, for each `"bootstrapping"` or `"training"` member:
     - Compare `profile.hack`, `profile.str`, …, `profile.cha` → assign `Train Hacking`, `Train Combat`, or `Train Charisma` accordingly.

3. **EquipmentManager**

   - For each member:
     1. Fetch `ns.gang.getMemberInformation(name)` & available gear via `ns.gang.getEquipmentNames()` + `ns.gang.getEquipmentStats(equip)`.
     2. Compute **ROI**: `cost / gainRate` (level/sec for training, money/sec for working).
     3. If `ROI <= maxROITime` for current role, call `ns.gang.purchaseEquipment(name, equip)`.

4. **Velocity-Based Ascension**

   - Maintain level history samples for each member.
   - Compute velocity (levels/sec); if `< velThresh[count]`, invoke `ns.gang.ascendMember(name)`.

---

## Phase 4: Territory Warfare & Full Orchestration

**Objective:** Integrate territory control, death handling, and holistic task/state coordination.

1. **TerritoryManager**

   - Every 20s: fetch `info = ns.gang.getGangInformation()`.
   - Compute `territoryBonus = f(info.territory)`.
   - Update TaskAnalyzer yields accordingly.

2. **Death & Re-Recruit**

   - Monitor `ns.gang.getMemberInformation().task === 'Unassigned'` or state changes.
   - If death detected and slots open, recruit new member.

3. **Full State Machine**

   ```text
   recruited
       ↓
   bootstrapping ↔ training ↔ ascending
       ↓
   ready
   ↙   ↓    ↘
   ```

respectGrind moneyGrind territoryWarfare ↘       ↗ ascend

```

4. **Dynamic Splits**
- Respect vs. cash vs. warfare assignments driven by:
  - `info.respectForNextRecruit` & `info.respect`
  - `moneyGainRate` deficits vs. gear/ascend budgets
  - `info.territory` vs. `otherGangs` territory
  - Clash win probabilities via `getChanceToWinClash`

---

### Next Steps
1. Choose initial threshold values for Phase 1.
2. Provide preferred recruit horizon and velocity thresholds.
3. Confirm which tasks you consider top candidates for respect, money, and warfare.

*Once these parameters are set, we can begin implementing modules in TypeScript.*

```
