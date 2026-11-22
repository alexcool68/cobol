import { describe, expect, it } from 'vitest'
import { decodeEbcdicIbm1147, encodeEbcdicIbm1147 } from '../../server/domain/cobol/ebcdic'
import { parseCopybook } from '../../server/domain/cobol/parser'
import {
  decodeBinaryFile,
  decodeComp3,
  decodeCompBinary,
  decodeZonedDecimal
} from '../../server/domain/cobol/decoder'
import { formatCsvExcelFr } from '../../server/domain/csv/formatter'
import type { ChainRule } from '../../shared/types/config'

const SAMPLE_COPYBOOK = `
000100* COPYBOOK MOUVEMENTS COMPTABLES ASSURANCE
000200 01  MVT-ENREGISTREMENT.
000300     05  CODE-CHAINE           PIC X(4).
000400     05  TYP-ENR               PIC X(1).
000500     05  NUM-CONTRAT           PIC 9(8).
000600     05  ZONE-SPECIFIQUE       PIC X(20).
000700     05  MVT-DP01-A REDEFINES ZONE-SPECIFIQUE.
000800         10  DP01-LIBELLE      PIC X(10).
000900         10  DP01-MONTANT      PIC S9(8)V99 COMP-3.
001000         10  DP01-NB-ECHEANCE  PIC S9(4) COMP.
001100         10  FILLER            PIC X(2).
001200     05  MVT-JG16 REDEFINES ZONE-SPECIFIQUE.
001300         10  JG16-MONTANT-ZON  PIC S9(8)V99.
001400         10  JG16-CODE-SIN     PIC X(10).
`

describe('EBCDIC IBM-1147', () => {
  it('décode et encode les caractères français (accents, chiffres, espaces)', () => {
    const original = 'Prélèvement à échéance çà 1234'
    const encoded = encodeEbcdicIbm1147(original)
    expect(decodeEbcdicIbm1147(encoded)).toBe(original)
  })
})

describe('COBOL Copybook Parser', () => {
  it('calcule correctement le LRECL, les offsets et les branches REDEFINES', () => {
    const parsed = parseCopybook(SAMPLE_COPYBOOK)

    expect(parsed.recordName).toBe('MVT-ENREGISTREMENT')
    // 4 (CODE-CHAINE) + 1 (TYP-ENR) + 8 (NUM-CONTRAT) + 20 (ZONE-SPECIFIQUE) = 33
    expect(parsed.lrecl).toBe(33)

    // Common fields exclude ZONE-SPECIFIQUE (redefined target) and REDEFINES branches
    expect(parsed.commonFields.map(f => f.name)).toEqual([
      'CODE-CHAINE',
      'TYP-ENR',
      'NUM-CONTRAT'
    ])

    // Two REDEFINES branches detected
    expect(parsed.redefinesBranches).toHaveLength(2)

    const dp01 = parsed.redefinesBranches[0]!
    expect(dp01.name).toBe('MVT-DP01-A')
    expect(dp01.redefines).toBe('ZONE-SPECIFIQUE')
    expect(dp01.offset).toBe(13)
    // FILLER is excluded from flattened fields
    expect(dp01.fields.map(f => f.name)).toEqual([
      'DP01-LIBELLE',
      'DP01-MONTANT',
      'DP01-NB-ECHEANCE'
    ])
    // S9(8)V99 COMP-3 -> 10 digits + 1 sign nibble = 11 nibbles -> 6 bytes
    expect(dp01.fields[1]!.byteLength).toBe(6)
    expect(dp01.fields[1]!.type).toBe('PACKED_DECIMAL')
    // S9(4) COMP -> 2 bytes
    expect(dp01.fields[2]!.byteLength).toBe(2)
    expect(dp01.fields[2]!.type).toBe('BINARY')
  })
})

describe('COBOL Binary Decoders', () => {
  it('décode COMP-3 positif et négatif avec virgule implicite', () => {
    // +1250.75 in 6 bytes (S9(8)V99 COMP-3): 00 00 01 25 07 5C
    const posBuf = Buffer.from([0x00, 0x00, 0x01, 0x25, 0x07, 0x5C])
    expect(decodeComp3(posBuf, 2)).toBe('1250,75')

    // -42.05 in 6 bytes: 00 00 00 00 42 05D -> 00 00 00 04 20 5D
    const negBuf = Buffer.from([0x00, 0x00, 0x00, 0x04, 0x20, 0x5D])
    expect(decodeComp3(negBuf, 2)).toBe('-42,05')

    // 0.00
    const zeroBuf = Buffer.from([0x00, 0x00, 0x00, 0x00, 0x00, 0x0C])
    expect(decodeComp3(zeroBuf, 2)).toBe('0,00')
  })

  it('décode COMP binaire big-endian (2 et 4 octets, positif et négatif)', () => {
    const buf2Pos = Buffer.alloc(2)
    buf2Pos.writeInt16BE(12, 0)
    expect(decodeCompBinary(buf2Pos, true, 0)).toBe('12')

    const buf2Neg = Buffer.alloc(2)
    buf2Neg.writeInt16BE(-350, 0)
    expect(decodeCompBinary(buf2Neg, true, 2)).toBe('-3,50')

    const buf4 = Buffer.alloc(4)
    buf4.writeInt32BE(12345678, 0)
    expect(decodeCompBinary(buf4, true, 2)).toBe('123456,78')
  })

  it('décode Zoned Decimal (S9(8)V99) avec signe overpunch EBCDIC', () => {
    // +1250,75 -> "000012507" (0xF0..0xF7) + 0xC5 (positive 5)
    const posZoned = Buffer.from([0xF0, 0xF0, 0xF0, 0xF0, 0xF1, 0xF2, 0xF5, 0xF0, 0xF7, 0xC5])
    expect(decodeZonedDecimal(posZoned, true, 2)).toBe('1250,75')

    // -99,90 -> "000000999" + 0xD0 (negative 0)
    const negZoned = Buffer.from([0xF0, 0xF0, 0xF0, 0xF0, 0xF0, 0xF0, 0xF9, 0xF9, 0xF9, 0xD0])
    expect(decodeZonedDecimal(negZoned, true, 2)).toBe('-99,90')
  })
})

describe('Full Binary File Decoding & CSV Export', () => {
  it('découpe un fichier FB multi-mouvements avec REDEFINES et exporte en CSV Excel FR', () => {
    const parsed = parseCopybook(SAMPLE_COPYBOOK)

    const rules: ChainRule[] = [
      {
        id: 'r1',
        copybookId: 'cb1',
        chainFieldName: 'CODE-CHAINE',
        codeChaine: 'DP01',
        typEnrFieldName: 'TYP-ENR',
        typEnrValue: 'A',
        redefinesBranchName: 'MVT-DP01-A',
        label: 'Prélèvements',
        createdAt: '',
        updatedAt: ''
      },
      {
        id: 'r2',
        copybookId: 'cb1',
        chainFieldName: 'CODE-CHAINE',
        codeChaine: 'JG16',
        redefinesBranchName: 'MVT-JG16',
        label: 'Sinistres',
        createdAt: '',
        updatedAt: ''
      }
    ]

    // Record 1: DP01 / A
    const comp2 = Buffer.alloc(2)
    comp2.writeInt16BE(6, 0)
    const rec1 = Buffer.concat([
      encodeEbcdicIbm1147('DP01', 4),
      encodeEbcdicIbm1147('A', 1),
      encodeEbcdicIbm1147('00123456', 8),
      encodeEbcdicIbm1147('Échéance 1', 10),
      Buffer.from([0x00, 0x00, 0x01, 0x25, 0x07, 0x5C]), // +1250,75
      comp2, // 6
      encodeEbcdicIbm1147('  ', 2)
    ])

    // Record 2: JG16
    const rec2 = Buffer.concat([
      encodeEbcdicIbm1147('JG16', 4),
      encodeEbcdicIbm1147(' ', 1),
      encodeEbcdicIbm1147('00987654', 8),
      Buffer.from([0xF0, 0xF0, 0xF0, 0xF0, 0xF0, 0xF0, 0xF9, 0xF9, 0xF9, 0xD0]), // -99,90
      encodeEbcdicIbm1147('SIN-2026', 10)
    ])

    // Record 3: Unknown code -> REJETS
    const rec3 = Buffer.concat([
      encodeEbcdicIbm1147('XXXX', 4),
      encodeEbcdicIbm1147('Z', 1),
      encodeEbcdicIbm1147('00000001', 8),
      encodeEbcdicIbm1147('INCONNU', 20)
    ])

    const fileBuf = Buffer.concat([rec1, rec2, rec3])
    const decoded = decodeBinaryFile(fileBuf, parsed, rules)

    expect(decoded.totalRecords).toBe(3)
    expect(decoded.groups.map(g => g.key)).toEqual(['DP01_A', 'JG16', 'REJETS'])

    const dp01Group = decoded.groups[0]!
    expect(dp01Group.rows).toEqual([
      {
        'CODE-CHAINE': 'DP01',
        'TYP-ENR': 'A',
        'NUM-CONTRAT': '123456',
        'DP01-LIBELLE': 'Échéance 1',
        'DP01-MONTANT': '1250,75',
        'DP01-NB-ECHEANCE': '6'
      }
    ])

    const jg16Group = decoded.groups[1]!
    expect(jg16Group.rows[0]!['JG16-MONTANT-ZON']).toBe('-99,90')
    expect(jg16Group.rows[0]!['JG16-CODE-SIN']).toBe('SIN-2026')

    const rejectGroup = decoded.groups[2]!
    expect(rejectGroup.isRejected).toBe(true)
    expect(rejectGroup.rows).toHaveLength(1)

    // Verify CSV Excel FR output
    const csv = formatCsvExcelFr(dp01Group.columns, dp01Group.rows)
    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain('CODE-CHAINE;TYP-ENR;NUM-CONTRAT;DP01-LIBELLE;DP01-MONTANT;DP01-NB-ECHEANCE\r\n')
    expect(csv).toContain('DP01;A;123456;Échéance 1;1250,75;6\r\n')
  })
})
