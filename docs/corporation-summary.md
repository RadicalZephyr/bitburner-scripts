# Corporation Summary

This document condenses the key information from the corporation guide and its supporting articles.

## Gameplay Overview
- Corporations progress through a repeating cycle of **START → PURCHASE → PRODUCTION → EXPORT → SALE** every 10 seconds (or 1 second with bonus time).
- Read `corporation-management-handbook.lit` and script your actions when possible.
- Create an Agriculture division first and expand it to six cities, buying warehouses in each location.
- Maintain employee **energy** and **morale** by buying tea and throwing parties or by assigning interns when necessary.
- Use boost materials (AI Cores, Hardware, Real Estate, Robots) to raise the **division production multiplier**, which greatly increases output per city.

## Supply Chain Strategy
- Agriculture is the optimal starter industry. Pair it with a Chemical division for high quality input materials.
- Tobacco is the recommended product industry for late game profit. Other product industries have disadvantages such as low advertising factors or poor science factors.
- Export materials between divisions using the Export feature. A common export string is `(IPROD+IINV/10)*(-1)`.

## Office and Employees
- Upgrade office size via API for granular control. Energy and morale drop when offices reach nine or more employees. Maintain them with tea/parties or interns.
- Employee production is computed from job stats; Operations, Engineer and Management jobs contribute to raw production. Business employees increase sales volume, and Research & Development produces RP.

## Research, Upgrades and Unlocks
- **Unlocks**: Export (20b) and Smart Supply (25b if you do not script it) are essential. Demand and Competition data (5b each) enable custom Market‑TA2 scripts.
- **Upgrades**: Prioritize Smart Storage, Smart Factories and warehouses. Advert levels are useful after Wilson Analytics is purchased. Dream Sense is not worth buying.
- **Research**: Buy Hi-Tech R&D Laboratory first to increase RP gain. Focus on Overclock → Sti.mu → Automatic Drug Administration → Go-Juice → CPH4 Injections for energy, morale and stat boosts. Avoid the dashboard and autobrew/party research.
- Do not spend your entire RP pool at once; depleting it reduces product ratings.

## Warehouse and Smart Supply
- Warehouse upgrades increase storage size. Smart Supply scripts calculate required input materials and can detect congestion when production halts.
- When storage is limited, discard excess materials or adjust purchases to prevent congestion.

## Product Development
- Products require development time and only one product develops at a time. New products are usually far more profitable.
- Product stats (quality, performance, durability, reliability, aesthetics, features) derive from CreationJobFactors and RP. Design and advertising investments have small exponents and usually consume about 1% of available funds.
- Market‑TA2 (or a custom implementation) sets the best selling price. Market‑TA1 is typically skipped.

## Pricing and Sales
- `MaxSalesVolume` depends on item quality/effective rating, business employees, Advert level, Demand and Competition, and SalesBot upgrades.
- The markup multiplier rewards pricing below market price, stays neutral within the markup limit, and penalizes high prices. Market‑TA2 assumes all units can be sold and finds the highest profitable price.
- To compute markup limits manually, temporarily set a very high price, observe actual sales volume, and apply the formula from the optimal selling price article.

## Financials
- **TotalAssets** combines funds, recoupable values, and inventory value. Valuation is based on asset changes and scales with the number of offices and warehouses.
- Four investment rounds offer funds in exchange for shares. Always take them. Bribing factions unlocks at valuations above 100e12.
- Dividends pay shareholders and reduce retained earnings; Shady Accounting and Government Partnership lower dividend taxes.
- Share price trends toward a target based on valuation and ownership. Shares can be issued or bought back, subject to cooldowns and limits.

## Miscellaneous Tips
- Use dummy divisions (e.g., Restaurant) solely to raise valuation before investment offers.
- Noodles in New Tokyo formerly boosted revenue but is now negligible.
- "sudo.Assist" exists in code but cannot be unlocked.
- External libraries like Ceres Solver can help solve optimization problems such as boost material amounts or product markup calculations.

This summary highlights the critical mechanics and best practices for running a profitable corporation. For detailed formulas, proofs, and additional guidance, refer to the original documentation files.
