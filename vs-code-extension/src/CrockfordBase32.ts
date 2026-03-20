// Crockford Base32 encoding/decoding
// Alphabet: 0123456789ABCDEFGHJKMNPQRSTVWXYZ (excludes I, L, O, U to avoid ambiguity)

const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const DECODE_MAP = new Map<string, number>();

// Build decode map (case-insensitive, with common substitutions)
for (let i = 0; i < ALPHABET.length; i++) {
    DECODE_MAP.set(ALPHABET[i]!, i);
    DECODE_MAP.set(ALPHABET[i]!.toLowerCase(), i);
}
// Common misreadings
DECODE_MAP.set('O', 0);
DECODE_MAP.set('o', 0);
DECODE_MAP.set('I', 1);
DECODE_MAP.set('i', 1);
DECODE_MAP.set('L', 1);
DECODE_MAP.set('l', 1);

export function encode(data: Uint8Array): string {
    if (data.length === 0) { return ''; }

    let result = '';
    let buffer = 0;
    let bitsInBuffer = 0;

    for (const byte of data) {
        buffer = (buffer << 8) | byte;
        bitsInBuffer += 8;

        while (bitsInBuffer >= 5) {
            bitsInBuffer -= 5;
            const index = (buffer >> bitsInBuffer) & 0x1f;
            result += ALPHABET[index];
        }
    }

    // Encode remaining bits (pad with zeros on the right)
    if (bitsInBuffer > 0) {
        const index = (buffer << (5 - bitsInBuffer)) & 0x1f;
        result += ALPHABET[index];
    }

    return result;
}

export function decode(encoded: string): Uint8Array {
    if (encoded.length === 0) { return new Uint8Array(0); }

    // Strip hyphens and whitespace
    const cleaned = encoded.replace(/[-\s]/g, '');

    let buffer = 0;
    let bitsInBuffer = 0;
    const bytes: number[] = [];

    for (const char of cleaned) {
        const value = DECODE_MAP.get(char);
        if (value === undefined) {
            throw new Error(`Invalid Crockford Base32 character: '${char}'`);
        }
        buffer = (buffer << 5) | value;
        bitsInBuffer += 5;

        while (bitsInBuffer >= 8) {
            bitsInBuffer -= 8;
            bytes.push((buffer >> bitsInBuffer) & 0xff);
        }
    }

    return new Uint8Array(bytes);
}
