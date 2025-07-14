import type { NS, CityName, CorpMaterialName, CorpIndustryData, Material, Product } from "netscript";

/** Data tracked between cycles for calculating input requirements. */
const SmartSupplyData: Record<string, number> = {};

/** Heuristic counters used for detecting warehouse congestion. */
const WarehouseCongestionData: Record<string, number> = {};

/**
 * Calculate the raw production for a city limited by free warehouse space.
 *
 * The returned value is scaled by the length of one cycle (10 seconds).
 *
 * @param ns - Netscript instance
 * @param division - Division name
 * @param city - City name
 * @param outputSize - Storage size for one unit of output
 * @param requiredMaterials - Map of input coefficients
 * @param isProduct - True when calculating production for a product
 * @returns Limited raw production units for this cycle
 */
export function getLimitedRawProduction(
    ns: NS,
    division: string,
    city: CityName,
    outputSize: number,
    requiredMaterials: Record<CorpMaterialName, number>,
    isProduct = false,
): number {
    const corp = ns.corporation;
    const office = corp.getOffice(division, city);
    const warehouse = corp.getWarehouse(division, city);
    const divisionInfo = corp.getDivision(division);

    const ops = office.employeeProductionByJob["Operations"];
    const eng = office.employeeProductionByJob["Engineer"];
    const man = office.employeeProductionByJob["Management"];
    const total = ops + eng + man;
    if (total === 0) return 0;

    const managementFactor = 1 + man / (1.2 * total);
    const employeeMult = (Math.pow(ops, 0.4) + Math.pow(eng, 0.3)) * managementFactor;
    const balancing = 0.05;
    let officeMult = balancing * employeeMult;
    if (isProduct) officeMult *= 0.5;

    const upgradeMult = 1 + 0.03 * corp.getUpgradeLevel("Smart Factories");
    const researchMult = 1; // approximation
    const rawProduction = officeMult * divisionInfo.productionMult * upgradeMult * researchMult;

    let limited = rawProduction * 10;

    let inputSpace = 0;
    for (const [mat, coeff] of Object.entries(requiredMaterials)) {
        inputSpace += coeff * corp.getMaterialData(mat as CorpMaterialName).size;
    }
    const requiredSpacePerUnit = outputSize - inputSpace;
    if (requiredSpacePerUnit > 0) {
        const freeSpace = warehouse.size - warehouse.sizeUsed;
        const maxUnits = freeSpace / requiredSpacePerUnit;
        if (limited > maxUnits) limited = Math.floor(maxUnits);
    }
    return limited;
}

function checkCongestion(ns: NS, division: string, city: CityName, outputs: (Material | Product)[]): boolean {
    const key = `${division}|${city}`;
    let counter = WarehouseCongestionData[key] ?? 0;
    let stalled = outputs.every(o => o.productionAmount === 0);
    counter = stalled ? counter + 1 : 0;
    WarehouseCongestionData[key] = counter;
    if (counter > 5) {
        ns.print(`WARN: warehouse congestion detected in ${division} ${city}`);
        return true;
    }
    return false;
}

function buyInputs(
    ns: NS,
    division: string,
    city: CityName,
    totalRawProduction: number,
    requiredMaterials: Record<CorpMaterialName, number>,
) {
    const corp = ns.corporation;
    const warehouse = corp.getWarehouse(division, city);
    const freeSpace = warehouse.size - warehouse.sizeUsed;

    const amounts: Record<CorpMaterialName, number> = {} as Record<CorpMaterialName, number>;
    let minUnits = totalRawProduction;
    for (const [name, coeff] of Object.entries(requiredMaterials)) {
        const material = corp.getMaterial(division, city, name);
        const required = totalRawProduction * coeff;
        const availableUnits = material.stored / coeff;
        if (availableUnits < minUnits) minUnits = availableUnits;
        amounts[name as CorpMaterialName] = Math.max(required - material.stored, 0);
    }

    if (minUnits < totalRawProduction) {
        for (const name of Object.keys(amounts)) {
            amounts[name as CorpMaterialName] = Math.max(minUnits * requiredMaterials[name as CorpMaterialName] - corp.getMaterial(division, city, name).stored, 0);
        }
    }

    let totalSize = 0;
    for (const [name, qty] of Object.entries(amounts)) {
        totalSize += qty * corp.getMaterialData(name as CorpMaterialName).size;
    }
    if (totalSize > freeSpace && totalSize > 0) {
        const mult = freeSpace / totalSize;
        for (const name of Object.keys(amounts)) {
            amounts[name as CorpMaterialName] *= mult;
        }
    }

    for (const [name, qty] of Object.entries(amounts)) {
        corp.buyMaterial(division, city, name, qty / 10);
    }
}

export async function main(ns: NS) {
    const corp = ns.corporation;
    if (!corp.hasCorporation()) {
        ns.tprint("ERROR: you must create a corporation first");
        return;
    }

    while (true) {
        const corpInfo = corp.getCorporation();
        for (const divName of corpInfo.divisions) {
            const division = corp.getDivision(divName);
            const industry = corp.getIndustryData(division.type);
            const reqMats = industry.requiredMaterials as Record<CorpMaterialName, number>;
            for (const city of division.cities) {
                const key = `${divName}|${city}`;

                if (corpInfo.prevState === "PURCHASE") {
                    let total = 0;
                    if (industry.makesMaterials && industry.producedMaterials) {
                        for (const mat of industry.producedMaterials) {
                            const data = corp.getMaterialData(mat);
                            total += getLimitedRawProduction(ns, divName, city, data.size, reqMats);
                        }
                    }
                    if (industry.makesProducts) {
                        for (const prodName of division.products) {
                            const prod = corp.getProduct(divName, city, prodName);
                            if (prod.developmentProgress >= 100) {
                                total += getLimitedRawProduction(ns, divName, city, prod.size, reqMats, true);
                            }
                        }
                    }
                    SmartSupplyData[key] = total;
                } else if (corpInfo.nextState === "PURCHASE") {
                    const outputs: (Material | Product)[] = [];
                    if (industry.makesMaterials && industry.producedMaterials) {
                        for (const mat of industry.producedMaterials) {
                            outputs.push(corp.getMaterial(divName, city, mat));
                        }
                    }
                    if (industry.makesProducts) {
                        for (const prodName of division.products) {
                            const prod = corp.getProduct(divName, city, prodName);
                            if (prod.developmentProgress >= 100) outputs.push(prod);
                        }
                    }
                    const congested = checkCongestion(ns, divName, city, outputs);
                    if (!congested) {
                        const totalRaw = SmartSupplyData[key] ?? 0;
                        if (totalRaw > 0) buyInputs(ns, divName, city, totalRaw, reqMats);
                    } else {
                        for (const mat of Object.keys(reqMats)) {
                            corp.sellMaterial(divName, city, mat, "MAX", "0");
                            corp.buyMaterial(divName, city, mat, 0);
                        }
                    }
                }
            }
        }
        await corp.nextUpdate();
    }
}
