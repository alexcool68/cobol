import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, join, resolve } from 'node:path'

export const DATA_ROOT = resolve(process.cwd(), 'data')
export const CONFIG_DIR = join(DATA_ROOT, 'config')
export const COPYBOOKS_DIR = join(DATA_ROOT, 'copybooks')
export const INCIDENTS_DIR = join(DATA_ROOT, 'incidents')

export async function ensureDir(dirPath: string): Promise<void> {
  await mkdir(dirPath, { recursive: true })
}

export async function readJsonFile<T>(filePath: string, fallback: T): Promise<T> {
  try {
    const content = await readFile(filePath, 'utf-8')
    return JSON.parse(content) as T
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return fallback
    }
    throw err
  }
}

export async function writeJsonFile<T>(filePath: string, data: T): Promise<void> {
  await ensureDir(dirname(filePath))
  await writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8')
}
