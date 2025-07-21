import type { NS } from 'netscript';

export const factionServers = [
  'CSEC',
  'avmnite-02h',
  'I.I.I.I',
  'run4theh111z',
];

export type PortProgram =
  | 'BruteSSH.exe'
  | 'FTPCrack.exe'
  | 'relaySMTP.exe'
  | 'HTTPWorm.exe'
  | 'SQLInject.exe';

export const portOpeningPrograms: PortProgram[] = [
  'BruteSSH.exe',
  'FTPCrack.exe',
  'relaySMTP.exe',
  'HTTPWorm.exe',
  'SQLInject.exe',
];

/** Get list of all hosts.
 */
export function getAllHosts(ns: NS): string[] {
  const existingHosts = publicHosts.filter((h) => ns.serverExists(h));
  return ['home', ...getOwnedServers(ns), ...existingHosts];
}

/** Get list of purchased servers.
 */
export function getOwnedServers(ns: NS): string[] {
  return ns.scan('home').filter((host) => host.startsWith('pserv'));
}

/** Get root access to a server if possible.
 *
 * @returns whether you have root access to the target `host`.
 */
export function getRootAccess(ns: NS, host: string): boolean {
  if (!ns.hasRootAccess(host) && canNuke(ns, host)) {
    const portOpeningProgramFns = {
      'BruteSSH.exe': ns.brutessh.bind(ns),
      'FTPCrack.exe': ns.ftpcrack.bind(ns),
      'relaySMTP.exe': ns.relaysmtp.bind(ns),
      'HTTPWorm.exe': ns.httpworm.bind(ns),
      'SQLInject.exe': ns.sqlinject.bind(ns),
    };
    for (const program of portOpeningPrograms) {
      if (ns.fileExists(program)) {
        portOpeningProgramFns[program](host);
      }
    }
    ns.nuke(host);
  }
  return ns.hasRootAccess(host);
}

/** Check if we can hack this host.
 *
 * Note: hacking is different than nuking. Hacking
 * steals money from a server. Nuking only acquires
 * root access, and the hacking skill required is
 * _always_ 1.
 */
export function canHack(ns: NS, host: string): boolean {
  return (
    ns.getHackingLevel() >= ns.getServerRequiredHackingLevel(host)
    && canNuke(ns, host)
  );
}

/** Check if we can nuke this host.
 *
 * Note: hacking is different than nuking. Hacking
 * steals money from a server. Nuking only acquires
 * root access, and the hacking skill required is
 * _always_ 1.
 */
export function canNuke(ns: NS, host: string): boolean {
  if (ns.hasRootAccess(host)) {
    return true;
  }

  // Get number of open ports needed
  const portsNeeded = ns.getServerNumPortsRequired(host);

  // Check for existence of enough port opening programs
  const existingPrograms = portOpeningPrograms.filter((p) => ns.fileExists(p));
  return existingPrograms.length >= portsNeeded;
}

export const publicHosts = [
  '.',
  '4sigma',
  'CSEC',
  'I.I.I.I',
  'The-Cave',
  'aerocorp',
  'aevum-police',
  'alpha-ent',
  'applied-energetics',
  'avmnite-02h',
  'b-and-a',
  'blade',
  'catalyst',
  'clarkinc',
  'computek',
  'crush-fitness',
  'darkweb',
  'defcomm',
  'deltaone',
  'ecorp',
  'foodnstuff',
  'fulcrumassets',
  'fulcrumtech',
  'galactic-cyber',
  'global-pharm',
  'harakiri-sushi',
  'helios',
  'hong-fang-tea',
  'icarus',
  'infocomm',
  'iron-gym',
  'joesguns',
  'johnson-ortho',
  'kuai-gong',
  'lexo-corp',
  'max-hardware',
  'megacorp',
  'microdyne',
  'millenium-fitness',
  'n00dles',
  'nectar-net',
  'neo-net',
  'netlink',
  'nova-med',
  'nwo',
  'omega-net',
  'omnia',
  'omnitek',
  'phantasy',
  'powerhouse-fitness',
  'rho-construction',
  'rothman-uni',
  'run4theh111z',
  'sigma-cosmetics',
  'silver-helix',
  'snap-fitness',
  'solaris',
  'stormtech',
  'summit-uni',
  'syscore',
  'taiyang-digital',
  'the-hub',
  'titan-labs',
  'unitalife',
  'univ-energy',
  'vitalife',
  'zb-def',
  'zb-institute',
  'zer0',
  'zeus-med',
];
