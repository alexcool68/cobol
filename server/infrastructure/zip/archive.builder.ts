import JSZip from 'jszip'

export interface ZipEntry {
  fileName: string
  content: Buffer
}

export async function buildZipArchive(entries: ZipEntry[]): Promise<Buffer> {
  const zip = new JSZip()
  for (const entry of entries) {
    zip.file(entry.fileName, entry.content)
  }
  return zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 6 }
  })
}
