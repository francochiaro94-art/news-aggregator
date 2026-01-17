import { ArticleCandidate } from './types';

/**
 * Common tracking parameters to remove from URLs.
 */
const TRACKING_PARAMS = [
  // UTM parameters
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'utm_cid',
  // Mailchimp
  'mc_cid',
  'mc_eid',
  // Generic tracking
  'ref',
  'ref_src',
  'ref_url',
  'referrer',
  // Social
  'fbclid',
  'gclid',
  'gclsrc',
  'dclid',
  'msclkid',
  'twclid',
  // Newsletter specific
  'email',
  'subscriber_id',
  'mkt_tok',
  's', // generic tracking param
  'source',
  'campaign',
  // Analytics
  '_ga',
  '_gl',
  '_hsenc',
  '_hsmi',
  'hsa_acc',
  'hsa_cam',
  'hsa_grp',
  'hsa_ad',
  'hsa_src',
  'hsa_tgt',
  'hsa_kw',
  'hsa_mt',
  'hsa_net',
  'hsa_ver',
];

/**
 * Canonicalize a URL by removing tracking parameters and normalizing format.
 *
 * Steps:
 * 1. Parse the URL
 * 2. Normalize protocol to https (upgrade http)
 * 3. Normalize hostname to lowercase
 * 4. Remove tracking parameters
 * 5. Remove URL fragments (hash)
 * 6. Sort remaining query parameters for consistency
 *
 * @param url The URL to canonicalize
 * @returns The canonical URL, or the original if parsing fails
 */
export function canonicalizeUrl(url: string): string {
  if (!url) return url;

  try {
    const parsed = new URL(url);

    // Normalize protocol (upgrade http to https)
    parsed.protocol = 'https:';

    // Normalize hostname to lowercase
    parsed.hostname = parsed.hostname.toLowerCase();

    // Remove tracking parameters
    const paramsToDelete: string[] = [];
    parsed.searchParams.forEach((_, key) => {
      const lowerKey = key.toLowerCase();
      if (
        TRACKING_PARAMS.includes(lowerKey) ||
        lowerKey.startsWith('utm_') ||
        lowerKey.startsWith('mc_') ||
        lowerKey.startsWith('hsa_')
      ) {
        paramsToDelete.push(key);
      }
    });

    for (const param of paramsToDelete) {
      parsed.searchParams.delete(param);
    }

    // Sort remaining parameters for consistency
    parsed.searchParams.sort();

    // Remove fragment (hash) - it's usually not significant for article identity
    parsed.hash = '';

    // Remove trailing slash from pathname (normalize)
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith('/')) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }

    return parsed.toString();
  } catch {
    // If URL parsing fails, return original
    console.warn(`[Canonicalize] Failed to parse URL: ${url}`);
    return url;
  }
}

/**
 * Resolve tracking redirect URLs to their final destination.
 * Handles common newsletter tracking URL patterns.
 *
 * @param url The potentially redirecting URL
 * @returns The resolved URL (may still be a tracking URL if pattern unknown)
 */
export function resolveTrackingUrl(url: string): string {
  if (!url) return url;

  try {
    const parsed = new URL(url);

    // TL;DR tracking URLs contain the destination encoded in the path or query
    if (parsed.hostname === 'tracking.tldrnewsletter.com') {
      // Try to extract from URL path (encoded)
      const pathMatch = url.match(/https?%3A%2F%2F[^&\s]+/i);
      if (pathMatch) {
        try {
          return decodeURIComponent(pathMatch[0]);
        } catch {
          // Fall through
        }
      }
    }

    // Substack tracking URLs
    if (parsed.hostname.includes('substack.com') && parsed.pathname.includes('/redirect')) {
      const target = parsed.searchParams.get('url') || parsed.searchParams.get('r');
      if (target) {
        try {
          return decodeURIComponent(target);
        } catch {
          return target;
        }
      }
    }

    // Generic redirect patterns - check for common query params
    const redirectParams = ['url', 'redirect', 'target', 'destination', 'goto', 'link'];
    for (const param of redirectParams) {
      const value = parsed.searchParams.get(param);
      if (value && value.startsWith('http')) {
        try {
          return decodeURIComponent(value);
        } catch {
          return value;
        }
      }
    }

    return url;
  } catch {
    return url;
  }
}

/**
 * Full URL normalization: resolve tracking redirects then canonicalize.
 *
 * @param url The URL to normalize
 * @returns The normalized canonical URL
 */
export function normalizeUrl(url: string): string {
  if (!url) return url;

  // First resolve any tracking redirects
  const resolved = resolveTrackingUrl(url);

  // Then canonicalize
  return canonicalizeUrl(resolved);
}

/**
 * Deduplicate article candidates by canonical URL.
 * When duplicates are found, prefer:
 * 1. Non-inferred titles over inferred
 * 2. Longer titles (more descriptive)
 * 3. Candidates with content over those without
 *
 * @param candidates The candidates to deduplicate
 * @returns Deduplicated candidates
 */
export function deduplicateCandidatesByUrl(candidates: ArticleCandidate[]): ArticleCandidate[] {
  const urlMap = new Map<string, ArticleCandidate>();

  for (const candidate of candidates) {
    // Skip inline candidates without URLs
    if (!candidate.url) {
      // For inline content, use title as a rough dedup key
      const key = `inline:${candidate.title.toLowerCase().trim()}`;
      if (!urlMap.has(key)) {
        urlMap.set(key, candidate);
      }
      continue;
    }

    const canonicalUrl = normalizeUrl(candidate.url);

    if (!urlMap.has(canonicalUrl)) {
      urlMap.set(canonicalUrl, candidate);
    } else {
      // Compare and keep the better candidate
      const existing = urlMap.get(canonicalUrl)!;
      if (isBetterCandidate(candidate, existing)) {
        urlMap.set(canonicalUrl, candidate);
      }
    }
  }

  return Array.from(urlMap.values());
}

/**
 * Determine if candidate A is "better" than candidate B.
 */
function isBetterCandidate(a: ArticleCandidate, b: ArticleCandidate): boolean {
  // Prefer non-inferred titles
  if (!a.title_inferred && b.title_inferred) return true;
  if (a.title_inferred && !b.title_inferred) return false;

  // Prefer candidates with content
  if (a.content && !b.content) return true;
  if (!a.content && b.content) return false;

  // Prefer longer (more descriptive) titles
  if (a.title.length > b.title.length) return true;

  // Prefer longer summaries
  if (a.summary.length > b.summary.length) return true;

  return false;
}

/**
 * Add canonical_url field to candidates.
 * Returns new array with canonical URLs populated.
 */
export function addCanonicalUrls(candidates: ArticleCandidate[]): (ArticleCandidate & { canonical_url?: string })[] {
  return candidates.map(candidate => ({
    ...candidate,
    canonical_url: candidate.url ? normalizeUrl(candidate.url) : undefined,
  }));
}
