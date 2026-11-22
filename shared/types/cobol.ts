export type CobolUsage = 'DISPLAY' | 'COMP' | 'COMP-3' | 'COMP-4' | 'COMP-5'

export type CobolFieldType = 'ALPHANUMERIC' | 'ZONED_DECIMAL' | 'PACKED_DECIMAL' | 'BINARY' | 'GROUP'

export interface CobolField {
  level: number
  name: string
  /** 0-based byte offset from start of record */
  offset: number
  /** Byte length in raw binary buffer */
  byteLength: number
  /** Logical field type */
  type: CobolFieldType
  /** Raw PIC clause (e.g. "S9(8)V99", "X(4)") */
  pic?: string
  usage?: CobolUsage
  signed?: boolean
  integerDigits?: number
  decimalDigits?: number
  /** Name of the field this group/field redefines, if any */
  redefines?: string
  /** True if FILLER */
  isFiller?: boolean
  /** Child fields if GROUP */
  children?: CobolField[]
}

export interface RedefinesBranch {
  /** Field name of the redefining group/item (e.g. "MVT-DP01-DATA") */
  name: string
  /** Target field name being redefined (e.g. "ZONE-VARIABLE") */
  redefines: string
  /** Byte offset where this branch starts */
  offset: number
  /** Byte length of this branch */
  byteLength: number
  /** Flattened elementary (non-filler) fields inside this branch */
  fields: CobolField[]
}

export interface ParsedCopybook {
  /** Top-level 01 record name */
  recordName: string
  /** Calculated LRECL in bytes */
  lrecl: number
  /** Full hierarchical AST */
  tree: CobolField[]
  /** Common (non-redefined) elementary fields, excluding FILLERs */
  commonFields: CobolField[]
  /** All elementary fields that are NOT inside a REDEFINES branch (including those being redefined) */
  baseFields: CobolField[]
  /** All detected REDEFINES branches */
  redefinesBranches: RedefinesBranch[]
  /** Non-fatal parser warnings */
  warnings: string[]
}

export interface CopybookMeta {
  id: string
  name: string
  description?: string
  lrecl: number
  redefinesCount: number
  commonFieldsCount: number
  createdAt: string
  updatedAt: string
}

export interface CopybookDetail extends CopybookMeta {
  rawContent: string
  parsed: ParsedCopybook
}
