import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'

const discoverSchema = z.object({
  topic: z.string().min(2).max(200),
  count: z.number().int().min(1).max(50).optional().default(20),
})

interface SearchResult {
  url: string
  title: string
  snippet: string
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

// List available topics
export async function GET() {
  const topics = Object.keys(CURATED_SOURCES).sort()
  return NextResponse.json({
    topics,
    count: topics.length,
  })
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { topic, count } = discoverSchema.parse(body)

    // Get curated sources for the topic
    const results = getCuratedSources(topic).slice(0, count)

    // Find what topics matched
    const matchedTopics = findMatchingTopics(topic)

    return NextResponse.json({
      success: true,
      query: topic,
      matchedTopics,
      results,
      count: results.length,
      hint: results.length === 0
        ? `No sources found for "${topic}". Try: ${Object.keys(CURATED_SOURCES).slice(0, 5).join(', ')}`
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
