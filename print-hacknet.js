export async function main(ns) {
    const lastNode = ns.hacknet.numNodes() - 1;
    let i = 0;
    let levelsCost = [];
    while (++i > 0) {
        let levelCost = ns.hacknet.getLevelUpgradeCost(lastNode, i);
        if (levelCost == Infinity || levelCost == 0) {
            break;
        }
        levelsCost.push(levelCost);
        await ns.sleep(1);
    }
    const levelsText = levelsCost.map((level, index) => `${index + 1}, ${level}`).join('\n');
    await ns.write("levels.txt", levelsText);
}
