/**
 * EBCDIC IBM-1147 (France + Euro) <-> UTF-8 conversion table.
 * Code Page 1147 is IBM-297 (France) with 0x9F mapped to € (Euro sign).
 */

const IBM1147_TO_UTF8: string[] = [
  // 0x00 - 0x0F
  '\u0000', '\u0001', '\u0002', '\u0003', '\u009C', '\u0009', '\u0086', '\u007F',
  '\u0097', '\u008D', '\u008E', '\u000B', '\u000C', '\u000D', '\u000E', '\u000F',
  // 0x10 - 0x1F
  '\u0010', '\u0011', '\u0012', '\u0013', '\u009D', '\u0085', '\u0008', '\u0087',
  '\u0018', '\u0019', '\u0092', '\u008F', '\u001C', '\u001D', '\u001E', '\u001F',
  // 0x20 - 0x2F
  '\u0080', '\u0081', '\u0082', '\u0083', '\u0084', '\u000A', '\u0017', '\u001B',
  '\u0088', '\u0089', '\u008A', '\u008B', '\u008C', '\u0005', '\u0006', '\u0007',
  // 0x30 - 0x3F
  '\u0090', '\u0091', '\u0016', '\u0093', '\u0094', '\u0095', '\u0096', '\u0004',
  '\u0098', '\u0099', '\u009A', '\u009B', '\u0014', '\u0015', '\u009E', '\u001A',
  // 0x40 - 0x4F (0x40=space, 0x44=@, 0x48=\, 0x4A=°, 0x4F=!)
  ' ', '\u00A0', 'â', 'ä', '@', 'á', 'ã', 'å',
  '\\', 'ñ', '°', '.', '<', '(', '+', '!',
  // 0x50 - 0x5F (0x51={, 0x54=}, 0x5A=§, 0x5B=$, 0x5F=^)
  '&', '{', 'ê', 'ë', '}', 'í', 'î', 'ï',
  'ì', 'ß', '§', '$', '*', ')', ';', '^',
  // 0x60 - 0x6F (0x6A=ù)
  '-', '/', 'Â', 'Ä', 'À', 'Á', 'Ã', 'Å',
  'Ç', 'Ñ', 'ù', ',', '%', '_', '>', '?',
  // 0x70 - 0x7F (0x7B=£, 0x7C=à)
  'ø', 'É', 'Ê', 'Ë', 'È', 'Í', 'Î', 'Ï',
  'Ì', 'µ', ':', '£', 'à', '\'', '=', '"',
  // 0x80 - 0x8F
  'Ø', 'a', 'b', 'c', 'd', 'e', 'f', 'g',
  'h', 'i', '«', '»', 'ð', 'ý', 'þ', '±',
  // 0x90 - 0x9F (0x90=[, 0x9F=€)
  '[', 'j', 'k', 'l', 'm', 'n', 'o', 'p',
  'q', 'r', 'ª', 'º', 'æ', '¸', 'Æ', '€',
  // 0xA0 - 0xAF (0xA0=`, 0xA1=¨)
  '`', '¨', 's', 't', 'u', 'v', 'w', 'x',
  'y', 'z', '¡', '¿', 'Ð', 'Ý', 'Þ', '®',
  // 0xB0 - 0xBF (0xB1=#, 0xB5=], 0xBB=|, 0xBD=~)
  '¢', '#', '¥', '·', '©', ']', '¶', '¼',
  '½', '¾', '¬', '|', '¯', '~', '´', '×',
  // 0xC0 - 0xCF (0xC0=é)
  'é', 'A', 'B', 'C', 'D', 'E', 'F', 'G',
  'H', 'I', '\u00AD', 'ô', 'ö', 'ò', 'ó', 'õ',
  // 0xD0 - 0xDF (0xD0=è)
  'è', 'J', 'K', 'L', 'M', 'N', 'O', 'P',
  'Q', 'R', '¹', 'û', 'ü', 'Ù', 'ú', 'ÿ',
  // 0xE0 - 0xEF (0xE0=ç)
  'ç', '÷', 'S', 'T', 'U', 'V', 'W', 'X',
  'Y', 'Z', '²', 'Ô', 'Ö', 'Ò', 'Ó', 'Õ',
  // 0xF0 - 0xFF
  '0', '1', '2', '3', '4', '5', '6', '7',
  '8', '9', '³', 'Û', 'Ü', 'ù', 'Ú', '\u009F'
]

// Reverse lookup map for encoding UTF-8 -> IBM-1147 (useful for tests & tooling)
const UTF8_TO_IBM1147 = new Map<string, number>()
for (let i = 0; i < IBM1147_TO_UTF8.length; i++) {
  const ch = IBM1147_TO_UTF8[i]
  if (ch !== undefined && !UTF8_TO_IBM1147.has(ch)) {
    UTF8_TO_IBM1147.set(ch, i)
  }
}

/**
 * Decodes an EBCDIC IBM-1147 binary buffer into a UTF-8 string.
 * Non-printable control bytes (0x00 / LOW-VALUES) are converted to spaces for clean text output.
 */
export function decodeEbcdicIbm1147(buffer: Buffer): string {
  let result = ''
  for (let i = 0; i < buffer.length; i++) {
    const byte = buffer[i]!
    if (byte === 0x00) {
      result += ' '
    } else {
      result += IBM1147_TO_UTF8[byte] ?? '?'
    }
  }
  return result
}

/**
 * Encodes a UTF-8 string into an EBCDIC IBM-1147 Buffer, padded/truncated to optional length.
 */
export function encodeEbcdicIbm1147(text: string, fixedLength?: number): Buffer {
  const targetLen = fixedLength ?? text.length
  const buf = Buffer.alloc(targetLen, 0x40) // 0x40 = EBCDIC space
  const len = Math.min(text.length, targetLen)
  for (let i = 0; i < len; i++) {
    const ch = text[i]!
    buf[i] = UTF8_TO_IBM1147.get(ch) ?? 0x6F // 0x6F = '?'
  }
  return buf
}
