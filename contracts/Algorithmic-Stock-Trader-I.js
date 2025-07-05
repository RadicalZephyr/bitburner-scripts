/* Algorithmic Stock Trader I

You are given the following array of stock prices (which are numbers)
where the i-th element represents the stock price on day i:

72,148,128,33,71,9,2,163,155,107,2,98

Determine the maximum possible profit you can earn using at most one
transaction (i.e. you can only buy and sell the stock once). If no
profit can be made then the answer should be 0. Note that you have to
buy the stock before you can sell it.
*/
export async function main(ns) {
    let scriptName = ns.getScriptName();
    let contractPortNum = ns.args[0];
    if (typeof contractPortNum !== 'number') {
        ns.tprintf('%s contract run with non-number answer port argument', scriptName);
        return;
    }
    let contractDataJSON = ns.args[1];
    if (typeof contractDataJSON !== 'string') {
        ns.tprintf('%s contract run with non-string data argument. Must be a JSON string containing file, host and contract data.', scriptName);
        return;
    }
    let contractData = JSON.parse(contractDataJSON);
    ns.tprintf('contract data: %s', JSON.stringify(contractData));
    let answer = solve(contractData);
    ns.writePort(contractPortNum, JSON.stringify(answer));
}
function solve(data) {
    let profitableTrades = [];
    for (let i = 0; i < data.length - 1; ++i) {
        for (let j = i + 1; j < data.length; ++j) {
            if (data[i] < data[j]) {
                let trade = {
                    startDay: i,
                    endDay: j,
                    amount: data[j] - data[i]
                };
                profitableTrades.push(trade);
            }
        }
    }
    if (profitableTrades.length == 0) {
        return 0;
    }
    profitableTrades.sort((a, b) => b.amount - a.amount);
    return profitableTrades[0].amount;
}
