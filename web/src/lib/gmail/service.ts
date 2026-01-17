import { google, gmail_v1 } from 'googleapis';
import { getAuthenticatedClient } from './auth';

// Known TL;DR newsletter sender addresses
const TLDR_SENDERS = [
  'dan@tldrnewsletter.com',
  'tldr@tldrnewsletter.com',
  'hello@tldr.tech',
  'dan@tldr.tech',
];

export interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  date: string;
  htmlBody: string;
  textBody: string;
}

export async function getGmailService(): Promise<gmail_v1.Gmail> {
  const auth = await getAuthenticatedClient();
  return google.gmail({ version: 'v1', auth });
}

export async function fetchTLDREmails(startDate: Date, endDate: Date): Promise<GmailMessage[]> {
  const gmail = await getGmailService();

  // Build query for TL;DR emails within date range
  const senderQuery = TLDR_SENDERS.map(s => `from:${s}`).join(' OR ');
  const afterTimestamp = Math.floor(startDate.getTime() / 1000);
  const beforeTimestamp = Math.floor(endDate.getTime() / 1000);

  const query = `(${senderQuery}) after:${afterTimestamp} before:${beforeTimestamp}`;

  const messages: GmailMessage[] = [];
  let pageToken: string | undefined;

  do {
    const response = await gmail.users.messages.list({
      userId: 'me',
      q: query,
      maxResults: 100,
      pageToken,
    });

    if (response.data.messages) {
      for (const msg of response.data.messages) {
        if (msg.id) {
          const fullMessage = await fetchMessageDetails(gmail, msg.id);
          if (fullMessage) {
            messages.push(fullMessage);
          }
        }
      }
    }

    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return messages;
}

async function fetchMessageDetails(gmail: gmail_v1.Gmail, messageId: string): Promise<GmailMessage | null> {
  try {
    const response = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full',
    });

    const message = response.data;
    const headers = message.payload?.headers || [];

    const getHeader = (name: string): string => {
      const header = headers.find(h => h.name?.toLowerCase() === name.toLowerCase());
      return header?.value || '';
    };

    const subject = getHeader('Subject');
    const from = getHeader('From');
    const date = getHeader('Date');

    // Extract body content
    const { htmlBody, textBody } = extractBody(message.payload);

    return {
      id: messageId,
      threadId: message.threadId || '',
      subject,
      from,
      date,
      htmlBody,
      textBody,
    };
  } catch (error) {
    console.error(`Error fetching message ${messageId}:`, error);
    return null;
  }
}

function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): { htmlBody: string; textBody: string } {
  let htmlBody = '';
  let textBody = '';

  if (!payload) {
    return { htmlBody, textBody };
  }

  function processPartRecursive(part: gmail_v1.Schema$MessagePart) {
    const mimeType = part.mimeType || '';
    const body = part.body;

    if (body?.data) {
      const decoded = Buffer.from(body.data, 'base64').toString('utf-8');

      if (mimeType === 'text/html') {
        htmlBody = decoded;
      } else if (mimeType === 'text/plain') {
        textBody = decoded;
      }
    }

    // Process nested parts
    if (part.parts) {
      for (const subPart of part.parts) {
        processPartRecursive(subPart);
      }
    }
  }

  processPartRecursive(payload);

  return { htmlBody, textBody };
}

export async function testConnection(): Promise<{ success: boolean; email?: string; error?: string }> {
  try {
    const gmail = await getGmailService();
    const profile = await gmail.users.getProfile({ userId: 'me' });

    return {
      success: true,
      email: profile.data.emailAddress || undefined,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
