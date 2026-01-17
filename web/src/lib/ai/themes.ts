import { createChatCompletion } from './client';
import { Article, insertTopic, linkArticleToTopic, getAllTopics } from '../db';

export interface Theme {
  name: string;
  description: string;
  articleCount: number;
  articleIds: number[];
}

export interface InsightsResult {
  themes: Theme[];
  mainInsight: string;
  trends: string[];
}

/**
 * Detect themes and generate insights from a batch of articles
 */
export async function detectThemesAndInsights(articles: Article[]): Promise<InsightsResult> {
  if (articles.length === 0) {
    return {
      themes: [],
      mainInsight: 'No articles to analyze.',
      trends: [],
    };
  }

  // Prepare article content
  const articleTexts = articles.map((a, i) =>
    `[${i + 1}] "${a.title}" - ${a.summary.substring(0, 200)}...`
  ).join('\n');

  const prompt = `Analyze these ${articles.length} tech/business news articles and identify the main themes and trends.

Articles:
${articleTexts}

Provide your analysis in this exact format:

MAIN INSIGHT:
[A single sentence capturing the week's most significant development or pattern]

THEMES:
1. [Theme name]: [Brief description] | Articles: [comma-separated article numbers that relate to this theme]
2. [Theme name]: [Brief description] | Articles: [article numbers]
3. [Theme name]: [Brief description] | Articles: [article numbers]
[Add up to 5 themes total]

TRENDS:
- [Emerging trend or pattern 1]
- [Emerging trend or pattern 2]
- [Emerging trend or pattern 3]

Focus on identifying:
- Major technology developments (AI, cloud, security, etc.)
- Business/funding news patterns
- Industry shifts or consolidations
- Emerging technologies or practices`;

  const response = await createChatCompletion([
    { role: 'system', content: 'You are an expert tech analyst who identifies patterns and themes in news. Be specific and insightful. Only use information from the provided articles.' },
    { role: 'user', content: prompt },
  ], {
    maxTokens: 1500,
    temperature: 0.6,
  });

  // Parse the response
  const result = parseThemesResponse(response, articles);

  // Save themes to database and link articles
  await saveThemesToDatabase(result.themes);

  return result;
}

function parseThemesResponse(response: string, articles: Article[]): InsightsResult {
  // Parse main insight
  const insightMatch = response.match(/MAIN INSIGHT:\s*([\s\S]+?)(?=\n\nTHEMES:|$)/i);
  const mainInsight = insightMatch?.[1]?.trim() || 'Multiple developments across tech and business sectors.';

  // Parse themes
  const themesMatch = response.match(/THEMES:\s*([\s\S]*?)(?=\n\nTRENDS:|$)/i);
  const themesText = themesMatch?.[1]?.trim() || '';

  const themes: Theme[] = [];
  const themeLines = themesText.split('\n').filter(line => line.match(/^\d+\./));

  for (const line of themeLines) {
    const themeMatch = line.match(/^\d+\.\s*(.+?):\s*(.+?)\s*\|\s*Articles:\s*(.+)$/i);
    if (themeMatch) {
      const name = themeMatch[1].trim();
      const description = themeMatch[2].trim();
      const articleNumbers = themeMatch[3]
        .split(/[,\s]+/)
        .map(n => parseInt(n.trim()))
        .filter(n => !isNaN(n) && n >= 1 && n <= articles.length);

      const articleIds = articleNumbers.map(n => articles[n - 1].id);

      themes.push({
        name,
        description,
        articleCount: articleIds.length,
        articleIds,
      });
    }
  }

  // Parse trends
  const trendsMatch = response.match(/TRENDS:\s*([\s\S]*?)$/i);
  const trendsText = trendsMatch?.[1]?.trim() || '';

  const trends = trendsText
    .split('\n')
    .map(line => line.replace(/^[-•*]\s*/, '').trim())
    .filter(line => line.length > 0);

  return {
    themes,
    mainInsight,
    trends,
  };
}

async function saveThemesToDatabase(themes: Theme[]): Promise<void> {
  for (const theme of themes) {
    // Insert or get the topic
    const topic = insertTopic(theme.name);

    // Link articles to the topic
    for (const articleId of theme.articleIds) {
      linkArticleToTopic(articleId, topic.id);
    }
  }
}

/**
 * Get existing themes/topics from database with article counts
 */
export function getExistingThemes(): { name: string; articleCount: number }[] {
  const topics = getAllTopics();

  // This is a simplified version - in production you'd join with article_topics
  return topics.map(t => ({
    name: t.name,
    articleCount: 0, // Would need to query article_topics to get actual count
  }));
}
