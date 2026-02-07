import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const discoverSchema = z.object({
  topic: z.string().min(2).max(200),
  count: z.number().int().min(1).max(50).optional().default(20),
  useCurated: z.boolean().optional().default(false), // Use curated sources instead of web search
})

interface SearchResult {
  url: string
  title: string
  snippet: string
}

interface BraveSearchResult {
  web?: {
    results: Array<{
      url: string
      title: string
      description: string
    }>
  }
}

/**
 * Search the web using Brave Search API
 * Free tier: 2,000 queries/month
 * Get your key at: https://brave.com/search/api/
 */
async function searchWithBrave(query: string, count: number = 20): Promise<SearchResult[]> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY

  if (!apiKey) {
    return []
  }

  const params = new URLSearchParams({
    q: query,
    count: String(Math.min(count * 2, 40)), // Request extra for filtering
    text_decorations: 'false',
    search_lang: 'en',
    result_filter: 'web',
  })

  try {
    const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: {
        'Accept': 'application/json',
        'X-Subscription-Token': apiKey,
      },
    })

    if (!response.ok) {
      console.error(`Brave Search error: ${response.status}`)
      return []
    }

    const data: BraveSearchResult = await response.json()

    if (!data.web?.results) {
      return []
    }

    return data.web.results.map(result => ({
      url: result.url,
      title: result.title,
      snippet: result.description,
    }))
  } catch (error) {
    console.error('Brave Search failed:', error)
    return []
  }
}

/**
 * Filter results to prefer article-like URLs
 */
function filterArticleUrls(results: SearchResult[]): SearchResult[] {
  const excludeDomains = [
    'youtube.com', 'youtu.be',
    'twitter.com', 'x.com',
    'facebook.com', 'instagram.com',
    'tiktok.com', 'reddit.com',
    'linkedin.com', 'pinterest.com',
    'amazon.com', 'ebay.com',
    'wikipedia.org',
  ]

  return results.filter(result => {
    try {
      const url = new URL(result.url)
      const domain = url.hostname.replace('www.', '')

      // Exclude social media and shopping sites
      if (excludeDomains.some(d => domain.includes(d))) {
        return false
      }

      // Exclude homepages (want articles, not landing pages)
      const path = url.pathname
      if (path === '/' || path === '/index.html' || path === '') {
        return false
      }

      return true
    } catch {
      return false
    }
  })
}

// Comprehensive curated sources organized by topic
const CURATED_SOURCES: Record<string, SearchResult[]> = {
  'machine learning': [
    { url: 'https://distill.pub/', title: 'Distill - ML Research', snippet: 'Clear explanations of machine learning' },
    { url: 'https://lilianweng.github.io/', title: "Lil'Log", snippet: 'Deep dives into ML topics' },
    { url: 'https://karpathy.github.io/', title: 'Andrej Karpathy', snippet: 'ML insights from OpenAI' },
    { url: 'https://colah.github.io/', title: "Colah's Blog", snippet: 'Neural network visualizations' },
    { url: 'https://jalammar.github.io/', title: 'Jay Alammar', snippet: 'Illustrated ML explanations' },
    { url: 'https://ruder.io/', title: 'Sebastian Ruder', snippet: 'NLP research and insights' },
  ],
  'ai': [
    { url: 'https://openai.com/blog/', title: 'OpenAI Blog', snippet: 'AI research and updates' },
    { url: 'https://www.anthropic.com/news', title: 'Anthropic News', snippet: 'AI safety research' },
    { url: 'https://deepmind.google/discover/blog/', title: 'DeepMind Blog', snippet: 'AI breakthroughs' },
    { url: 'https://ai.meta.com/blog/', title: 'Meta AI Blog', snippet: 'AI research from Meta' },
    { url: 'https://hai.stanford.edu/news', title: 'Stanford HAI', snippet: 'Human-centered AI' },
    { url: 'https://www.technologyreview.com/topic/artificial-intelligence/', title: 'MIT Tech Review AI', snippet: 'AI news and analysis' },
  ],
  'startup': [
    { url: 'https://www.ycombinator.com/library', title: 'YC Library', snippet: 'Startup advice from YC' },
    { url: 'https://www.paulgraham.com/articles.html', title: 'Paul Graham Essays', snippet: 'Foundational startup wisdom' },
    { url: 'https://a16z.com/articles/', title: 'a16z Articles', snippet: 'VC insights' },
    { url: 'https://firstround.com/review/', title: 'First Round Review', snippet: 'Startup best practices' },
    { url: 'https://www.nfx.com/post', title: 'NFX Essays', snippet: 'Network effects and growth' },
    { url: 'https://blog.samaltman.com/', title: 'Sam Altman Blog', snippet: 'Startup and tech insights' },
  ],
  'programming': [
    { url: 'https://blog.codinghorror.com/', title: 'Coding Horror', snippet: 'Jeff Atwood on programming' },
    { url: 'https://www.joelonsoftware.com/', title: 'Joel on Software', snippet: 'Software development' },
    { url: 'https://martinfowler.com/', title: 'Martin Fowler', snippet: 'Software architecture' },
    { url: 'https://danluu.com/', title: 'Dan Luu', snippet: 'Systems and performance' },
    { url: 'https://jvns.ca/', title: 'Julia Evans', snippet: 'Zines and debugging' },
    { url: 'https://rachelbythebay.com/w/', title: 'Rachel by the Bay', snippet: 'Systems war stories' },
  ],
  'software engineering': [
    { url: 'https://blog.pragmaticengineer.com/', title: 'Pragmatic Engineer', snippet: 'Big tech engineering' },
    { url: 'https://lethain.com/', title: 'Irrational Exuberance', snippet: 'Engineering leadership' },
    { url: 'https://charity.wtf/', title: 'Charity Majors', snippet: 'Observability and ops' },
    { url: 'https://staffeng.com/', title: 'StaffEng', snippet: 'Staff+ engineering' },
    { url: 'https://newsletter.pragmaticengineer.com/', title: 'Pragmatic Engineer Newsletter', snippet: 'Industry insights' },
  ],
  'design': [
    { url: 'https://lawsofux.com/', title: 'Laws of UX', snippet: 'UX principles and psychology' },
    { url: 'https://uxdesign.cc/', title: 'UX Collective', snippet: 'UX articles and case studies' },
    { url: 'https://www.nngroup.com/articles/', title: 'Nielsen Norman Group', snippet: 'Usability research' },
    { url: 'https://alistapart.com/', title: 'A List Apart', snippet: 'Web design and development' },
    { url: 'https://frankchimero.com/blog/', title: 'Frank Chimero', snippet: 'Design philosophy' },
  ],
  'product': [
    { url: 'https://www.svpg.com/articles/', title: 'SVPG', snippet: 'Product management insights' },
    { url: 'https://www.lennysnewsletter.com/', title: "Lenny's Newsletter", snippet: 'Product and growth' },
    { url: 'https://www.reforge.com/blog', title: 'Reforge Blog', snippet: 'Growth and product' },
    { url: 'https://www.intercom.com/blog/', title: 'Intercom Blog', snippet: 'Product and customer success' },
  ],
  'climate': [
    { url: 'https://www.carbonbrief.org/', title: 'Carbon Brief', snippet: 'Climate science and policy' },
    { url: 'https://yaleclimateconnections.org/', title: 'Yale Climate', snippet: 'Climate communication' },
    { url: 'https://www.climate.gov/news-features', title: 'Climate.gov', snippet: 'NOAA climate news' },
    { url: 'https://www.volts.wtf/', title: 'Volts', snippet: 'Clean energy deep dives' },
    { url: 'https://www.canarymedia.com/', title: 'Canary Media', snippet: 'Clean energy news' },
  ],
  'science': [
    { url: 'https://www.quantamagazine.org/', title: 'Quanta Magazine', snippet: 'Math and science journalism' },
    { url: 'https://nautil.us/', title: 'Nautilus', snippet: 'Science connected' },
    { url: 'https://aeon.co/', title: 'Aeon', snippet: 'Ideas and philosophy' },
    { url: 'https://www.theatlantic.com/science/', title: 'The Atlantic Science', snippet: 'Science reporting' },
    { url: 'https://www.newyorker.com/tech', title: 'New Yorker Tech', snippet: 'Tech and science essays' },
  ],
  'economics': [
    { url: 'https://marginalrevolution.com/', title: 'Marginal Revolution', snippet: 'Economics blog' },
    { url: 'https://noahpinion.substack.com/', title: 'Noahpinion', snippet: 'Economics commentary' },
    { url: 'https://www.slowboring.com/', title: 'Slow Boring', snippet: 'Policy and politics' },
    { url: 'https://conversationswithtyler.com/', title: 'Conversations with Tyler', snippet: 'Economics and culture' },
  ],
  'writing': [
    { url: 'https://austinkleon.com/', title: 'Austin Kleon', snippet: 'Creativity and art' },
    { url: 'https://seths.blog/', title: "Seth's Blog", snippet: 'Marketing and ideas' },
    { url: 'https://moretothat.com/', title: 'More To That', snippet: 'Illustrated essays' },
    { url: 'https://waitbutwhy.com/', title: 'Wait But Why', snippet: 'Long-form explainers' },
    { url: 'https://www.brainpickings.org/', title: 'The Marginalian', snippet: 'Literature and life' },
  ],
  'philosophy': [
    { url: 'https://aeon.co/philosophy', title: 'Aeon Philosophy', snippet: 'Philosophical essays' },
    { url: 'https://plato.stanford.edu/', title: 'Stanford Encyclopedia', snippet: 'Philosophy reference' },
    { url: 'https://dailystoic.com/blog/', title: 'Daily Stoic', snippet: 'Stoic philosophy' },
    { url: 'https://www.brainpickings.org/tag/philosophy/', title: 'Marginalian Philosophy', snippet: 'Philosophical musings' },
  ],
  'history': [
    { url: 'https://www.historytoday.com/', title: 'History Today', snippet: 'Historical articles' },
    { url: 'https://aeon.co/history', title: 'Aeon History', snippet: 'Historical essays' },
    { url: 'https://www.smithsonianmag.com/history/', title: 'Smithsonian History', snippet: 'Historical features' },
  ],
  'personal development': [
    { url: 'https://jamesclear.com/articles', title: 'James Clear', snippet: 'Habits and improvement' },
    { url: 'https://www.raptitude.com/', title: 'Raptitude', snippet: 'Mindful living' },
    { url: 'https://sive.rs/', title: 'Derek Sivers', snippet: 'Life and business' },
    { url: 'https://zenhabits.net/', title: 'Zen Habits', snippet: 'Simplicity and mindfulness' },
  ],
}

// Keywords that map to topics
const TOPIC_KEYWORDS: Record<string, string[]> = {
  'machine learning': ['ml', 'deep learning', 'neural network', 'transformer', 'llm'],
  'ai': ['artificial intelligence', 'gpt', 'chatgpt', 'language model', 'generative'],
  'startup': ['founder', 'entrepreneur', 'vc', 'venture', 'bootstrap', 'saas', 'b2b'],
  'programming': ['coding', 'developer', 'code', 'software', 'engineering'],
  'software engineering': ['devops', 'infrastructure', 'systems', 'architecture', 'backend'],
  'design': ['ux', 'ui', 'user experience', 'interface', 'usability'],
  'product': ['product management', 'pm', 'roadmap', 'feature', 'growth'],
  'climate': ['climate change', 'global warming', 'sustainability', 'renewable', 'carbon'],
  'science': ['research', 'physics', 'biology', 'chemistry', 'astronomy'],
  'economics': ['economy', 'finance', 'market', 'policy', 'monetary'],
  'writing': ['blog', 'essay', 'creative', 'author', 'content'],
  'philosophy': ['ethics', 'moral', 'existential', 'stoic', 'meaning'],
  'history': ['historical', 'ancient', 'war', 'civilization', 'century'],
  'personal development': ['productivity', 'habits', 'self-improvement', 'mindfulness', 'growth'],
}

/**
 * Find matching topics based on query
 */
function findMatchingTopics(query: string): string[] {
  const queryLower = query.toLowerCase()
  const matchedTopics: string[] = []

  // Direct topic match
  for (const topic of Object.keys(CURATED_SOURCES)) {
    if (queryLower.includes(topic) || topic.includes(queryLower)) {
      matchedTopics.push(topic)
    }
  }

  // Keyword match
  for (const [topic, keywords] of Object.entries(TOPIC_KEYWORDS)) {
    for (const keyword of keywords) {
      if (queryLower.includes(keyword)) {
        if (!matchedTopics.includes(topic)) {
          matchedTopics.push(topic)
        }
        break
      }
    }
  }

  return matchedTopics
}

/**
 * Get curated sources for a topic query
 */
function getCuratedSources(topic: string): SearchResult[] {
  const matchedTopics = findMatchingTopics(topic)
  const results: SearchResult[] = []
  const seen = new Set<string>()

  for (const matchedTopic of matchedTopics) {
    const sources = CURATED_SOURCES[matchedTopic] || []
    for (const source of sources) {
      if (!seen.has(source.url)) {
        seen.add(source.url)
        results.push(source)
      }
    }
  }

  return results
}

// List available topics and search config
export async function GET() {
  const topics = Object.keys(CURATED_SOURCES).sort()
  const braveConfigured = !!process.env.BRAVE_SEARCH_API_KEY

  return NextResponse.json({
    topics,
    count: topics.length,
    webSearch: {
      enabled: braveConfigured,
      provider: braveConfigured ? 'brave' : 'none',
      hint: braveConfigured
        ? 'Web search enabled - search for any topic'
        : 'Set BRAVE_SEARCH_API_KEY for web search (free: 2000 queries/month at brave.com/search/api)',
    },
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { topic, count, useCurated } = discoverSchema.parse(body)

    let results: SearchResult[] = []
    let source = 'none'

    // If useCurated flag is set, only use curated sources
    if (useCurated) {
      results = getCuratedSources(topic).slice(0, count)
      source = 'curated'
    } else {
      // Try web search first (Brave)
      const searchQuery = `${topic} article OR blog OR essay`
      const webResults = await searchWithBrave(searchQuery, count)

      if (webResults.length > 0) {
        results = filterArticleUrls(webResults).slice(0, count)
        source = 'brave'
      }

      // Fall back to curated sources if no web results
      if (results.length === 0) {
        results = getCuratedSources(topic).slice(0, count)
        source = results.length > 0 ? 'curated' : 'none'
      }
    }

    // Find what curated topics matched (for reference)
    const matchedTopics = findMatchingTopics(topic)

    return NextResponse.json({
      success: true,
      query: topic,
      source,
      matchedTopics: matchedTopics.length > 0 ? matchedTopics : undefined,
      results,
      count: results.length,
      hint: results.length === 0
        ? process.env.BRAVE_SEARCH_API_KEY
          ? `No results found for "${topic}". Try a different search term.`
          : `No curated sources for "${topic}". Add BRAVE_SEARCH_API_KEY for web search. Available topics: ${Object.keys(CURATED_SOURCES).slice(0, 5).join(', ')}`
        : undefined,
    })
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request', details: error.issues },
        { status: 400 }
      )
    }

    console.error('Discover error:', error)
    return NextResponse.json(
      { error: 'Discovery failed' },
      { status: 500 }
    )
  }
}
