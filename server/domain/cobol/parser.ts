import type {
  CobolField,
  CobolFieldType,
  CobolUsage,
  ParsedCopybook,
  RedefinesBranch
} from '#shared/types/cobol'

interface RawDeclaration {
  level: number
  name: string
  redefines?: string
  pic?: string
  usage: CobolUsage
  isFiller: boolean
}

/**
 * Cleans a raw COBOL copybook source (supports both standard 80-column mainframe format
 * with sequence numbers in cols 1-6 / comments in col 7, and free-format copybooks).
 */
function preprocessCopybook(raw: string): string[] {
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const cleanedLines: string[] = []

  for (const line of lines) {
    if (!line.trim()) continue

    // Free-format comment starting with * or *>
    const trimmed = line.trimStart()
    if (trimmed.startsWith('*') || trimmed.startsWith('/')) {
      continue
    }

    let content = line

    // Standard mainframe fixed-format detection:
    // If line has >= 7 chars and col 7 (index 6) is '*' or '/', it's a comment
    if (line.length >= 7 && (line[6] === '*' || line[6] === '/')) {
      continue
    }

    // Strip cols 73-80 if line looks like fixed-format 80-col mainframe source
    if (line.length > 72 && /^[\d\sA-Za-z]{6}\s/.test(line)) {
      content = line.slice(6, 72)
    } else if (/^\d{6}\s/.test(line)) {
      // Strip 6-digit sequence number prefix
      content = line.slice(6)
    }

    // Remove inline comments (*>)
    const inlineCommentIdx = content.indexOf('*>')
    if (inlineCommentIdx !== -1) {
      content = content.slice(0, inlineCommentIdx)
    }

    if (content.trim()) {
      cleanedLines.push(content.trim())
    }
  }

  // Join lines into period-terminated COBOL statements
  const statements: string[] = []
  let buffer = ''

  for (const chunk of cleanedLines) {
    buffer = buffer ? `${buffer} ${chunk}` : chunk
    // Split on period followed by end-of-string or whitespace (not decimal dots inside PIC)
    if (/\.\s*$/.test(buffer)) {
      statements.push(buffer.replace(/\.\s*$/, '').trim())
      buffer = ''
    }
  }

  if (buffer.trim()) {
    statements.push(buffer.trim())
  }

  return statements
}

/**
 * Parses a COBOL PIC clause (e.g. "S9(8)V99", "X(4)", "9(05)", "S9(7)V9(2)")
 * into signed flag, integer digits, decimal digits, and character count.
 */
function parsePicClause(picRaw: string): {
  isNumeric: boolean
  signed: boolean
  integerDigits: number
  decimalDigits: number
  charLength: number
} {
  // Normalize uppercase and remove whitespace
  const pic = picRaw.toUpperCase().replace(/\s+/g, '')

  // Expand repetition factors like 9(8) -> 99999999, X(4) -> XXXX
  const expanded = pic.replace(/([A-Z90\+\-\$Z\*])\((\d+)\)/g, (_, ch: string, count: string) => {
    return ch.repeat(Number.parseInt(count, 10))
  })

  const signed = expanded.startsWith('S')
  const withoutSign = signed ? expanded.slice(1) : expanded

  // Check if purely numeric (only 9 and optional V)
  const isNumeric = /^[9V]+$/.test(withoutSign) && withoutSign.includes('9')

  if (isNumeric) {
    const parts = withoutSign.split('V')
    const integerDigits = parts[0]?.length ?? 0
    const decimalDigits = parts[1]?.length ?? 0
    return {
      isNumeric: true,
      signed,
      integerDigits,
      decimalDigits,
      charLength: integerDigits + decimalDigits
    }
  }

  // Alphanumeric or edited numeric treated as display characters
  const charLength = withoutSign.replace(/V/g, '').length
  return {
    isNumeric: false,
    signed: false,
    integerDigits: 0,
    decimalDigits: 0,
    charLength
  }
}

/**
 * Calculates byte length and CobolFieldType from PIC + USAGE.
 */
function resolveFieldStorage(picRaw: string, usage: CobolUsage): {
  type: CobolFieldType
  byteLength: number
  signed: boolean
  integerDigits: number
  decimalDigits: number
} {
  const parsed = parsePicClause(picRaw)

  if (!parsed.isNumeric) {
    return {
      type: 'ALPHANUMERIC',
      byteLength: parsed.charLength,
      signed: false,
      integerDigits: 0,
      decimalDigits: 0
    }
  }

  const totalDigits = parsed.integerDigits + parsed.decimalDigits

  if (usage === 'COMP-3') {
    // Packed decimal: 2 digits per byte + 1 sign nibble -> ceil((digits + 1) / 2)
    const byteLength = Math.ceil((totalDigits + 1) / 2)
    return {
      type: 'PACKED_DECIMAL',
      byteLength,
      signed: parsed.signed,
      integerDigits: parsed.integerDigits,
      decimalDigits: parsed.decimalDigits
    }
  }

  if (usage === 'COMP' || usage === 'COMP-4' || usage === 'COMP-5') {
    // Binary integer: 1-4 digits -> 2 bytes, 5-9 -> 4 bytes, 10-18 -> 8 bytes
    const byteLength = totalDigits <= 4 ? 2 : totalDigits <= 9 ? 4 : 8
    return {
      type: 'BINARY',
      byteLength,
      signed: parsed.signed,
      integerDigits: parsed.integerDigits,
      decimalDigits: parsed.decimalDigits
    }
  }

  // DISPLAY Zoned Decimal: 1 byte per digit
  return {
    type: 'ZONED_DECIMAL',
    byteLength: totalDigits,
    signed: parsed.signed,
    integerDigits: parsed.integerDigits,
    decimalDigits: parsed.decimalDigits
  }
}

/**
 * Parses a single period-terminated COBOL statement into a RawDeclaration.
 */
function parseStatement(stmt: string, warnings: string[]): RawDeclaration | null {
  // Match leading level number (e.g. "01", "05", "10", "88")
  const levelMatch = /^(\d{1,2})\s+(.*)$/i.exec(stmt)
  if (!levelMatch) {
    return null
  }

  const level = Number.parseInt(levelMatch[1]!, 10)
  const rest = levelMatch[2]!.trim()

  // Skip condition names (88) and RENAMES (66)
  if (level === 88 || level === 66) {
    return null
  }

  // Extract field name (or implicit FILLER if starts directly with PIC/REDEFINES)
  let name = 'FILLER'
  let clauses = rest

  const firstTokenMatch = /^([A-Z0-9_-]+)(?:\s+(.*))?$/i.exec(rest)
  if (firstTokenMatch) {
    const token = firstTokenMatch[1]!.toUpperCase()
    if (token === 'PIC' || token === 'PICTURE' || token === 'REDEFINES' || token === 'VALUE') {
      name = 'FILLER'
      clauses = rest
    } else {
      name = token
      clauses = (firstTokenMatch[2] ?? '').trim()
    }
  }

  const isFiller = name === 'FILLER'

  // Extract REDEFINES target
  let redefines: string | undefined
  const redefMatch = /\bREDEFINES\s+([A-Z0-9_-]+)/i.exec(clauses)
  if (redefMatch) {
    redefines = redefMatch[1]!.toUpperCase()
  }

  // Detect OCCURS (warn if encountered)
  if (/\bOCCURS\b/i.test(clauses)) {
    warnings.push(`Clause OCCURS détectée sur ${name} (non supportée dans le périmètre initial).`)
  }

  // Extract PIC / PICTURE clause
  let pic: string | undefined
  const picMatch = /\bPIC(?:TURE)?(?:\s+IS)?\s+([A-Z0-9\(\)V\+\-\$\*\.\/,]+)/i.exec(clauses)
  if (picMatch) {
    pic = picMatch[1]!.toUpperCase()
  }

  // Extract USAGE clause
  let usage: CobolUsage = 'DISPLAY'
  if (/\b(?:COMP-3|COMPUTATIONAL-3|PACKED-DECIMAL)\b/i.test(clauses)) {
    usage = 'COMP-3'
  } else if (/\b(?:COMP-5|COMPUTATIONAL-5)\b/i.test(clauses)) {
    usage = 'COMP-5'
  } else if (/\b(?:COMP-4|COMPUTATIONAL-4)\b/i.test(clauses)) {
    usage = 'COMP-4'
  } else if (/\b(?:COMP|COMPUTATIONAL|BINARY)\b/i.test(clauses)) {
    usage = 'COMP'
  }

  return {
    level,
    name,
    redefines,
    pic,
    usage,
    isFiller
  }
}

/**
 * Recursively computes byte offsets and lengths for a COBOL field tree.
 * Handles REDEFINES by resetting the offset to the redefined sibling's offset.
 */
function computeLayout(nodes: CobolField[], startOffset: number, warnings: string[]): number {
  let currentOffset = startOffset
  // Track siblings by name in this scope for REDEFINES resolution
  const siblingMap = new Map<string, CobolField>()
  // Track max end offset for each redefined base field
  const redefinedMaxEnd = new Map<string, number>()

  for (const node of nodes) {
    let nodeOffset = currentOffset

    if (node.redefines) {
      const target = siblingMap.get(node.redefines)
      if (target) {
        nodeOffset = target.offset
      } else {
        warnings.push(`REDEFINES cible "${node.redefines}" introuvable pour "${node.name}".`)
      }
    }

    node.offset = nodeOffset

    if (node.type === 'GROUP' && node.children && node.children.length > 0) {
      const endOffset = computeLayout(node.children, nodeOffset, warnings)
      node.byteLength = endOffset - nodeOffset
    }

    const nodeEnd = node.offset + node.byteLength

    if (node.redefines && siblingMap.has(node.redefines)) {
      const prevMax = redefinedMaxEnd.get(node.redefines) ?? currentOffset
      const newMax = Math.max(prevMax, nodeEnd)
      redefinedMaxEnd.set(node.redefines, newMax)
      currentOffset = Math.max(currentOffset, newMax)
    } else {
      if (!node.isFiller) {
        siblingMap.set(node.name, node)
      }
      redefinedMaxEnd.set(node.name, nodeEnd)
      currentOffset = nodeEnd
    }
  }

  return currentOffset
}

/**
 * Flattens all elementary non-filler fields under a node.
 */
function collectElementaryFields(node: CobolField): CobolField[] {
  if (node.type !== 'GROUP') {
    return node.isFiller ? [] : [node]
  }
  const result: CobolField[] = []
  for (const child of node.children ?? []) {
    result.push(...collectElementaryFields(child))
  }
  return result
}

/**
 * Parses a COBOL Copybook string into a structured ParsedCopybook with byte offsets,
 * calculated LRECL, common fields, and REDEFINES branches.
 */
export function parseCopybook(rawContent: string): ParsedCopybook {
  const warnings: string[] = []
  const statements = preprocessCopybook(rawContent)

  const declarations: RawDeclaration[] = []
  for (const stmt of statements) {
    const decl = parseStatement(stmt, warnings)
    if (decl) {
      declarations.push(decl)
    }
  }

  if (declarations.length === 0) {
    throw new Error('Aucune déclaration COBOL valide trouvée dans le copybook.')
  }

  // Build hierarchical tree using a stack of open group nodes
  const rootNodes: CobolField[] = []
  const stack: CobolField[] = []

  for (const decl of declarations) {
    const isElementary = Boolean(decl.pic)
    let field: CobolField

    if (isElementary) {
      const storage = resolveFieldStorage(decl.pic!, decl.usage)
      field = {
        level: decl.level,
        name: decl.name,
        offset: 0,
        byteLength: storage.byteLength,
        type: storage.type,
        pic: decl.pic,
        usage: decl.usage,
        signed: storage.signed,
        integerDigits: storage.integerDigits,
        decimalDigits: storage.decimalDigits,
        redefines: decl.redefines,
        isFiller: decl.isFiller
      }
    } else {
      field = {
        level: decl.level,
        name: decl.name,
        offset: 0,
        byteLength: 0,
        type: 'GROUP',
        redefines: decl.redefines,
        isFiller: decl.isFiller,
        children: []
      }
    }

    // Pop stack until we find a parent with a strictly lower level number
    while (stack.length > 0 && stack[stack.length - 1]!.level >= field.level) {
      stack.pop()
    }

    if (stack.length === 0) {
      rootNodes.push(field)
    } else {
      const parent = stack[stack.length - 1]!
      if (!parent.children) {
        parent.children = []
      }
      parent.children.push(field)
    }

    if (field.type === 'GROUP') {
      stack.push(field)
    }
  }

  // Compute byte offsets and lengths
  const totalEnd = computeLayout(rootNodes, 0, warnings)
  const recordName = rootNodes[0]?.name ?? 'RECORD'
  const lrecl = totalEnd

  // Identify all redefined targets & REDEFINES branches
  const redefinedTargetNames = new Set<string>()
  const redefinesBranches: RedefinesBranch[] = []

  function scanRedefines(nodes: CobolField[]) {
    for (const node of nodes) {
      if (node.redefines) {
        redefinedTargetNames.add(node.redefines)
        redefinesBranches.push({
          name: node.name,
          redefines: node.redefines,
          offset: node.offset,
          byteLength: node.byteLength,
          fields: collectElementaryFields(node)
        })
      } else if (node.children) {
        scanRedefines(node.children)
      }
    }
  }
  scanRedefines(rootNodes)

  // Collect commonFields (not redefining, and not themselves a redefined target)
  // and baseFields (not redefining, including redefined targets)
  const commonFields: CobolField[] = []
  const baseFields: CobolField[] = []

  function scanCommon(nodes: CobolField[], insideRedefinedTarget: boolean) {
    for (const node of nodes) {
      if (node.redefines) {
        continue
      }
      const isTarget = insideRedefinedTarget || redefinedTargetNames.has(node.name)

      if (node.type === 'GROUP') {
        scanCommon(node.children ?? [], isTarget)
      } else if (!node.isFiller) {
        baseFields.push(node)
        if (!isTarget) {
          commonFields.push(node)
        }
      }
    }
  }
  scanCommon(rootNodes, false)

  return {
    recordName,
    lrecl,
    tree: rootNodes,
    commonFields,
    baseFields,
    redefinesBranches,
    warnings
  }
}
