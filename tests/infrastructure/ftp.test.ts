import { describe, expect, it } from 'vitest'
import { formatZosDsn } from '../../server/infrastructure/ftp/zos-ftp.client'

describe('formatZosDsn', () => {
  it('ajoute des guillemets simples quand quoteDsn est actif', () => {
    expect(formatZosDsn('TEST.SPE.GJ020005', true)).toBe('\'TEST.SPE.GJ020005\'')
  })

  it('ne double pas les guillemets s\'ils sont déjà présents', () => {
    expect(formatZosDsn('\'TEST.SPE.GJ020005\'', true)).toBe('\'TEST.SPE.GJ020005\'')
  })

  it('laisse le DSN intact quand quoteDsn est inactif', () => {
    expect(formatZosDsn('TEST.SPE.GJ020005', false)).toBe('TEST.SPE.GJ020005')
  })
})
