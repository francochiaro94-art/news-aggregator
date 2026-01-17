import { fetchTLDREmails, processNewsletters } from '../gmail';
import { getArticlesByDateRange, insertAggregation, Aggregation } from '../db';
import { deduplicateArticles, quickDeduplicateByUrl } from '../ai/dedup';
import { summarizeArticles } from '../ai/summarize';
import { detectThemesAndInsights } from '../ai/themes';

export interface AggregationProgress {
  step: string;
  progress: number;
  details?: string;
}

export interface AggregationResult {
  aggregation: Aggregation;
  stats: {
    emailsFetched: number;
    articlesProcessed: number;
    articlesAfterDedup: number;
    themesDetected: number;
  };
}

/**
 * Run the full aggregation pipeline for a date range
 */
export async function runAggregationPipeline(
  startDate: Date,
  endDate: Date,
  onProgress?: (progress: AggregationProgress) => void
): Promise<AggregationResult> {
  const report = (step: string, progress: number, details?: string) => {
    onProgress?.({ step, progress, details });
  };

  // Step 1: Fetch emails from Gmail
  report('Fetching emails', 10, 'Connecting to Gmail...');
  const emails = await fetchTLDREmails(startDate, endDate);
  report('Fetching emails', 20, `Found ${emails.length} newsletter emails`);

  // Step 2: Parse and store articles
  report('Processing newsletters', 30, 'Extracting articles...');
  const parseResult = await processNewsletters(emails);
  report('Processing newsletters', 40, `Extracted ${parseResult.saved} new articles`);

  // Step 3: Get all articles in date range
  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];
  let articles = getArticlesByDateRange(startDateStr, endDateStr);
  const totalArticles = articles.length;

  // Step 4: Quick de-duplication by URL
  report('De-duplicating', 50, 'Removing exact duplicates...');
  articles = quickDeduplicateByUrl(articles);

  // Step 5: Semantic de-duplication (if we have articles)
  if (articles.length > 1) {
    report('De-duplicating', 55, 'Analyzing semantic similarity...');
    const dedupResult = await deduplicateArticles(articles);
    articles = dedupResult.uniqueArticles;
    report('De-duplicating', 60, `Removed ${dedupResult.removedCount} similar articles`);
  }

  // Step 6: Generate summary
  report('Summarizing', 70, 'Generating summary with AI...');
  const summaryResult = await summarizeArticles(articles);
  report('Summarizing', 80, 'Summary generated');

  // Step 7: Detect themes
  report('Analyzing themes', 85, 'Detecting themes and insights...');
  const themesResult = await detectThemesAndInsights(articles);
  report('Analyzing themes', 90, `Found ${themesResult.themes.length} themes`);

  // Step 8: Format insights
  const insightsText = formatInsights(themesResult);

  // Step 9: Save aggregation to database
  report('Saving', 95, 'Saving aggregation...');
  const aggregation = insertAggregation(
    {
      start_date: startDateStr,
      end_date: endDateStr,
      summary: summaryResult.summary,
      insights: insightsText,
    },
    articles.map(a => a.id)
  );

  report('Complete', 100, 'Aggregation complete!');

  return {
    aggregation,
    stats: {
      emailsFetched: emails.length,
      articlesProcessed: totalArticles,
      articlesAfterDedup: articles.length,
      themesDetected: themesResult.themes.length,
    },
  };
}

/**
 * Run weekly aggregation (last 7 days)
 */
export async function runWeeklyAggregation(
  onProgress?: (progress: AggregationProgress) => void
): Promise<AggregationResult> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 7);

  return runAggregationPipeline(startDate, endDate, onProgress);
}

/**
 * Format insights into a readable string
 */
function formatInsights(insights: {
  themes: { name: string; description: string; articleCount: number }[];
  mainInsight: string;
  trends: string[];
}): string {
  let result = `**Main Insight:** ${insights.mainInsight}\n\n`;

  if (insights.themes.length > 0) {
    result += '**Key Themes:**\n';
    for (const theme of insights.themes) {
      result += `- **${theme.name}** (${theme.articleCount} articles): ${theme.description}\n`;
    }
    result += '\n';
  }

  if (insights.trends.length > 0) {
    result += '**Emerging Trends:**\n';
    for (const trend of insights.trends) {
      result += `- ${trend}\n`;
    }
  }

  return result;
}
