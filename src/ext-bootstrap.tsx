import type { NS } from '@ns';

import { React } from 'lib/react';

const BASE_URL =
    'https://github.com/RadicalZephyr/bitburner-scripts/raw/${{ env.RELEASE_SHA }}/';

export async function main(ns: NS) {
    ns.disableLog('ALL');
    ns.ui.openTail();

    ns.ui.setTailTitle("Downloading RadicalZephyr's Scripts");

    const incFinished = { current: () => null };
    ns.clearLog();
    ns.printRaw(<Bootstrap incFinished={incFinished} />);
    ns.ui.renderTail();

    const downloads = [];
    const slashRE = /^\//;
    for (const file of FILES) {
        const prefix = slashRE.test(file) ? '/' : '';
        const dl = ns.wget(BASE_URL + file, prefix + file, 'home').then(
            () => incFinished.current(),
            () => ns.print(`WARN: could not download ${file}`),
        );
        downloads.push(dl);

        await ns.asleep(0);
    }
    await Promise.allSettled(downloads);

    ns.print('');
    ns.print('Finished downloading all files, go forth and hack!');
}

interface Props {
    incFinished: { current: () => void };
}

function Bootstrap({ incFinished }: Props) {
    const total_files = FILES.length;
    const [finished, setFinished] = React.useState(0);
    incFinished.current = () => setFinished((v) => v + 1);
    return (
        <div>
            <label htmlFor="download-files">Downloading files:</label>
            <br />
            <progress
                id="download-files"
                max={total_files}
                value={finished === 0 ? undefined : finished}
            >
                {(finished / total_files) * 100} %
            </progress>
        </div>
    );
}

const FILES = [''];
FILES.pop(); // drop empty final element
