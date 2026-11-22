export interface ChainGroupSummary {
  /** Group key, e.g. "DP01" or "DP01_A" or "REJETS" */
  key: string
  codeChaine: string
  typEnr?: string
  label?: string
  redefinesBranchName?: string
  recordCount: number
  isRejected: boolean
  /** Generated CSV filename inside the incident folder */
  csvFileName: string
  /** Column headers for preview */
  columns: string[]
}

export interface IncidentFileResult {
  modelId: string
  modelName: string
  dsnUsed: string
  source: 'ftp' | 'local'
  copybookId: string
  copybookName: string
  lrecl: number
  fileSizeBytes: number
  totalRecords: number
  status: 'success' | 'error'
  errorMessage?: string
  groups: ChainGroupSummary[]
}

export interface IncidentSummary {
  id: string
  incidentNumber: string
  createdAt: string
  filesCount: number
  totalRecords: number
  totalCsvFiles: number
  status: 'completed' | 'partial' | 'failed'
}

export interface IncidentDetail extends IncidentSummary {
  files: IncidentFileResult[]
}
