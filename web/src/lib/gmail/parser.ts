import { GmailMessage } from './service';
import { insertArticle, articleExistsByUrl } from '../db';
import { parserRegistry, ArticleCandidate } from '../parsers';

/**
 * Legacy interface for backward compatibility.
 * New code should use ArticleCandidate from parsers module.
 */
export interface ParsedArticle {
  title: string;
  summary: string;
  sourceUrl: string;
  newsletterDate: string;
  readingTime?: string;
  section?: string;
  /** For inline content (e.g., The Batch) */
  content?: string;
  /** Source newsletter name */
  sourceName?: string;
}

/**
 * Parse newsletter content using the appropriate parser from the registry.
 * Falls back gracefully if no parser is found for the sender.
 */
export function parseNewsletterContent(message: GmailMessage): ParsedArticle[] {
  // Find the appropriate parser
  const matchResult = parserRegistry.findParser(message.from);

  if (!matchResult.matched || !matchResult.parser) {
    console.log(`[Parser] No parser found for sender: ${message.from}`);
    return [];
  }

  console.log(`[Parser] Using ${matchResult.parser.displayName} parser (match: ${matchResult.matchType})`);

  // Parse the message
  const parsed = matchResult.parser.parse(message);

  console.log(`[Parser] ${matchResult.parser.source}: extracted ${parsed.candidates.length} candidates`);

  // Convert ArticleCandidate to ParsedArticle for backward compatibility
  return parsed.candidates.map(candidate => convertToLegacyFormat(candidate, parsed.published_at));
}

/**
 * Convert ArticleCandidate to legacy ParsedArticle format.
 */
function convertToLegacyFormat(candidate: ArticleCandidate, publishedAt: string): ParsedArticle {
  return {
    title: candidate.title,
    summary: candidate.summary,
    sourceUrl: candidate.url || '',
    newsletterDate: publishedAt,
    readingTime: candidate.reading_time,
    section: candidate.section,
    content: candidate.content,
    sourceName: candidate.source_name,
  };
}

/**
 * Process multiple newsletter messages and save unique articles to database
 */
export async function processNewsletters(messages: GmailMessage[]): Promise<{
  processed: number;
  saved: number;
  skipped: number;
}> {
  let processed = 0;
  let saved = 0;
  let skipped = 0;

  for (const message of messages) {
    const articles = parseNewsletterContent(message);
    processed += articles.length;

    for (const article of articles) {
      if (articleExistsByUrl(article.sourceUrl)) {
        skipped++;
        continue;
      }

      insertArticle({
        title: article.title,
        summary: article.summary,
        source_url: article.sourceUrl,
        reading_time: article.readingTime || null,
        newsletter_date: article.newsletterDate,
      });
      saved++;
    }
  }

  return { processed, saved, skipped };
}
