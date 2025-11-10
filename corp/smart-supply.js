import { parseFlags } from 'util/flags';
import { DispatchClient } from 'services/client/dispatch';
export async function main(ns) {
    await parseFlags(ns, []);
    const corp = ns.corporation;
    if (!corp.hasCorporation()) {
        ns.tprint('ERROR: you must create a corporation first');
        return;
    }
    /** Data tracked between cycles for calculating input requirements. */
    const SmartSupplyData = {};
    /** Heuristic counters used for detecting warehouse congestion. */
    const WarehouseCongestionData = {};
    await manageSupply(ns, SmartSupplyData, WarehouseCongestionData);
}
async function manageSupply(ns, SmartSupplyData, WarehouseCongestionData) {
    const dispatchClient = new DispatchClient(ns);
    const _ns = dispatchClient.dispatch.bind(dispatchClient);
    while (true) {
        const corpInfo = await _ns('corporation.getCorporation');
        for (const divName of corpInfo.divisions)
            await manageDivisionSupply(ns, _ns, SmartSupplyData, WarehouseCongestionData, corpInfo, divName);
        await ns.corporation.nextUpdate();
    }
}
async function manageDivisionSupply(ns, _ns, SmartSupplyData, WarehouseCongestionData, corpInfo, divName) {
    const division = await _ns('corporation.getDivision', divName);
    const industry = await _ns('corporation.getIndustryData', division.type);
    const reqMats = industry.requiredMaterials;
    for (const city of division.cities) {
        manageDivisionRegionSupply(ns, SmartSupplyData, WarehouseCongestionData, corpInfo, division, industry, city, reqMats);
    }
}
function manageDivisionRegionSupply(ns, SmartSupplyData, WarehouseCongestionData, corpInfo, division, industry, city, reqMats) {
    const corp = ns.corporation;
    const divName = division.name;
    const key = `${divName}|${city}`;
    if (corpInfo.prevState === 'PURCHASE') {
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
    }
    else if (corpInfo.nextState === 'PURCHASE') {
        const outputs = [];
        if (industry.makesMaterials && industry.producedMaterials) {
            for (const mat of industry.producedMaterials) {
                outputs.push(corp.getMaterial(divName, city, mat));
            }
        }
        if (industry.makesProducts) {
            for (const prodName of division.products) {
                const prod = corp.getProduct(divName, city, prodName);
                if (prod.developmentProgress >= 100)
                    outputs.push(prod);
            }
        }
        const congested = checkCongestion(ns, WarehouseCongestionData, divName, city, outputs);
        if (!congested) {
            const totalRaw = SmartSupplyData[key] ?? 0;
            if (totalRaw > 0)
                buyInputs(ns, divName, city, totalRaw, reqMats);
        }
        else {
            for (const mat of Object.keys(reqMats)) {
                corp.sellMaterial(divName, city, mat, 'MAX', '0');
                corp.buyMaterial(divName, city, mat, 0);
            }
        }
    }
}
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
export function getLimitedRawProduction(ns, division, city, outputSize, requiredMaterials, isProduct = false) {
    const office = ns.corporation.getOffice(division, city);
    const warehouse = ns.corporation.getWarehouse(division, city);
    const divisionInfo = ns.corporation.getDivision(division);
    const ops = office.employeeProductionByJob['Operations'];
    const eng = office.employeeProductionByJob['Engineer'];
    const man = office.employeeProductionByJob['Management'];
    const total = ops + eng + man;
    if (total === 0)
        return 0;
    const managementFactor = 1 + man / (1.2 * total);
    const employeeMult = (Math.pow(ops, 0.4) + Math.pow(eng, 0.3)) * managementFactor;
    const balancing = 0.05;
    let officeMult = balancing * employeeMult;
    if (isProduct)
        officeMult *= 0.5;
    const upgradeMult = 1 + 0.03 * ns.corporation.getUpgradeLevel('Smart Factories');
    const researchMult = 1; // approximation
    const rawProduction = officeMult * divisionInfo.productionMult * upgradeMult * researchMult;
    let limited = rawProduction * 10;
    let inputSpace = 0;
    for (const [mat, coeff] of Object.entries(requiredMaterials)) {
        inputSpace +=
            coeff
                * ns.corporation.getMaterialData(mat).size;
    }
    const requiredSpacePerUnit = outputSize - inputSpace;
    if (requiredSpacePerUnit > 0) {
        const freeSpace = warehouse.size - warehouse.sizeUsed;
        const maxUnits = freeSpace / requiredSpacePerUnit;
        if (limited > maxUnits)
            limited = Math.floor(maxUnits);
    }
    return limited;
}
function checkCongestion(ns, WarehouseCongestionData, division, city, outputs) {
    const key = `${division}|${city}`;
    let counter = WarehouseCongestionData[key] ?? 0;
    const stalled = outputs.every((o) => o.productionAmount === 0);
    counter = stalled ? counter + 1 : 0;
    WarehouseCongestionData[key] = counter;
    if (counter > 5) {
        ns.print(`WARN: warehouse congestion detected in ${division} ${city}`);
        return true;
    }
    return false;
}
function buyInputs(ns, division, city, totalRawProduction, requiredMaterials) {
    const corp = ns.corporation;
    const warehouse = corp.getWarehouse(division, city);
    const freeSpace = warehouse.size - warehouse.sizeUsed;
    const amounts = {};
    let minUnits = totalRawProduction;
    for (const [name, coeff] of Object.entries(requiredMaterials)) {
        const material = corp.getMaterial(division, city, name);
        const required = totalRawProduction * coeff;
        const availableUnits = material.stored / coeff;
        if (availableUnits < minUnits)
            minUnits = availableUnits;
        amounts[name] = Math.max(required - material.stored, 0);
    }
    if (minUnits < totalRawProduction) {
        for (const name of Object.keys(amounts)) {
            amounts[name] = Math.max(minUnits * requiredMaterials[name]
                - corp.getMaterial(division, city, name).stored, 0);
        }
    }
    let totalSize = 0;
    for (const [name, qty] of Object.entries(amounts)) {
        totalSize += qty * corp.getMaterialData(name).size;
    }
    if (totalSize > freeSpace && totalSize > 0) {
        const mult = freeSpace / totalSize;
        for (const name of Object.keys(amounts)) {
            amounts[name] *= mult;
        }
    }
    for (const [name, qty] of Object.entries(amounts)) {
        corp.buyMaterial(division, city, name, qty / 10);
    }
}
