/**
 * LicenceService — pure logic for AS Notes Pro licence key validation.
 *
 * No VS Code imports. All validation rules are encapsulated here so that
 * when real server-side verification is added, this is the only file that
 * needs to change.
 *
 * Current rule (temporary): a key is valid if it is exactly 24 characters
 * long and contains exactly 12 lowercase and 12 uppercase ASCII letters
 * (no digits, spaces, or symbols).
 */

export type LicenceStatus = 'valid' | 'invalid' | 'not-entered';

/**
 * Validate a licence key and return its status.
 *
 * - `'not-entered'` — key is empty or whitespace only
 * - `'valid'`       — key passes all validation rules
 * - `'invalid'`     — key is present but fails validation
 */
export function validateLicenceKey(key: string): LicenceStatus {
    if (!key || key.trim().length === 0) {
        return 'not-entered';
    }

    if (key.length !== 24) {
        return 'invalid';
    }

    let lowerCount = 0;
    let upperCount = 0;

    for (const ch of key) {
        if (ch >= 'a' && ch <= 'z') {
            lowerCount++;
        } else if (ch >= 'A' && ch <= 'Z') {
            upperCount++;
        } else {
            // Non-alpha character present — immediately invalid
            return 'invalid';
        }
    }

    if (lowerCount === 12 && upperCount === 12) {
        return 'valid';
    }

    return 'invalid';
}

/**
 * Convenience helper — returns true only for the `'valid'` status.
 * Use this at pro feature gates rather than comparing the string directly.
 */
export function isValidStatus(status: LicenceStatus): boolean {
    return status === 'valid';
}
