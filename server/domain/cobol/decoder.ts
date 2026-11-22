import type { CobolField, ParsedCopybook } from '#shared/types/cobol'
import type { ChainRule } from '#shared/types/config'
import { decodeEbcdicIbm1147 } from './ebcdic'

export type DecodedRecord = Record<string, string>

export interface DecodedChainGroup {
  key: string
  codeChaine: string
  typEnr?: string
  label?: string
  redefinesBranchName?: string
  isRejected: boolean
  columns: string[]
  rows: DecodedRecord[]
}

export interface DecodedFileResult {
  lrecl: number
  totalRecords: number
  groups: DecodedChainGroup[]
}

/**
 * Formats a raw integer string with implied decimal places using French comma separator.
 */
function formatDecimalString(rawDigits: string, decimalDigits: number, isNegative: boolean): string {
  const digits = rawDigits.replace(/^0+/, '') || '0'
  const sign = isNegative && digits !== '0' ? '-' : ''

  if (decimalDigits <= 0) {
    return `${sign}${digits}`
  }

  const padded = digits.padStart(decimalDigits + 1, '0')
  const intPart = padded.slice(0, padded.length - decimalDigits)
  const decPart = padded.slice(padded.length - decimalDigits)
  return `${sign}${intPart},${decPart}`
}

/**
 * Decodes a COMP-3 (Packed Decimal / BCD) byte slice into a formatted French decimal string.
 */
export function decodeComp3(slice: Buffer, decimalDigits = 0): string {
  if (slice.length === 0) return ''

  // Check for all spaces (0x40) or all zeros (0x00) uninitialized zone
  const allSpaces = slice.every(b => b === 0x40)
  if (allSpaces) return ''

  let digits = ''
  let isNegative = false

  for (let i = 0; i < slice.length; i++) {
    const byte = slice[i]!
    const high = (byte >> 4) & 0x0F
    const low = byte & 0x0F

    if (i < slice.length - 1) {
      digits += high.toString(10) + low.toString(10)
    } else {
      // Last byte: high nibble is last digit, low nibble is sign
      digits += high.toString(10)
      isNegative = low === 0x0D
    }
  }

  return formatDecimalString(digits, decimalDigits, isNegative)
}

/**
 * Decodes a COMP / COMP-4 / COMP-5 (Big-Endian Binary) byte slice into a formatted French decimal string.
 */
export function decodeCompBinary(slice: Buffer, signed = true, decimalDigits = 0): string {
  if (slice.length === 0) return ''

  let bigVal: bigint
  if (slice.length === 2) {
    bigVal = BigInt(signed ? slice.readInt16BE(0) : slice.readUInt16BE(0))
  } else if (slice.length === 4) {
    bigVal = BigInt(signed ? slice.readInt32BE(0) : slice.readUInt32BE(0))
  } else if (slice.length === 8) {
    bigVal = signed ? slice.readBigInt64BE(0) : slice.readBigUInt64BE(0)
  } else {
    // Fallback for uncommon binary sizes
    let acc = BigInt(0)
    for (let i = 0; i < slice.length; i++) {
      acc = (acc << BigInt(8)) | BigInt(slice[i]!)
    }
    bigVal = acc
  }

  const isNegative = bigVal < BigInt(0)
  const absStr = (isNegative ? -bigVal : bigVal).toString(10)
  return formatDecimalString(absStr, decimalDigits, isNegative)
}

/**
 * Decodes a Zoned Decimal / DISPLAY numeric (PIC 9(n) / PIC S9(n)V9(m)) EBCDIC byte slice.
 * Handles EBCDIC overpunch sign on the last byte (0xD* = negative, 0xC* / 0xF* = positive).
 */
export function decodeZonedDecimal(slice: Buffer, signed = false, decimalDigits = 0): string {
  if (slice.length === 0) return ''

  // Handle blank/uninitialized field (all EBCDIC spaces 0x40 or 0x00)
  if (slice.every(b => b === 0x40 || b === 0x00)) {
    return ''
  }

  let digits = ''
  let isNegative = false

  for (let i = 0; i < slice.length; i++) {
    const byte = slice[i]!
    const high = (byte >> 4) & 0x0F
    const low = byte & 0x0F

    if (i === slice.length - 1 && signed) {
      if (high === 0x0D) {
        isNegative = true
      }
      digits += low.toString(10)
    } else if (high === 0x0F || high === 0x0C || high === 0x0D) {
      if (i === slice.length - 1 && high === 0x0D) {
        isNegative = true
      }
      digits += low.toString(10)
    } else if (byte === 0x40) {
      digits += '0'
    } else {
      // Unexpected byte in numeric field: fallback to low nibble digit if valid
      digits += (low <= 9 ? low : 0).toString(10)
    }
  }

  return formatDecimalString(digits, decimalDigits, isNegative)
}

/**
 * Decodes a single elementary CobolField from a record buffer.
 */
export function decodeField(recordBuf: Buffer, field: CobolField): string {
  if (field.offset >= recordBuf.length) {
    return ''
  }

  const end = Math.min(field.offset + field.byteLength, recordBuf.length)
  const slice = recordBuf.subarray(field.offset, end)

  switch (field.type) {
    case 'ALPHANUMERIC':
      return decodeEbcdicIbm1147(slice).trimEnd()
    case 'PACKED_DECIMAL':
      return decodeComp3(slice, field.decimalDigits ?? 0)
    case 'BINARY':
      return decodeCompBinary(slice, field.signed ?? true, field.decimalDigits ?? 0)
    case 'ZONED_DECIMAL':
      return decodeZonedDecimal(slice, field.signed ?? false, field.decimalDigits ?? 0)
    default:
      return ''
  }
}

/**
 * Decodes a complete fixed-block (FB) binary buffer using a ParsedCopybook and ChainRules.
 * Groups output records by Code Chaîne (+ TYP-ENR when configured), with unmatched rows in REJETS.
 */
export function decodeBinaryFile(
  buffer: Buffer,
  copybook: ParsedCopybook,
  rules: ChainRule[],
  options?: { lreclOverride?: number }
): DecodedFileResult {
  const lrecl = options?.lreclOverride && options.lreclOverride > 0
    ? options.lreclOverride
    : copybook.lrecl

  if (lrecl <= 0) {
    throw new Error('LRECL invalide (doit être > 0).')
  }

  const totalRecords = Math.floor(buffer.length / lrecl)
  const branchMap = new Map(copybook.redefinesBranches.map(b => [b.name, b]))

  // Sort rules so more specific rules (with typEnrValue) are evaluated before generic ones
  const sortedRules = [...rules].sort((a, b) => {
    const aSpecific = a.typEnrFieldName && a.typEnrValue ? 1 : 0
    const bSpecific = b.typEnrFieldName && b.typEnrValue ? 1 : 0
    return bSpecific - aSpecific
  })

  const groupsMap = new Map<string, DecodedChainGroup>()

  for (let i = 0; i < totalRecords; i++) {
    const recStart = i * lrecl
    const recordBuf = buffer.subarray(recStart, recStart + lrecl)

    // 1. Decode all common header fields
    const commonRow: DecodedRecord = {}
    for (const field of copybook.commonFields) {
      commonRow[field.name] = decodeField(recordBuf, field)
    }

    // 2. Find matching ChainRule
    let matchedRule: ChainRule | undefined
    for (const rule of sortedRules) {
      const chainVal = (commonRow[rule.chainFieldName] ?? '').trim()
      if (chainVal !== rule.codeChaine.trim()) {
        continue
      }

      if (rule.typEnrFieldName && rule.typEnrValue) {
        const typVal = (commonRow[rule.typEnrFieldName] ?? '').trim()
        if (typVal !== rule.typEnrValue.trim()) {
          continue
        }
      }

      matchedRule = rule
      break
    }

    // 3. Decode active REDEFINES branch or route to REJETS
    if (matchedRule) {
      const branch = branchMap.get(matchedRule.redefinesBranchName)
      const fullRow: DecodedRecord = { ...commonRow }

      if (branch) {
        for (const field of branch.fields) {
          fullRow[field.name] = decodeField(recordBuf, field)
        }
      }

      const groupKey = matchedRule.typEnrValue
        ? `${matchedRule.codeChaine}_${matchedRule.typEnrValue}`
        : matchedRule.codeChaine

      let group = groupsMap.get(groupKey)
      if (!group) {
        const columns = [
          ...copybook.commonFields.map(f => f.name),
          ...(branch ? branch.fields.map(f => f.name) : [])
        ]
        group = {
          key: groupKey,
          codeChaine: matchedRule.codeChaine,
          typEnr: matchedRule.typEnrValue || undefined,
          label: matchedRule.label,
          redefinesBranchName: matchedRule.redefinesBranchName,
          isRejected: false,
          columns,
          rows: []
        }
        groupsMap.set(groupKey, group)
      }

      group.rows.push(fullRow)
    } else {
      // Unrecognized record -> REJETS group
      const rejectKey = 'REJETS'
      let group = groupsMap.get(rejectKey)
      if (!group) {
        const columns = [
          ...copybook.commonFields.map(f => f.name),
          '_LIGNE_NUM',
          '_RAW_TEXTE'
        ]
        group = {
          key: rejectKey,
          codeChaine: 'REJETS',
          label: 'Enregistrements non reconnus',
          isRejected: true,
          columns,
          rows: []
        }
        groupsMap.set(rejectKey, group)
      }

      group.rows.push({
        ...commonRow,
        _LIGNE_NUM: String(i + 1),
        _RAW_TEXTE: decodeEbcdicIbm1147(recordBuf).trimEnd()
      })
    }
  }

  // Sort groups: regular chains alphabetically, REJETS last
  const groups = Array.from(groupsMap.values()).sort((a, b) => {
    if (a.isRejected !== b.isRejected) return a.isRejected ? 1 : -1
    return a.key.localeCompare(b.key)
  })

  return {
    lrecl,
    totalRecords,
    groups
  }
}
