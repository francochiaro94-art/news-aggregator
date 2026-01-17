import { createEmbeddings } from './client';
import { Article } from '../db';

const SIMILARITY_THRESHOLD = 0.85; // Articles above this similarity are considered duplicates

export interface DedupResult {
  uniqueArticles: Article[];
  duplicateGroups: Article[][];
  totalArticles: number;
  removedCount: number;
}

/**
 * Calculate cosine similarity between two embedding vectors
 */
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let normA = 0;
  let normB = 0;

  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }

  normA = Math.sqrt(normA);
  normB = Math.sqrt(normB);

  if (normA === 0 || normB === 0) {
    return 0;
  }

  return dotProduct / (normA * normB);
}

/**
 * De-duplicate articles using semantic similarity via OpenAI embeddings
 */
export async function deduplicateArticles(articles: Article[]): Promise<DedupResult> {
  if (articles.length <= 1) {
    return {
      uniqueArticles: articles,
      duplicateGroups: [],
      totalArticles: articles.length,
      removedCount: 0,
    };
  }

  // Create text representations for embedding
  const texts = articles.map(a => `${a.title}. ${a.summary}`);

  // Get embeddings for all articles
  const embeddings = await createEmbeddings(texts);

  // Find similar article pairs
  const similarityMatrix: number[][] = [];
  for (let i = 0; i < embeddings.length; i++) {
    similarityMatrix[i] = [];
    for (let j = 0; j < embeddings.length; j++) {
      if (i === j) {
        similarityMatrix[i][j] = 1;
      } else if (j < i) {
        similarityMatrix[i][j] = similarityMatrix[j][i];
      } else {
        similarityMatrix[i][j] = cosineSimilarity(embeddings[i], embeddings[j]);
      }
    }
  }

  // Group similar articles using union-find approach
  const parent: number[] = articles.map((_, i) => i);

  function find(i: number): number {
    if (parent[i] !== i) {
      parent[i] = find(parent[i]);
    }
    return parent[i];
  }

  function union(i: number, j: number): void {
    const pi = find(i);
    const pj = find(j);
    if (pi !== pj) {
      parent[pi] = pj;
    }
  }

  // Union articles that are similar
  for (let i = 0; i < articles.length; i++) {
    for (let j = i + 1; j < articles.length; j++) {
      if (similarityMatrix[i][j] >= SIMILARITY_THRESHOLD) {
        union(i, j);
      }
    }
  }

  // Group articles by their root parent
  const groups: Map<number, Article[]> = new Map();
  for (let i = 0; i < articles.length; i++) {
    const root = find(i);
    if (!groups.has(root)) {
      groups.set(root, []);
    }
    groups.get(root)!.push(articles[i]);
  }

  // Select representative from each group (prefer newer articles or longer summaries)
  const uniqueArticles: Article[] = [];
  const duplicateGroups: Article[][] = [];

  for (const group of groups.values()) {
    if (group.length === 1) {
      uniqueArticles.push(group[0]);
    } else {
      // Sort by date (newest first), then by summary length (longest first)
      group.sort((a, b) => {
        const dateCompare = new Date(b.newsletter_date).getTime() - new Date(a.newsletter_date).getTime();
        if (dateCompare !== 0) return dateCompare;
        return b.summary.length - a.summary.length;
      });

      // Take the first (best) article as representative
      uniqueArticles.push(group[0]);
      duplicateGroups.push(group);
    }
  }

  return {
    uniqueArticles,
    duplicateGroups,
    totalArticles: articles.length,
    removedCount: articles.length - uniqueArticles.length,
  };
}

/**
 * Quick de-duplication using exact URL matching (no API calls)
 */
export function quickDeduplicateByUrl(articles: Article[]): Article[] {
  const seen = new Set<string>();
  const unique: Article[] = [];

  for (const article of articles) {
    // Normalize URL for comparison
    const normalizedUrl = article.source_url
      .toLowerCase()
      .replace(/^https?:\/\//, '')
      .replace(/\/+$/, '')
      .replace(/\?.*$/, '');

    if (!seen.has(normalizedUrl)) {
      seen.add(normalizedUrl);
      unique.push(article);
    }
  }

  return unique;
}
