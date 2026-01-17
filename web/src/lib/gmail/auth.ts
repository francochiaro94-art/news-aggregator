import { google } from 'googleapis';
import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

const TOKEN_PATH = path.join(process.cwd(), 'data', 'gmail-token.enc');
const ENCRYPTION_KEY_PATH = path.join(process.cwd(), 'data', '.encryption-key');

// Scopes required for reading Gmail
const SCOPES = ['https://www.googleapis.com/auth/gmail.readonly'];

interface TokenData {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expiry_date: number;
}

function getEncryptionKey(): Buffer {
  const dataDir = path.dirname(ENCRYPTION_KEY_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (!fs.existsSync(ENCRYPTION_KEY_PATH)) {
    // Generate a new encryption key
    const key = crypto.randomBytes(32);
    fs.writeFileSync(ENCRYPTION_KEY_PATH, key.toString('hex'), { mode: 0o600 });
    return key;
  }

  return Buffer.from(fs.readFileSync(ENCRYPTION_KEY_PATH, 'utf-8'), 'hex');
}

function encryptToken(data: TokenData): string {
  const key = getEncryptionKey();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-cbc', key, iv);

  let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
  encrypted += cipher.final('hex');

  return iv.toString('hex') + ':' + encrypted;
}

function decryptToken(encryptedData: string): TokenData {
  const key = getEncryptionKey();
  const [ivHex, encrypted] = encryptedData.split(':');
  const iv = Buffer.from(ivHex, 'hex');

  const decipher = crypto.createDecipheriv('aes-256-cbc', key, iv);

  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return JSON.parse(decrypted);
}

export function getOAuth2Client() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const redirectUri = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/auth/callback';

  if (!clientId || !clientSecret) {
    throw new Error('Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET environment variables');
  }

  return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
}

export function getAuthUrl(): string {
  const oauth2Client = getOAuth2Client();

  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: SCOPES,
    prompt: 'consent', // Force consent to get refresh token
  });
}

export async function exchangeCodeForTokens(code: string): Promise<TokenData> {
  const oauth2Client = getOAuth2Client();

  const { tokens } = await oauth2Client.getToken(code);

  const tokenData: TokenData = {
    access_token: tokens.access_token!,
    refresh_token: tokens.refresh_token!,
    scope: tokens.scope!,
    token_type: tokens.token_type!,
    expiry_date: tokens.expiry_date!,
  };

  // Save encrypted token
  saveToken(tokenData);

  return tokenData;
}

export function saveToken(tokenData: TokenData): void {
  const dataDir = path.dirname(TOKEN_PATH);
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  const encrypted = encryptToken(tokenData);
  fs.writeFileSync(TOKEN_PATH, encrypted, { mode: 0o600 });
}

export function loadToken(): TokenData | null {
  if (!fs.existsSync(TOKEN_PATH)) {
    return null;
  }

  try {
    const encrypted = fs.readFileSync(TOKEN_PATH, 'utf-8');
    return decryptToken(encrypted);
  } catch {
    return null;
  }
}

export function deleteToken(): void {
  if (fs.existsSync(TOKEN_PATH)) {
    fs.unlinkSync(TOKEN_PATH);
  }
}

export function isAuthenticated(): boolean {
  const token = loadToken();
  return token !== null;
}

export async function getAuthenticatedClient() {
  const token = loadToken();

  if (!token) {
    throw new Error('Not authenticated. Please complete OAuth flow first.');
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials(token);

  // Check if token needs refresh
  if (token.expiry_date && token.expiry_date < Date.now()) {
    const { credentials } = await oauth2Client.refreshAccessToken();

    const newToken: TokenData = {
      access_token: credentials.access_token!,
      refresh_token: token.refresh_token, // Keep the original refresh token
      scope: credentials.scope!,
      token_type: credentials.token_type!,
      expiry_date: credentials.expiry_date!,
    };

    saveToken(newToken);
    oauth2Client.setCredentials(newToken);
  }

  return oauth2Client;
}
