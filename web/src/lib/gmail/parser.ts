import { GmailMessage } from './service';
import { insertArticle, articleExistsByUrl } from '../db';
import { parserRegistry, ArticleCandidate, normalizeUrl, deduplicateCandidatesByUrl } from '../parsers';

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
 * Process multiple newsletter messages and save unique articles to database.
 * Applies URL canonicalization and deduplication before saving.
 */
export async function processNewsletters(messages: GmailMessage[]): Promise<{
  processed: number;
  saved: number;
  skipped: number;
  deduped: number;
}> {
  // Collect all candidates from all messages
  const allCandidates: ArticleCandidate[] = [];

  for (const message of messages) {
    const matchResult = parserRegistry.findParser(message.from);

    if (!matchResult.matched || !matchResult.parser) {
      console.log(`[Parser] No parser found for sender: ${message.from}`);
      continue;
    }

    console.log(`[Parser] Using ${matchResult.parser.displayName} parser (match: ${matchResult.matchType})`);
    const parsed = matchResult.parser.parse(message);
    console.log(`[Parser] ${matchResult.parser.source}: extracted ${parsed.candidates.length} candidates`);

    // Add published_at to candidates for later use
    for (const candidate of parsed.candidates) {
      allCandidates.push({
        ...candidate,
        newsletter_date: parsed.published_at,
      });
    }
  }

  const totalExtracted = allCandidates.length;

  // Deduplicate by canonical URL before saving
  const uniqueCandidates = deduplicateCandidatesByUrl(allCandidates);
  const dedupedCount = totalExtracted - uniqueCandidates.length;

  console.log(`[Parser] Deduplicated ${dedupedCount} candidates (${totalExtracted} → ${uniqueCandidates.length})`);

  let saved = 0;
  let skipped = 0;

  for (const candidate of uniqueCandidates) {
    // Use canonical URL for duplicate checking
    const canonicalUrl = candidate.url ? normalizeUrl(candidate.url) : '';
    const originalUrl = candidate.url || '';

    // Check both original and canonical URL
    if (originalUrl && articleExistsByUrl(originalUrl)) {
      skipped++;
      continue;
    }
    if (canonicalUrl && canonicalUrl !== originalUrl && articleExistsByUrl(canonicalUrl)) {
      skipped++;
      continue;
    }

    // Get the newsletter date
    const newsletterDate = candidate.newsletter_date || new Date().toISOString().split('T')[0];

    insertArticle({
      title: candidate.title,
      summary: candidate.summary,
      source_url: originalUrl || canonicalUrl,
      reading_time: candidate.reading_time || null,
      newsletter_date: newsletterDate,
      // Note: content field exists in schema for inline articles
    });
    saved++;
  }

  return {
    processed: totalExtracted,
    saved,
    skipped,
    deduped: dedupedCount,
  };
}
