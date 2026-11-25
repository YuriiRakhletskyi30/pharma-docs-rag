// Values the browser and the server must agree on. No server-only imports here: components use this file.

export const MAX_QUESTION_CHARS = 1000;
export const MAX_UPLOAD_MB = 20;
export const MAX_UPLOAD_PAGES = 300;

/** Uploaded files are stored as upload-<uuid>.pdf; seed labels keep their DailyMed set id. */
export const UPLOAD_PREFIX = 'upload-';
