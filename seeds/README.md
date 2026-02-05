# Seed Lists

Curated URL lists for the Real Press web scraper. Each JSON file contains URLs organized by theme.

## Structure

```json
{
  "name": "Theme Name",
  "description": "What kind of content this list contains",
  "urls": [
    "https://example.com/article-1",
    "https://example.com/article-2"
  ]
}
```

## Usage

```bash
# Import a seed list into the crawl queue
curl -X POST http://localhost:3000/api/admin/crawl/seeds/import \
  -H "Content-Type: application/json" \
  -d '{"file": "tech-essays"}'

# Or import all seed lists
curl -X POST http://localhost:3000/api/admin/crawl/seeds/import \
  -d '{"all": true}'
```

## Adding New Seeds

1. Create a new JSON file in this directory (e.g., `my-theme.json`)
2. Follow the structure above
3. Import via the API

## Quality Guidelines

- Prefer long-form content (essays, articles, blog posts)
- Avoid paywalled content
- Avoid sites with aggressive anti-bot protection (Reddit, Twitter, LinkedIn)
- Focus on content likely to be human-written for best demo variety
