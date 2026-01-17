import { GmailMessage } from '../gmail/service';
import { NewsletterParser, ParsedNewsletter, ArticleCandidate } from './types';

/**
 * TL;DR Newsletter Section Types
 */
const TLDR_SECTIONS = [
  'Headlines & Launches',
  'Deep Dives & Analysis',
  'Engineering & Resources',
  'Quick Links',
  'Big Tech & Startups',
  'Science & Futuristic Technology',
  'Programming, Design & Data Science',
  'Miscellaneous',
  'Opinions & Tutorials',
  'Launches & Tools',
  'Articles & Tutorials',
  'News & Trends',
];

/**
 * Parser for TL;DR Newsletter emails.
 * Extracts articles from tracking.tldrnewsletter.com links.
 */
export class TLDRParser implements NewsletterParser {
  readonly source = 'tldr';
  readonly displayName = 'TL;DR Newsletter';

  parse(message: GmailMessage): ParsedNewsletter {
    const htmlContent = message.htmlBody || message.textBody;
    const publishedAt = this.parseEmailDate(message.date);

    if (!htmlContent) {
      return {
        newsletter_source: this.source,
        email_subject: message.subject,
        published_at: publishedAt,
        candidates: [],
      };
    }

    const candidates = this.extractArticles(htmlContent, publishedAt);

    return {
      newsletter_source: this.source,
      email_subject: message.subject,
      published_at: publishedAt,
      candidates,
    };
  }

  private parseEmailDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      return date.toISOString().split('T')[0];
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  }

  private extractArticles(html: string, newsletterDate: string): ArticleCandidate[] {
    const articles: ArticleCandidate[] = [];

    // Clean HTML but preserve structure
    let cleanHtml = html
      .replace(/<!--[\s\S]*?-->/g, '')
      .replace(/<script[\s\S]*?<\/script>/gi, '')
      .replace(/<style[\s\S]*?<\/style>/gi, '');

    // Pattern to find tracking links
    const tldrLinkPattern = /<a[^>]*href=["'](https?:\/\/tracking\.tldrnewsletter\.com[^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi;

    const linkMatches: Array<{
      url: string;
      rawContent: string;
      position: number;
      endPosition: number;
    }> = [];

    let match;
    while ((match = tldrLinkPattern.exec(cleanHtml)) !== null) {
      const url = match[1];
      const rawContent = match[2];
      const textContent = this.stripHtml(rawContent).trim();

      if (this.isValidArticleTitle(textContent)) {
        linkMatches.push({
          url,
          rawContent: textContent,
          position: match.index,
          endPosition: match.index + match[0].length,
        });
      }
    }

    console.log(`[TLDRParser] Found ${linkMatches.length} potential article links`);

    // For each valid link, extract title, reading time, and description
    for (let i = 0; i < linkMatches.length; i++) {
      const current = linkMatches[i];
      const nextPosition = linkMatches[i + 1]?.position || cleanHtml.length;

      // Parse title and reading time from link text
      const titleMatch = current.rawContent.match(/^(.+?)\s*\((\d+)\s*min(?:ute)?\s*read\)\s*$/i);

      let title: string;
      let readingTime: string | undefined;

      if (titleMatch) {
        title = titleMatch[1].trim();
        readingTime = `${titleMatch[2]} min read`;
      } else {
        title = current.rawContent;
        readingTime = undefined;
      }

      // Get HTML between this link and next link for description
      const afterLinkHtml = cleanHtml.substring(current.endPosition, nextPosition);
      const description = this.extractDescription(afterLinkHtml);

      // Find section
      const section = this.findSection(cleanHtml, current.position);

      // Only add if we have a meaningful title and description
      if (title.length > 10 && description.length > 20) {
        articles.push({
          title,
          url: current.url,
          summary: description,
          source_name: this.displayName,
          extraction_method: 'email_links',
          reading_time: readingTime,
          section,
        });
      }
    }

    console.log(`[TLDRParser] Parsed ${articles.length} articles`);

    // Deduplicate by URL
    return this.deduplicateByUrl(articles);
  }

  private deduplicateByUrl(articles: ArticleCandidate[]): ArticleCandidate[] {
    const seen = new Set<string>();
    return articles.filter(article => {
      if (!article.url) return true;
      const normalizedUrl = this.normalizeTrackingUrl(article.url);
      if (seen.has(normalizedUrl)) {
        return false;
      }
      seen.add(normalizedUrl);
      return true;
    });
  }

  private normalizeTrackingUrl(url: string): string {
    const encodedMatch = url.match(/https?%3A%2F%2F[^/]+/i);
    if (encodedMatch) {
      return decodeURIComponent(encodedMatch[0]).toLowerCase();
    }
    return url.toLowerCase();
  }

  private stripHtml(html: string): string {
    return html
      .replace(/<[^>]+>/g, '')
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\r?\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  private findSection(html: string, position: number): string | undefined {
    const beforeHtml = html.substring(0, position);

    for (const section of TLDR_SECTIONS) {
      const pattern = new RegExp(this.escapeRegex(section), 'gi');
      if (pattern.test(beforeHtml)) {
        const lastIndex = beforeHtml.toLowerCase().lastIndexOf(section.toLowerCase());
        if (lastIndex !== -1) {
          return section;
        }
      }
    }

    return undefined;
  }

  private escapeRegex(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private extractDescription(html: string): string {
    // Try to find span with the description
    const spanMatch = html.match(/<span[^>]*style="[^"]*font-family[^"]*"[^>]*>([\s\S]*?)<\/span>/i);
    if (spanMatch) {
      const text = this.stripHtml(spanMatch[1]);
      if (text.length > 20) {
        return this.truncateText(text, 500);
      }
    }

    // Fallback: strip all HTML and take the first chunk of text
    let text = this.stripHtml(html);

    text = text
      .replace(/\[sponsor\]/gi, '')
      .replace(/sponsor/gi, '')
      .replace(/^\s*[,.\-–—]+\s*/, '')
      .trim();

    return this.truncateText(text, 500);
  }

  private truncateText(text: string, maxLength: number): string {
    if (text.length <= maxLength) return text;

    const truncated = text.substring(0, maxLength);
    const lastPeriod = truncated.lastIndexOf('.');
    if (lastPeriod > maxLength * 0.6) {
      return truncated.substring(0, lastPeriod + 1);
    }
    return truncated.trim() + '...';
  }

  private isValidArticleTitle(title: string): boolean {
    if (title.length < 10 || title.length > 300) {
      return false;
    }

    const invalidPatterns = [
      /^sign up$/i,
      /^advertise$/i,
      /^view online$/i,
      /^read more$/i,
      /^click here$/i,
      /^subscribe$/i,
      /^unsubscribe$/i,
      /^view in browser$/i,
      /^sponsor$/i,
      /^advertisement$/i,
      /^ad$/i,
      /^\d+$/,
      /^tldr$/i,
      /^share$/i,
      /^forward$/i,
      /^manage preferences$/i,
      /^privacy policy$/i,
      /^terms/i,
      /^together with/i,
      /\(sponsor\)/i,
      /^apply to/i,
      /^claim your/i,
      /early-stage startup/i,
      /free year/i,
      /free for/i,
    ];

    return !invalidPatterns.some(pattern => pattern.test(title.trim()));
  }
}

// Create and export singleton instance
export const tldrParser = new TLDRParser();
