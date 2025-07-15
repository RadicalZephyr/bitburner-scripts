## Comprehensive Gang Management Script Specification

This document outlines a phased development plan for a Bitburner gang management script, leveraging the available `ns.gang` APIs and exposed data structures to progress from a basic MVP to a full-featured, dynamic lifecycle controller including territory warfare and wanted level management.

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

- `ns.gang.getOtherGangInformation(): Record<string, GangOtherInfoObject>`
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

   - Determine `trainingTask` from the gang type
     (`"Train Hacking"` or `"Train Combat"`).
   - Each tick: for each `name` in `ns.gang.getMemberNames()`, call:
     ```ts
     ns.gang.setMemberTask(name, trainingTask);
     ```

3. **Configuration**

   - `MAX_MEMBERS = 12`

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

   - Track `MemberState`: `"bootstrapping" | "ready"`.
   - **Bootstrapping**: cycle training ↔ ascend until ascension gain ≥ `ascendMult`.
   - Transition to `"ready"` once gain threshold met.

---

## Phase 2: Task Analysis & Split

**Objective:** Dynamically analyze available tasks and split ready members between respect and money earning.

1. **TaskAnalyzer**
   - Periodically fetch task stats via `ns.gang.getTaskNames()` + `ns.gang.getTaskStats()`.
   - Separate by `isHacking` and `isCombat`, compute per-second yields incorporating current territory bonus.
   - Generate sorted lists: `bestMoneyTasks`, `bestRespectTasks`, `bestWarTasks`.

2. **TaskBalancer**
   - Fetch `GangGenInfo` to compute:
     ```ts
     respectDeficit = respectForNextRecruit - respect;
     respectFraction = clamp(respectDeficit / (respectGainRate * recruitHorizon), 0, 1);
     ```
   - Assign `respectFraction * readyCount` members to `bestRespectTasks[0]`, rest to `bestMoneyTasks[0]`.

---

## Phase 3: Wanted Level Management & Balancing

**Objective:** Maintain a low wanted level penalty while continuing to earn respect and money.

1. **WantedInfo Monitoring**
   - Each tick, fetch `wantedLevel`, `wantedLevelGainRate`, and `wantedPenalty` from `GangGenInfo`.

2. **WantedTaskBalancer**
   - Define `maxWantedPenalty` threshold (e.g., 0.9).
   - If `wantedPenalty > maxWantedPenalty`, assign additional members to a cooling task (lowest `baseWanted` and high penalty reduction).
   - Else maintain base split from Phase 2 between respect and money tasks.

3. **CoolingTask Analysis**
   - From `TaskAnalyzer`, identify tasks with negative or lowest `wantedLevelGainRate` (i.e., best for cooling).
   - Integrate into split logic:
     ```ts
     if (wantedPenalty > maxWantedPenalty) {
       assignCoolingCount members to bestCooldownTask;
     }
     distributeRemaining between respect & money tasks as before;
     ```

4. **Configuration**
   - `maxWantedPenalty`
   - `coolingTaskList` (from `TaskAnalyzer`)

---

## Phase 4: Training Focus & Equipment

**Objective:** Select training tasks based on role profiles; purchase equipment via ROI.

1. **Role Profiles**
   - For roles (`bootstrapping`, `respectGrind`, `moneyGrind`, `warfare`, `cooling`), compute average weight vectors from `GangTaskStats`.

2. **TrainingFocusManager**
   - For each training-phase member, compare profile weights to assign `Train Hacking`, `Train Combat`, or `Train Charisma`.

3. **EquipmentManager**

   - For each member:
     1. Fetch `ns.gang.getMemberInformation(name)` & available gear via `ns.gang.getEquipmentNames()` + `ns.gang.getEquipmentStats(equip)`.
     2. Compute **ROI**: `cost / gainRate` (level/sec for training, money/sec for working).
     3. If `ROI <= maxROITime` for current role, call `ns.gang.purchaseEquipment(name, equip)`.

4. **Velocity-Based Ascension**

   - Track level history and compute velocity (levels/sec).
   - Compute velocity (levels/sec); if `< velThresh[count]`, invoke `ns.gang.ascendMember(name)`.

---

## Phase 5: Territory Warfare & Full Orchestration

**Objective:** Integrate territory control, death handling, and holistic task/state coordination.

1. **TerritoryManager**

   - Every 20s: fetch `info = ns.gang.getGangInformation()`.
   - Compute `territoryBonus = f(info.territory)`.
   - Update TaskAnalyzer yields accordingly.

2. **Death & Re-Recruit**

   - Detect deaths via member state or unassigned task.
   - On death and available slot, recruit new member.

3. **Full State Machine**

   ```text
   recruited → bootstrapping ↔ training ↔ ascending
                      ↓
                    ready
              ↙       ↓       ↘
        respectGrind moneyGrind territoryWarfare
              ↖       ↓       ↗
               cooling
   ```

4. **Dynamic Splits**
   - Balance respect, money, cooling, and warfare based on:
     - Next recruit respect needs
     - Money requirements for gear/ascends
     - Current `wantedPenalty`
     - `territory` deficits & clash probabilities

---

### Next Steps
1. Choose initial threshold values for Phases 1 & 3 (`trainLevel`, `ascendMult`, `maxWantedPenalty`).
2. Provide preferred `recruitHorizon`, `velThresh`, and `maxROITime` for each role.
3. Confirm top candidate tasks for respect, money, cooling, and warfare.

*Once parameters are set, we can begin implementing modules in TypeScript.*
