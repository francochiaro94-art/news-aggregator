import { GmailMessage } from '../gmail/service';

/**
 * Represents a single article candidate extracted from a newsletter.
 * Can be either a link-based article (to be scraped) or inline content.
 */
export interface ArticleCandidate {
  /** Article title (required, non-empty) */
  title: string;
  /** URL to the article (null for inline content like The Batch) */
  url: string | null;
  /** Brief summary or description */
  summary: string;
  /** Full content for inline articles (bypasses scraping) */
  content?: string;
  /** Source newsletter name (e.g., "TL;DR", "Not Boring", "6pages") */
  source_name: string;
  /** How the article was extracted */
  extraction_method: 'email_links' | 'email_inline';
  /** Whether the title was inferred (not explicitly in email) */
  title_inferred?: boolean;
  /** Reading time if available */
  reading_time?: string;
  /** Section within the newsletter (e.g., "Headlines", "Deep Dives") */
  section?: string;
  /** Date from the newsletter email (YYYY-MM-DD format) */
  newsletter_date?: string;
}

/**
 * Result of parsing a newsletter email.
 */
export interface ParsedNewsletter {
  /** Unique identifier for this newsletter source */
  newsletter_source: string;
  /** Original email subject */
  email_subject: string;
  /** When the email was published/sent */
  published_at: string;
  /** List of article candidates extracted */
  candidates: ArticleCandidate[];
}

/**
 * Interface that all newsletter parsers must implement.
 */
export interface NewsletterParser {
  /** Unique source identifier (e.g., "tldr", "notboring", "6pages") */
  readonly source: string;
  /** Human-readable name */
  readonly displayName: string;
  /** Parse a Gmail message and extract article candidates */
  parse(message: GmailMessage): ParsedNewsletter;
}

/**
 * Configuration for registering a parser in the registry.
 */
export interface ParserRegistration {
  /** The parser implementation */
  parser: NewsletterParser;
  /** Exact email addresses to match (e.g., "dan@tldrnewsletter.com") */
  emailPatterns: string[];
  /** Domain patterns for fallback matching (e.g., "tldrnewsletter.com") */
  domainPatterns?: string[];
}

/**
 * Result of attempting to match an email to a parser.
 */
export interface ParserMatchResult {
  /** Whether a parser was matched */
  matched: boolean;
  /** The matched parser (if any) */
  parser?: NewsletterParser;
  /** The newsletter source identifier (if matched) */
  source?: string;
  /** How the match was made */
  matchType?: 'exact_email' | 'domain';
}

/**
 * Logging context for parser operations.
 */
export interface ParserLogContext {
  message_id: string;
  from: string;
  subject: string;
  newsletter_source: string | null;
  parser_name: string | null;
  candidates_extracted_count: number;
  errors: string[];
}
