export async function main(ns) {
    const hostsJSON = ns.args[0];
    if (typeof hostsJSON != 'string') {
        ns.printf('invalid hosts list');
        return;
    }
    const hosts = JSON.parse(hostsJSON);
    ns.tail();
    ns.printf('hosts: %s', JSON.stringify(hosts));
}
