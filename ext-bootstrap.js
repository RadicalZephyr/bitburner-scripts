import { React } from 'lib/react';
const BASE_URL = 'https://github.com/RadicalZephyr/bitburner-scripts/raw/${{ env.RELEASE_SHA }}/';
export async function main(ns) {
    ns.disableLog('ALL');
    ns.ui.openTail();
    ns.ui.setTailTitle("Downloading RadicalZephyr's Scripts");
    const incFinished = { current: () => null };
    ns.clearLog();
    ns.printRaw(React.createElement(Bootstrap, { incFinished: incFinished }));
    ns.ui.renderTail();
    const downloads = [];
    const slashRE = /^\//;
    for (const file of FILES) {
        const prefix = slashRE.test(file) ? '/' : '';
        const dl = ns.wget(BASE_URL + file, prefix + file, 'home').then(() => incFinished.current(), () => ns.print(`WARN: could not download ${file}`));
        downloads.push(dl);
        await ns.asleep(0);
    }
    await Promise.allSettled(downloads);
    ns.print('');
    ns.print('Finished downloading all files, go forth and hack!');
}
function Bootstrap({ incFinished }) {
    const total_files = FILES.length;
    const [finished, setFinished] = React.useState(0);
    incFinished.current = () => setFinished((v) => v + 1);
    return (React.createElement("div", null,
        React.createElement("label", { htmlFor: "download-files" }, "Downloading files:"),
        React.createElement("br", null),
        React.createElement("progress", { id: "download-files", max: total_files, value: finished === 0 ? undefined : finished },
            (finished / total_files) * 100,
            " %")));
}
const FILES = [''];
FILES.pop(); // drop empty final element
