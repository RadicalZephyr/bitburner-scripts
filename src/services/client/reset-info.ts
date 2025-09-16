import { ApiCell } from 'util/sodium-api';

export const OwnedAugs = new ApiCell<Map<string, number>>(new Map());

export const SourceFiles = new ApiCell<Map<number, number>>(new Map());
