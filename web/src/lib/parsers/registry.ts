import {
  NewsletterParser,
  ParserRegistration,
  ParserMatchResult,
  ParserLogContext
} from './types';

/**
 * Registry for newsletter parsers.
 * Handles routing emails to the correct parser based on sender address.
 */
class ParserRegistry {
  private registrations: ParserRegistration[] = [];

  /**
   * Register a parser with its matching patterns.
   */
  register(registration: ParserRegistration): void {
    // Normalize email patterns to lowercase
    const normalized: ParserRegistration = {
      ...registration,
      emailPatterns: registration.emailPatterns.map(e => e.toLowerCase()),
      domainPatterns: registration.domainPatterns?.map(d => d.toLowerCase()),
    };
    this.registrations.push(normalized);
    console.log(`[ParserRegistry] Registered parser: ${registration.parser.source} (${registration.emailPatterns.join(', ')})`);
  }

  /**
   * Find a parser for the given email "from" field.
   *
   * Matching strategy:
   * 1. Extract email address from "From" header (handles "Name <email>" format)
   * 2. Try exact match on email address
   * 3. Try domain match as fallback
   */
  findParser(fromHeader: string): ParserMatchResult {
    const emailAddress = this.extractEmailAddress(fromHeader).toLowerCase();
    const domain = this.extractDomain(emailAddress);

    // Try exact email match first
    for (const registration of this.registrations) {
      if (registration.emailPatterns.includes(emailAddress)) {
        return {
          matched: true,
          parser: registration.parser,
          source: registration.parser.source,
          matchType: 'exact_email',
        };
      }
    }

    // Try domain match as fallback
    for (const registration of this.registrations) {
      if (registration.domainPatterns?.includes(domain)) {
        return {
          matched: true,
          parser: registration.parser,
          source: registration.parser.source,
          matchType: 'domain',
        };
      }
    }

    // No match found
    return { matched: false };
  }

  /**
   * Get all registered parsers.
   */
  getAllParsers(): NewsletterParser[] {
    return this.registrations.map(r => r.parser);
  }

  /**
   * Get all registered email patterns (for Gmail query building).
   */
  getAllEmailPatterns(): string[] {
    return this.registrations.flatMap(r => r.emailPatterns);
  }

  /**
   * Check if any parser is registered.
   */
  hasRegistrations(): boolean {
    return this.registrations.length > 0;
  }

  /**
   * Create a log context for a parser operation.
   */
  createLogContext(
    messageId: string,
    from: string,
    subject: string,
    matchResult: ParserMatchResult,
    candidatesCount: number = 0,
    errors: string[] = []
  ): ParserLogContext {
    return {
      message_id: messageId,
      from,
      subject,
      newsletter_source: matchResult.source || null,
      parser_name: matchResult.parser?.displayName || null,
      candidates_extracted_count: candidatesCount,
      errors,
    };
  }

  /**
   * Extract email address from "From" header.
   * Handles formats like:
   * - "email@example.com"
   * - "Name <email@example.com>"
   * - "<email@example.com>"
   */
  private extractEmailAddress(fromHeader: string): string {
    // Try to extract from angle brackets
    const angleMatch = fromHeader.match(/<([^>]+)>/);
    if (angleMatch) {
      return angleMatch[1].trim();
    }

    // Otherwise assume it's just the email
    return fromHeader.trim();
  }

  /**
   * Extract domain from email address.
   */
  private extractDomain(email: string): string {
    const parts = email.split('@');
    return parts.length > 1 ? parts[1] : '';
  }
}

// Singleton instance
export const parserRegistry = new ParserRegistry();

// Re-export types for convenience
export * from './types';
