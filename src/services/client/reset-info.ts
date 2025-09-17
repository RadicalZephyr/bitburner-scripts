import { ApiCell } from 'util/sodium-api';

export const OwnedAugs = new ApiCell<Map<string, number>>(new Map());

/**
 * Return the full list of all currently owned augmentations.
 *
 * @returns An array of all owned augmentations.
 */
export function getAllOwnedAugs(): string[] {
    return Array.from(OwnedAugs.cell.sample().keys());
}

/**
 * Retrieve the current level of the NeuroFlux Governor augmentation.
 *
 * @returns The number of owned levels of the NeuroFlux Governor
 * augmentation or zero if not owned.
 */
export function getNeurofluxGovernorLevel(): number {
    return OwnedAugs.cell.sample().get('NeuroFlux Governor') ?? 0;
}

export const SourceFiles = new ApiCell<Map<number, number>>(new Map());

/**
 * Get the owned level of the given source file.
 *
 * @param n  - Source file number to fetch
 * @returns The level of the given source file, zero if not owned.
 */
export function getSourceFileLevel(n: number): number {
    return SourceFiles.cell.sample().get(n) ?? 0;
}

/**
 * Retrieves all Source Files owned by the player and their corresponding levels.
 *
 * @returns A map where each key is a Source File number, and the
 * corresponding value is the level of that Source File owned by the
 * player.  Source Files not owned are omitted from the map.
 */
export function getAllSourceFileLevels(): Map<number, number> {
    return SourceFiles.cell.sample();
}
