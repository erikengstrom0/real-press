import { NextRequest, NextResponse } from "next/server";

export interface SearchResult {
  id: string;
  title: string;
  description: string;
  url: string;
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const query = searchParams.get("q");

  if (!query) {
    return NextResponse.json({ results: [], query: "" });
  }

  // TODO: Implement actual search logic here
  // This is a placeholder that returns mock results
  const mockResults: SearchResult[] = [
    {
      id: "1",
      title: `Result for "${query}"`,
      description: "This is a placeholder search result. Implement your search backend here.",
      url: "#",
    },
  ];

  return NextResponse.json({
    results: mockResults,
    query,
  });
}
