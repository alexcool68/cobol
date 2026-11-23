import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { parseCopybook } from '../../server/domain/cobol/parser'
import { decodeBinaryFile } from '../../server/domain/cobol/decoder'
import type { ChainRule } from '../../shared/types/config'

const cpyPath = resolve(process.cwd(), 'exemple/CFGL188.cpy')
const binPath = resolve(process.cwd(), 'exemple/D.bin')

describe('Real-world CFGL188.cpy + D.bin', () => {
  it.skipIf(!existsSync(cpyPath) || !existsSync(binPath))('parse CFGL188.cpy (multiples 05 racines) et décode D.bin', () => {
    const rawCpy = readFileSync(cpyPath, 'utf-8')
    const parsed = parseCopybook(rawCpy)

    // 51 (DSC-PAC-CRO-A) + 122 (DSC-BDI-CRO-A) = 173 octets dans la copybook
    expect(parsed.lrecl).toBe(173)
    expect(parsed.commonFields).toHaveLength(42)
    expect(parsed.redefinesBranches).toHaveLength(0)

    const bin = readFileSync(binPath)
    // D.bin a un LRECL physique de 172 octets (1252 enregistrements exacts)
    expect(bin.length % 172).toBe(0)
    expect(bin.length / 172).toBe(1252)

    const rules: ChainRule[] = [
      {
        id: 'jg16',
        copybookId: 'cfgl188',
        chainFieldName: 'CD-CHN-LOT',
        codeChaine: 'JG16',
        label: 'CRO BDI JG16',
        createdAt: '',
        updatedAt: ''
      }
    ]

    // Sans aucun lreclOverride : le décodeur auto-détecte LRECL = 172 grâce à la taille et aux règles !
    const decoded = decodeBinaryFile(bin, parsed, rules)
    expect(decoded.lrecl).toBe(172)
    expect(decoded.lreclAutoDetected).toBe(true)
    expect(decoded.totalRecords).toBe(1252)

    const jg16 = decoded.groups.find(g => g.codeChaine === 'JG16')
    expect(jg16).toBeDefined()
    expect(jg16!.rows.length).toBeGreaterThan(0)
    expect(jg16!.rows[0]!['CD-CHN-LOT']).toBe('JG16')
    expect(jg16!.rows[0]!['PART-GAN']).toBe('597,12')
    expect(jg16!.rows[0]!['PART-AUTRE']).toBe('0,00')
    expect(jg16!.rows[0]!['MT-PREST']).toBe('597,12')
    expect(jg16!.rows[0]!['DT-CPT-CAISSE']).toBe('20261018')
    expect(jg16!.rows[0]!['CD-MON']).toBe('EUR')
  })
})
