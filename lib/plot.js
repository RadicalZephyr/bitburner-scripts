import 'lib/d3';
import { importFromGlobal } from 'util/script-import';
export const Plot = await importFromGlobal('https://cdn.jsdelivr.net/npm/@observablehq/plot@0.6.17/dist/plot.umd.min.js', 'Plot', {
    integrity: 'sha384-JUpn2GgRr0gxU0xOBd8D8P634jhRCwobtG8G2MMEkX1RnGJ7/FJNnuukpfT+H2w1',
    crossOrigin: 'anonymous',
});
