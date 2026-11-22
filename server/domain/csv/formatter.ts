import type { DecodedRecord } from '../cobol/decoder'

const UTF8_BOM = '\uFEFF'
const CSV_SEPARATOR = ';'
const LINE_ENDING = '\r\n'

/**
 * Escapes a single CSV cell according to RFC 4180 for semicolon-delimited Excel FR files.
 */
function escapeCsvCell(value: string): string {
  if (
    value.includes(CSV_SEPARATOR)
    || value.includes('"')
    || value.includes('\n')
    || value.includes('\r')
  ) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

/**
 * Formats columns and decoded rows into an Excel FR compatible CSV string:
 * - UTF-8 with BOM (for French accented characters)
 * - Semicolon (;) delimiter
 * - CRLF line endings
 */
export function formatCsvExcelFr(columns: string[], rows: DecodedRecord[]): string {
  const lines: string[] = []

  // Header row
  lines.push(columns.map(escapeCsvCell).join(CSV_SEPARATOR))

  // Data rows
  for (const row of rows) {
    const line = columns
      .map(col => escapeCsvCell(row[col] ?? ''))
      .join(CSV_SEPARATOR)
    lines.push(line)
  }

  return UTF8_BOM + lines.join(LINE_ENDING) + LINE_ENDING
}
