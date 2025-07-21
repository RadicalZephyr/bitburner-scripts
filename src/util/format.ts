//////////////////////////////////////////
// Formatting Utilities
//////////////////////////////////////////

export function formatMoney(value: number): string {
    const s = ['', 'k', 'm', 'b', 't', 'q'];
    const e = Math.floor(Math.log(value) / Math.log(1000));
    return (value / Math.pow(1000, e)).toFixed(2) + s[e];
}


export function formatGigaBytes(value: number): string {
    const s = ['GB', 'TB', 'PB'];
    const e = Math.floor(Math.log(value) / Math.log(1024));
    return (value / Math.pow(1024, e)).toFixed(0) + s[e];
}
