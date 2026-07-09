/**
 * KeePass standard icon set (indices 0–68): display names and a best-effort map
 * to VS Code codicon ids. Kept dependency-free so it can be imported by both the
 * extension host (tree items → ThemeIcon) and the webview (icon picker previews).
 */

export const KDBX_ICON_NAMES: string[] = [
    'Key', 'World', 'Warning', 'Network Server', 'Marked Directory', 'User Communication',
    'Parts', 'Notepad', 'World Socket', 'Identity', 'Paper Ready', 'Digicam',
    'IR Communication', 'Multi Keys', 'Energy', 'Scanner', 'World Star', 'CD-ROM',
    'Monitor', 'Email', 'Configuration', 'Clipboard Ready', 'Paper New', 'Screen',
    'Energy Careful', 'Email Box', 'Disk', 'Drive', 'Paper Q', 'Terminal Encrypted',
    'Console', 'Printer', 'Program Icons', 'Run', 'Settings', 'World Computer',
    'Archive', 'Homebanking', 'Drive Windows', 'Clock', 'Email Search', 'Paper Flag',
    'Memory', 'Trash Bin', 'Note', 'Expired', 'Info', 'Package', 'Folder', 'Folder Open',
    'Folder Package', 'Lock Open', 'Paper Locked', 'Checked', 'Pen', 'Thumbnail', 'Book',
    'List', 'User Key', 'Tool', 'Home', 'Star', 'Tux', 'Feather', 'Apple', 'Wiki',
    'Money', 'Certificate', 'Mobile',
];

/** Best-effort mapping of each KeePass icon index to a codicon id. */
export const KDBX_ICON_CODICONS: string[] = [
    'key', 'globe', 'warning', 'server', 'folder-active', 'comment',
    'extensions', 'note', 'plug', 'account', 'file', 'device-camera',
    'broadcast', 'key', 'zap', 'search', 'star', 'save',
    'device-desktop', 'mail', 'gear', 'clippy', 'new-file', 'device-desktop',
    'zap', 'mail', 'save', 'database', 'question', 'terminal',
    'terminal', 'file', 'symbol-color', 'play', 'settings-gear', 'vm',
    'archive', 'home', 'device-desktop', 'clock', 'search', 'flag',
    'server', 'trash', 'note', 'error', 'info', 'package', 'folder', 'folder-opened',
    'folder', 'unlock', 'lock', 'check', 'edit', 'file-media', 'book',
    'list-unordered', 'account', 'tools', 'home', 'star-full', 'circle-filled', 'edit', 'circle-filled', 'book',
    'credit-card', 'verified', 'device-mobile',
];

/** The codicon id for a KeePass icon index (falls back to `key`). */
export function codiconForIcon(icon: number): string {
    return KDBX_ICON_CODICONS[icon] ?? 'key';
}
