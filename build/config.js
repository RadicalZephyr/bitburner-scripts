import fileSyncJson from '../filesync.json' with { type: 'json' };

export const dist = fileSyncJson['scriptsFolder'];
export const src = 'src';
export const allowedFiletypes = fileSyncJson['allowedFiletypes'];
