export interface ChainRule {
  id: string
  copybookId: string
  /** Field name in the common header holding the 4-char Code Chaîne (e.g. "CODE-CHAINE") */
  chainFieldName: string
  /** Exact 4-character code (e.g. "DP01", "JG16", "GE00") */
  codeChaine: string
  /** Optional field name for TYP-ENR */
  typEnrFieldName?: string
  /** Optional exact value for TYP-ENR */
  typEnrValue?: string
  /** Optional name of the REDEFINES branch in the copybook to apply (empty = flat/common structure) */
  redefinesBranchName?: string
  /** Optional human-readable label (e.g. "Prélèvements automatiques") */
  label?: string
  createdAt: string
  updatedAt: string
}

export interface DsnModel {
  id: string
  /** Logical display name or default DSN (e.g. "TEST.SPE.GJ020005") */
  name: string
  /** Default z/OS Dataset Name */
  defaultDsn: string
  description?: string
  copybookId: string
  /** Optional override if physical LRECL differs from copybook calculated LRECL */
  lreclOverride?: number
  /** Allowed ChainRule IDs for this DSN model (empty = all rules for this copybook) */
  chainRuleIds: string[]
  createdAt: string
  updatedAt: string
}

export interface FtpConfig {
  host: string
  port: number
  user: string
  password?: string
  /** Wrap z/OS dataset names in single quotes ('DSN') to prevent RACF HLQ prefixing */
  quoteDsn: boolean
  /** Connection timeout in ms */
  timeoutMs: number
}

export interface FtpConfigPublic extends Omit<FtpConfig, 'password'> {
  hasPassword: boolean
}
