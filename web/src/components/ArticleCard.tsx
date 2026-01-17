'use client';

interface Article {
  id: number;
  title: string;
  summary: string;
  source_url: string;
  newsletter_date: string;
  feedback: { isRelevant: boolean } | null;
}

interface ArticleCardProps {
  article: Article;
  onFeedback: (articleId: number, isRelevant: boolean) => void;
}

export default function ArticleCard({ article, onFeedback }: ArticleCardProps) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <div className="bg-white rounded-xl shadow-sm border p-6 hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1">
          <a
            href={article.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-lg font-semibold text-gray-900 hover:text-blue-600 transition-colors"
          >
            {article.title}
            <span className="ml-2 text-gray-400">↗</span>
          </a>

          <p className="text-gray-600 mt-2 line-clamp-3">{article.summary}</p>

          <div className="mt-3 text-sm text-gray-400">
            {formatDate(article.newsletter_date)}
          </div>
        </div>

        {/* Feedback Buttons */}
        <div className="flex flex-col gap-2">
          <button
            onClick={() => onFeedback(article.id, true)}
            className={`p-2 rounded-lg transition-colors ${
              article.feedback?.isRelevant === true
                ? 'bg-green-100 text-green-600'
                : 'bg-gray-100 text-gray-400 hover:bg-green-50 hover:text-green-600'
            }`}
            title="Mark as relevant"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M2 10.5a1.5 1.5 0 113 0v6a1.5 1.5 0 01-3 0v-6zM6 10.333v5.43a2 2 0 001.106 1.79l.05.025A4 4 0 008.943 18h5.416a2 2 0 001.962-1.608l1.2-6A2 2 0 0015.56 8H12V4a2 2 0 00-2-2 1 1 0 00-1 1v.667a4 4 0 01-.8 2.4L6.8 7.933a4 4 0 00-.8 2.4z" />
            </svg>
          </button>

          <button
            onClick={() => onFeedback(article.id, false)}
            className={`p-2 rounded-lg transition-colors ${
              article.feedback?.isRelevant === false
                ? 'bg-red-100 text-red-600'
                : 'bg-gray-100 text-gray-400 hover:bg-red-50 hover:text-red-600'
            }`}
            title="Mark as not relevant"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path d="M18 9.5a1.5 1.5 0 11-3 0v-6a1.5 1.5 0 013 0v6zM14 9.667v-5.43a2 2 0 00-1.105-1.79l-.05-.025A4 4 0 0011.055 2H5.64a2 2 0 00-1.962 1.608l-1.2 6A2 2 0 004.44 12H8v4a2 2 0 002 2 1 1 0 001-1v-.667a4 4 0 01.8-2.4l1.4-1.866a4 4 0 00.8-2.4z" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
