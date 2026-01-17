import { GmailMessage } from './service';
import { insertArticle, articleExistsByUrl } from '../db';

export interface ParsedArticle {
  title: string;
  summary: string;
  sourceUrl: string;
  newsletterDate: string;
}

/**
 * Parse TL;DR newsletter HTML to extract individual articles.
 * TL;DR newsletters typically have a consistent structure with:
 * - Article titles as links
 * - Brief summaries below titles
 * - Sponsor markers to skip
 */
export function parseNewsletterContent(message: GmailMessage): ParsedArticle[] {
  const articles: ParsedArticle[] = [];
  const htmlContent = message.htmlBody || message.textBody;

  if (!htmlContent) {
    return articles;
  }

  // Parse the newsletter date from email headers
  const newsletterDate = parseEmailDate(message.date);

  // Try different parsing strategies based on newsletter format
  const parsedArticles = parseHtmlContent(htmlContent, newsletterDate);

  return parsedArticles;
}

function parseEmailDate(dateString: string): string {
  try {
    const date = new Date(dateString);
    return date.toISOString().split('T')[0]; // YYYY-MM-DD format
  } catch {
    return new Date().toISOString().split('T')[0];
  }
}

function parseHtmlContent(html: string, newsletterDate: string): ParsedArticle[] {
  const articles: ParsedArticle[] = [];

  // Remove HTML comments and scripts
  let cleanHtml = html
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');

  // TL;DR newsletters typically structure articles with:
  // 1. A headline link
  // 2. A short description
  // 3. Sometimes reading time or category tags

  // Strategy 1: Look for article blocks with links and descriptions
  // Common patterns in TL;DR newsletters

  // Match links with associated text content
  const linkPattern = /<a[^>]*href=["']([^"']+)["'][^>]*>([^<]+)<\/a>/gi;
  const matches: { url: string; title: string; position: number }[] = [];

  let match;
  while ((match = linkPattern.exec(cleanHtml)) !== null) {
    const url = match[1];
    const title = cleanText(match[2]);

    // Filter out navigation links, social links, and sponsor links
    if (isValidArticleUrl(url) && isValidTitle(title)) {
      matches.push({
        url,
        title,
        position: match.index,
      });
    }
  }

  // For each valid link, try to extract the surrounding summary text
  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const nextPosition = matches[i + 1]?.position || cleanHtml.length;

    // Extract text between current link and next link
    const sectionHtml = cleanHtml.substring(current.position, nextPosition);
    const summary = extractSummaryFromSection(sectionHtml, current.title);

    if (summary && summary.length > 20) {
      articles.push({
        title: current.title,
        summary: summary,
        sourceUrl: current.url,
        newsletterDate,
      });
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>();
  return articles.filter(article => {
    if (seen.has(article.sourceUrl)) {
      return false;
    }
    seen.add(article.sourceUrl);
    return true;
  });
}

function cleanText(text: string): string {
  return text
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function isValidArticleUrl(url: string): boolean {
  // Filter out common non-article URLs
  const invalidPatterns = [
    /^mailto:/i,
    /^javascript:/i,
    /^#/,
    /twitter\.com/i,
    /facebook\.com/i,
    /linkedin\.com\/share/i,
    /unsubscribe/i,
    /manage.*preferences/i,
    /view.*browser/i,
    /tldr\.tech\/?$/i, // TLDR homepage
    /tldrnewsletter\.com\/?$/i,
  ];

  return !invalidPatterns.some(pattern => pattern.test(url));
}

function isValidTitle(title: string): boolean {
  // Filter out common non-article titles
  if (title.length < 5 || title.length > 200) {
    return false;
  }

  const invalidTitles = [
    /^read more$/i,
    /^click here$/i,
    /^subscribe$/i,
    /^unsubscribe$/i,
    /^view in browser$/i,
    /^sponsor$/i,
    /^advertisement$/i,
    /^\d+$/,
    /^tldr$/i,
  ];

  return !invalidTitles.some(pattern => pattern.test(title));
}

function extractSummaryFromSection(html: string, titleToExclude: string): string {
  // Remove all HTML tags to get plain text
  let text = html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  // Clean up the text
  text = cleanText(text);

  // Remove the title from the text
  text = text.replace(titleToExclude, '').trim();

  // Remove common suffixes like "Read more", "(X minute read)", etc.
  text = text
    .replace(/\(\d+\s*min(ute)?s?\s*read\)/gi, '')
    .replace(/read\s*more\s*$/i, '')
    .replace(/continue\s*reading\s*$/i, '')
    .replace(/\[sponsor\]/gi, '')
    .trim();

  // Limit summary length
  if (text.length > 500) {
    text = text.substring(0, 500).trim();
    // Try to end at a sentence
    const lastPeriod = text.lastIndexOf('.');
    if (lastPeriod > 300) {
      text = text.substring(0, lastPeriod + 1);
    }
  }

  return text;
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
      // Check if article already exists
      if (articleExistsByUrl(article.sourceUrl)) {
        skipped++;
        continue;
      }

      // Save to database
      insertArticle({
        title: article.title,
        summary: article.summary,
        source_url: article.sourceUrl,
        newsletter_date: article.newsletterDate,
      });
      saved++;
    }
  }

  return { processed, saved, skipped };
}
