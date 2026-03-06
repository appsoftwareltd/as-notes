/**
 * Pure utility functions for path operations.
 * No VS Code dependencies — safe for unit testing.
 */

/**
 * Compute the directory distance between two workspace-relative paths.
 * Distance is the number of directory segments that differ — specifically,
 * the total "hops" needed to go from one directory to the other.
 *
 * For example:
 * - `notes` vs `notes` → 0 (same directory)
 * - `notes` vs `notes/sub` → 1
 * - `notes/a` vs `notes/b` → 2 (up one, down one)
 * - `.` vs `deep/nested/dir` → 3
 *
 * @param dirA - Directory path (forward slashes, no trailing slash)
 * @param dirB - Directory path (forward slashes, no trailing slash)
 * @returns Number of hops between the two directories
 */
export function getPathDistance(dirA: string, dirB: string): number {
    const segmentsA = dirA === '.' ? [] : dirA.split('/');
    const segmentsB = dirB === '.' ? [] : dirB.split('/');

    // Find common prefix length
    let common = 0;
    const minLen = Math.min(segmentsA.length, segmentsB.length);
    for (let i = 0; i < minLen; i++) {
        if (segmentsA[i].toLowerCase() === segmentsB[i].toLowerCase()) {
            common++;
        } else {
            break;
        }
    }

    // Distance = steps up from A to common ancestor + steps down from ancestor to B
    const stepsUp = segmentsA.length - common;
    const stepsDown = segmentsB.length - common;
    return stepsUp + stepsDown;
}

/**
 * Sanitise a string for use as a filename.
 * Characters invalid in filenames (`/ ? < > \ : * | "`) are replaced with `_`.
 */
export function sanitiseFileName(name: string): string {
    const invalids = /[\/\?<>\\:\*\|":]/g;
    return name.replace(invalids, '_');
}
