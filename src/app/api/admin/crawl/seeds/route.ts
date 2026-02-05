import { NextRequest, NextResponse } from 'next/server'
import { readdir, readFile } from 'fs/promises'
import path from 'path'
import { createCrawlJobsBatch } from '@/lib/services/crawl-job.service'

interface SeedList {
  name: string
  description: string
  priority?: number
  urls: string[]
}

const SEEDS_DIR = path.join(process.cwd(), 'seeds')

async function loadSeedFile(filename: string): Promise<SeedList | null> {
  try {
    const filepath = path.join(SEEDS_DIR, `${filename}.json`)
    const content = await readFile(filepath, 'utf-8')
    return JSON.parse(content) as SeedList
  } catch {
    return null
  }
}

async function listSeedFiles(): Promise<string[]> {
  try {
    const files = await readdir(SEEDS_DIR)
    return files
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace('.json', ''))
  } catch {
    return []
  }
}

// GET /api/admin/crawl/seeds - List available seed lists
export async function GET() {
  try {
    const files = await listSeedFiles()

    const seeds = await Promise.all(
      files.map(async (filename) => {
        const data = await loadSeedFile(filename)
        if (!data) return null
        return {
          filename,
          name: data.name,
          description: data.description,
          urlCount: data.urls.length,
          priority: data.priority || 0,
        }
      })
    )

    return NextResponse.json({
      seeds: seeds.filter(Boolean),
    })
  } catch (error) {
    console.error('List seeds error:', error)
    return NextResponse.json({ error: 'Failed to list seeds' }, { status: 500 })
  }
}

// POST /api/admin/crawl/seeds - Import seed list(s) into crawl queue
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { file, all } = body as { file?: string; all?: boolean }

    let filesToImport: string[] = []

    if (all) {
      filesToImport = await listSeedFiles()
    } else if (file) {
      filesToImport = [file]
    } else {
      return NextResponse.json(
        { error: 'Specify "file" or "all: true"' },
        { status: 400 }
      )
    }

    const results: Array<{
      file: string
      name: string
      submitted: number
      created: number
      duplicates: number
    }> = []

    let totalCreated = 0
    let totalDuplicates = 0

    for (const filename of filesToImport) {
      const seedList = await loadSeedFile(filename)

      if (!seedList) {
        results.push({
          file: filename,
          name: 'Not found',
          submitted: 0,
          created: 0,
          duplicates: 0,
        })
        continue
      }

      const result = await createCrawlJobsBatch(
        seedList.urls,
        `seed:${filename}`,
        seedList.priority || 0
      )

      results.push({
        file: filename,
        name: seedList.name,
        submitted: seedList.urls.length,
        created: result.created,
        duplicates: result.duplicates,
      })

      totalCreated += result.created
      totalDuplicates += result.duplicates
    }

    return NextResponse.json({
      success: true,
      imported: results,
      totals: {
        created: totalCreated,
        duplicates: totalDuplicates,
      },
    })
  } catch (error) {
    console.error('Import seeds error:', error)
    return NextResponse.json({ error: 'Failed to import seeds' }, { status: 500 })
  }
}
