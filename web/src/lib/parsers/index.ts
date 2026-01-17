/**
 * Newsletter Parser Framework
 *
 * This module provides a modular parser registry for handling multiple newsletter formats.
 * Each newsletter source (TL;DR, Not Boring, 6pages, The Batch, etc.) has its own parser
 * that implements the NewsletterParser interface.
 *
 * To add a new newsletter:
 * 1. Create a new parser file (e.g., newparser.ts) implementing NewsletterParser
 * 2. Register it in this file using parserRegistry.register()
 */

import { parserRegistry } from './registry';
import { tldrParser } from './tldr';

// Register TL;DR parser
parserRegistry.register({
  parser: tldrParser,
  emailPatterns: [
    'dan@tldrnewsletter.com',
    'tldr@tldrnewsletter.com',
    'hello@tldr.tech',
    'dan@tldr.tech',
  ],
  domainPatterns: [
    'tldrnewsletter.com',
    'tldr.tech',
  ],
});

// Future parsers will be registered here:
// parserRegistry.register({
//   parser: notBoringParser,
//   emailPatterns: ['notboring@substack.com'],
//   domainPatterns: ['substack.com'], // Be careful with broad domain patterns
// });

// Export the registry and types
export { parserRegistry } from './registry';
export * from './types';
export { tldrParser } from './tldr';

// Export URL canonicalization utilities
export {
  canonicalizeUrl,
  resolveTrackingUrl,
  normalizeUrl,
  deduplicateCandidatesByUrl,
  addCanonicalUrls,
} from './canonicalize';
