import type { NS, AutocompleteData, NSEnums } from '@ns';
import { FlagsSchema, parseFlags } from 'util/flags';

import { d3 } from 'lib/d3';
import { Plot } from 'lib/plot';
import { React } from 'lib/react';

import { TickData } from 'stock/data';
import { TrackerClient } from 'stock/client/tracker';

const FLAGS = [
    ['company', ''],
    ['help', false],
] as const satisfies FlagsSchema;

export function autocomplete(data: AutocompleteData, args: string[]): string[] {
    data.flags(FLAGS);

    const secondLast = args.at(-2);
    const last = args.at(-1);

    const flag = '--company';
    const companyNames = allCompanyNames(data.enums).map((name) =>
        JSON.stringify(name),
    );

    if (last === flag) return companyNames;

    if (secondLast === flag)
        return companyNames.filter((c) => c.startsWith(last));

    return [];
}

export async function main(ns: NS) {
    const flags = await parseFlags(ns, FLAGS);

    if (flags.help || flags.company === '') {
        ns.tprint(`
USAGE: run ${ns.getScriptName()} --company COMPANY_NAME

Display a chart of all the stocks.

Example:
  > run ${ns.getScriptName()}

OPTIONS
  --company  Company to visualize stock price for
  --help     Show this help message
`);
        return;
    }

    await displayChartsAndStuff(ns, flags.company);
}

async function displayChartsAndStuff(ns: NS, company: string) {
    const stockData = await fetchStockData(ns, company);
    if (stockData === undefined || stockData.length === 0) return;

    const { sym } = stockData[0];

    ns.disableLog('ALL');
    ns.clearLog();
    ns.ui.openTail();
    ns.ui.setTailTitle(`Stock Price of ${company} (${sym})`);
    ns.printRaw(<StockChart ns={ns} stockData={stockData} />);
}

/**
 * Look up a company's stock symbol and enrich its tick data.
 *
 * @param ns - Netscript API
 * @param company - Company name to fetch data for
 * @returns Array of enhanced tick data or `undefined` if not found
 */
async function fetchStockData(
    ns: NS,
    company: string,
): Promise<EnhancedTickData[] | undefined> {
    const companySymbol = ns.stock
        .getSymbols()
        .find((sym) => ns.stock.getOrganization(sym) === company);

    if (!companySymbol) {
        ns.tprint(`Could not find stock symbol for ${company}`);
        return undefined;
    }

    const stockClient = new TrackerClient(ns);
    const data = await stockClient.requestStockTicks(companySymbol);
    return data.map((d) => ({
        sym: companySymbol,
        mid: (d.askPrice + d.bidPrice) / 2,
        spread: d.askPrice - d.bidPrice,
        conf: Math.abs(d.forecast - 0.5) * 2,
        ...d,
    }));
}

interface Props {
    ns: NS;
    stockData: EnhancedTickData[];
}

function StockChart({ stockData }: Props) {
    const containerRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (stockData === undefined || !containerRef.current) return undefined;
        const plot = stockPlot(stockData);
        containerRef.current.append(plot);
        return () => plot.remove();
    }, [stockData]);

    return <div ref={containerRef} />;
}

interface EnhancedTickData extends TickData {
    sym: string;
    mid: number;
    spread: number;
    conf: number;
}

function stockPlot(data: EnhancedTickData[]) {
    return Plot.plot({
        marginLeft: 100,
        width: 1000,
        height: 480,
        x: { type: 'utc', label: 'Time' },
        y: { label: 'Price' },
        color: {
            legend: true,
            type: 'diverging',
            scheme: 'RdBu',
            domain: [0, 0.5, 1],
            label: 'Forecast (P↑)',
        },
        marks: [
            Plot.frame(),
            Plot.areaY(data, {
                x: 'ts',
                y1: 'bidPrice',
                y2: 'askPrice',
                fill: 'forecast',
                //opacity: d => 0.25 + 0.6 * d.conf,
                z: 'sym',
            }),
            // optional: last label per symbol in each bin
            Plot.text(
                d3
                    .groupSort(
                        data,
                        (g) => d3.max(g, (d) => d.ts),
                        (d) => d.sym,
                    )
                    .map((sym) => {
                        const rows = data.filter((b) => b.sym === sym);
                        const last = rows.reduce((a, b) =>
                            a.ts > b.ts ? a : b,
                        );
                        return {
                            sym,
                            ts: last.ts,
                            y: last.askPrice,
                        };
                    }),
                {
                    text: 'sym',
                    x: 'ts',
                    y: 'y',
                    dx: 4,
                    dy: -4,
                    textAnchor: 'start',
                },
            ),
        ],
    });
}

function allCompanyNames(enums: NSEnums): string[] {
    return Object.getOwnPropertyNames(enums.CompanyName).map(
        (k) => enums.CompanyName[k],
    );
}
