/** @param {NS} ns */
export async function main(ns) {
  let stockNumbers = [66,38,146,42,143,114,118,119,116,69,146,25,131,34,62,131,188];
  let totalProfit = 0;
  let previousValue = stockNumbers.shift();

  for (const dailyValue of stockNumbers) {
    if (previousValue < dailyValue) {}
  }
}
