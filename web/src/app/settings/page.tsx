'use client';

import { useState, useEffect } from 'react';

interface AuthStatus {
  authenticated: boolean;
  expiresAt: string | null;
  email?: string;
}

export default function SettingsPage() {
  const [authStatus, setAuthStatus] = useState<AuthStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [loggingOut, setLoggingOut] = useState(false);

  useEffect(() => {
    checkAuthStatus();
  }, []);

  const checkAuthStatus = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/auth/status');
      const data = await res.json();
      setAuthStatus(data);
    } catch (error) {
      console.error('Failed to check auth status:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      setLoggingOut(true);
      await fetch('/api/auth/logout', { method: 'POST' });
      setAuthStatus({ authenticated: false, expiresAt: null });
    } catch (error) {
      console.error('Failed to logout:', error);
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-600 mt-1">Manage your connections and preferences</p>
      </div>

      {/* Gmail Connection */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Gmail Connection</h2>

        {loading ? (
          <div className="text-gray-500">Checking connection status...</div>
        ) : authStatus?.authenticated ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
              <div className="h-3 w-3 bg-green-500 rounded-full"></div>
              <div>
                <p className="font-medium text-green-800">Connected to Gmail</p>
                {authStatus.expiresAt && (
                  <p className="text-sm text-green-600">
                    Token valid until {new Date(authStatus.expiresAt).toLocaleString()}
                  </p>
                )}
              </div>
            </div>

            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50 disabled:opacity-50 transition-colors"
            >
              {loggingOut ? 'Disconnecting...' : 'Disconnect Gmail'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-yellow-50 rounded-lg">
              <div className="h-3 w-3 bg-yellow-500 rounded-full"></div>
              <div>
                <p className="font-medium text-yellow-800">Not connected</p>
                <p className="text-sm text-yellow-600">
                  Connect your Gmail to fetch TL;DR newsletters
                </p>
              </div>
            </div>

            <a
              href="/api/auth/login"
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="h-5 w-5" viewBox="0 0 24 24">
                <path
                  fill="currentColor"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="currentColor"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="currentColor"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                />
                <path
                  fill="currentColor"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                />
              </svg>
              Connect Gmail
            </a>
          </div>
        )}
      </div>

      {/* Setup Instructions */}
      <div className="bg-white rounded-xl shadow-sm border p-6 mb-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Setup Required</h2>

        <div className="space-y-4 text-gray-600">
          <p>Before using the app, you need to configure the following:</p>

          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">1. Environment Variables</h3>
            <p className="text-sm mb-2">Create a <code className="bg-gray-200 px-1 rounded">.env.local</code> file in the web directory with:</p>
            <pre className="bg-gray-800 text-green-400 p-3 rounded text-sm overflow-x-auto">
{`OPENAI_API_KEY=your_openai_key
GOOGLE_CLIENT_ID=your_client_id
GOOGLE_CLIENT_SECRET=your_client_secret
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/callback`}
            </pre>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">2. Google Cloud Console</h3>
            <ol className="text-sm list-decimal list-inside space-y-1">
              <li>Go to Google Cloud Console</li>
              <li>Create a new project or select existing</li>
              <li>Enable the Gmail API</li>
              <li>Create OAuth 2.0 credentials (Web application)</li>
              <li>Add <code className="bg-gray-200 px-1 rounded">http://localhost:3000</code> to authorized origins</li>
              <li>Add <code className="bg-gray-200 px-1 rounded">http://localhost:3000/api/auth/callback</code> to redirect URIs</li>
            </ol>
          </div>

          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="font-medium text-gray-900 mb-2">3. OpenAI API Key</h3>
            <p className="text-sm">Get your API key from <a href="https://platform.openai.com/api-keys" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">OpenAI Platform</a></p>
          </div>
        </div>
      </div>

      {/* About */}
      <div className="bg-white rounded-xl shadow-sm border p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">About</h2>
        <p className="text-gray-600">
          Newsletter Aggregator helps you stay on top of your TL;DR newsletters by
          automatically fetching, summarizing, and organizing articles with AI-powered
          insights.
        </p>
        <p className="text-gray-500 text-sm mt-4">
          Version 1.0 - Local-first MVP
        </p>
      </div>
    </div>
  );
}
