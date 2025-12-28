"use client";

import { FormEvent, useCallback, useMemo, useState } from 'react';
import styles from '../styles/Home.module.css';

type Log = {
  action: string;
  status: string;
  timestamp: string;
  payload: any;
};

const defaultLog: Log = {
  action: 'idle',
  status: 'idle',
  timestamp: '',
  payload: 'Awaiting commands...',
};

const defaultSettings = {
  apiBase: 'http://localhost:8000',
  authToken: '',
};

type Settings = typeof defaultSettings;

type ApiRequestOptions = {
  method?: 'GET' | 'POST' | 'DELETE';
  path: string;
  query?: Record<string, string | boolean | undefined>;
  body?: Record<string, unknown>;
};

const extractMessages = (payload: unknown): any[] => {
  if (Array.isArray(payload)) {
    return payload;
  }
  if (!payload || typeof payload !== 'object') {
    return [];
  }
  const candidateKeys = ['messages', 'data', 'results'];
  for (const key of candidateKeys) {
    const value = (payload as Record<string, unknown>)[key];
    if (Array.isArray(value)) {
      return value;
    }
  }
  return [];
};

const formatMessageTimestamp = (value?: string) => {
  if (!value) {
    return '—';
  }
  const parsed = Date.parse(value);
  if (Number.isNaN(parsed)) {
    return value;
  }
  return new Date(parsed).toLocaleString('en-US');
};

export default function Home() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [log, setLog] = useState<Log>(defaultLog);
  const [messages, setMessages] = useState<any[]>([]);

  const headers = useMemo(() => {
    const token = settings.authToken.trim();
    const base: Record<string, string> = { 'Content-Type': 'application/json' };
    if (token) {
      base.Authorization = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
    }
    return base;
  }, [settings.authToken]);

  const buildUrl = useCallback((path: string, query?: Record<string, any>) => {
    const origin = typeof window !== 'undefined' ? window.location.origin : '';
    const base = settings.apiBase.trim() || origin;
    const normalized = base.endsWith('/') ? base : `${base}/`;
    const url = new URL(path.replace(/^\/+/, ''), normalized);
    if (query) {
      Object.entries(query).forEach(([key, value]) => {
        if (value === undefined || value === null || value === '') {
          return;
        }
        url.searchParams.set(key, String(value));
      });
    }
    return url;
  }, [settings.apiBase]);

  const apiRequest = useCallback(async ({ method = 'GET', path, query, body }: ApiRequestOptions) => {
    const url = buildUrl(path, query);
    const response = await fetch(url.toString(), {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const text = await response.text();
    let payload: any = text || null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch (error) {
      payload = text;
    }
    const statusText = `${response.status} ${response.ok ? 'OK' : 'ERROR'}`;
    setLog({
      action: `${method} ${path}`,
      status: statusText,
      timestamp: new Date().toISOString(),
      payload,
    });
    if (!response.ok) {
      throw new Error(payload?.message || payload || `HTTP ${response.status}`);
    }
    return payload;
  }, [buildUrl, headers]);

  const handleError = (action: string, error: unknown) => {
    setLog({
      action,
      status: 'ERROR',
      timestamp: new Date().toISOString(),
      payload: error instanceof Error ? error.message : error,
    });
  };

  const handleSettingsChange = (event: FormEvent<HTMLFormElement>) => {
    const data = new FormData(event.currentTarget);
    setSettings({
      apiBase: (data.get('apiBase') as string) || '',
      authToken: (data.get('authToken') as string) || '',
    });
  };

  const handleSendMessage = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const payload: Record<string, unknown> = {
      practice_id: (data.get('practice_id') as string || '').trim(),
      location_id: (data.get('location_id') as string || '').trim(),
      message: (data.get('message') as string || '').trim(),
      message_type: data.get('message_type') || 'text',
      is_private: data.get('is_private') === 'on',
    };
    const recipient = (data.get('recipient_user_id') as string | null)?.trim();
    if (recipient) {
      payload.recipient_user_id = recipient;
    }
    ['attachment_url', 'attachment_type'].forEach((field) => {
      const value = (data.get(field) as string | null)?.trim();
      if (value) {
        payload[field] = value;
      }
    });
    try {
      await apiRequest({ method: 'POST', path: '/location-users-chat/messages', body: payload });
    } catch (error) {
      handleError('POST /location-users-chat/messages', error);
    }
  };

  const handleListMessages = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const query: Record<string, string | undefined> = {
      location_id: (data.get('location_id') as string || '').trim() || undefined,
      practice_id: (data.get('practice_id') as string || '').trim() || undefined,
      user_id: (data.get('user_id') as string || '').trim() || undefined,
      recipient_user_id: (data.get('recipient_user_id') as string || '').trim() || undefined,
      limit: (data.get('limit') as string || '').trim() || undefined,
      include_deleted: data.get('include_deleted') ? 'true' : undefined,
      private_only: data.get('private_only') ? 'true' : undefined,
    };
    try {
      const payload = await apiRequest({ method: 'GET', path: '/location-users-chat/messages', query });
      setMessages(extractMessages(payload));
    } catch (error) {
      handleError('GET /location-users-chat/messages', error);
    }
  };

  const handleUnreadCounts = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const query = {
      location_id: (data.get('location_id') as string || '').trim() || undefined,
      practice_id: (data.get('practice_id') as string || '').trim() || undefined,
      participant_user_id: (data.get('participant_user_id') as string || '').trim() || undefined,
    };
    try {
      await apiRequest({ method: 'GET', path: '/location-users-chat/unread', query });
    } catch (error) {
      handleError('GET /location-users-chat/unread', error);
    }
  };

  const handleMarkRead = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const messageId = (data.get('message_id') as string || '').trim();
    if (!messageId) {
      handleError('POST /location-users-chat/messages/{id}/read', new Error('message id is required'));
      return;
    }
    try {
      await apiRequest({ method: 'POST', path: `/location-users-chat/messages/${messageId}/read`, body: {} });
    } catch (error) {
      handleError('POST /location-users-chat/messages/{id}/read', error);
    }
  };

  const handleDelete = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const messageId = (data.get('message_id') as string || '').trim();
    if (!messageId) {
      handleError('DELETE /location-users-chat/messages/{id}', new Error('message id is required'));
      return;
    }
    try {
      await apiRequest({ method: 'DELETE', path: `/location-users-chat/messages/${messageId}` });
    } catch (error) {
      handleError('DELETE /location-users-chat/messages/{id}', error);
    }
  };

  const handleLocationUsers = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const locationId = (data.get('location_id') as string || '').trim();
    if (!locationId) {
      handleError('GET /location-users-chat/locations/{id}/users', new Error('location id is required'));
      return;
    }
    try {
      await apiRequest({ method: 'GET', path: `/location-users-chat/locations/${locationId}/users` });
    } catch (error) {
      handleError('GET /location-users-chat/locations/{id}/users', error);
    }
  };

  const handlePracticeUsers = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const practiceId = (data.get('practice_id') as string || '').trim();
    if (!practiceId) {
      handleError('GET /location-users-chat/practices/{id}/users', new Error('practice id is required'));
      return;
    }
    try {
      await apiRequest({ method: 'GET', path: `/location-users-chat/practices/${practiceId}/users` });
    } catch (error) {
      handleError('GET /location-users-chat/practices/{id}/users', error);
    }
  };

  const formattedTimestamp = useMemo(() => {
    if (!log.timestamp) {
      return '—';
    }
    const parsed = new Date(log.timestamp);
    return Number.isNaN(parsed.getTime()) ? '—' : parsed.toLocaleString('en-US');
  }, [log.timestamp]);

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        <header className={styles.header}>
          <span className={styles.badge}>Playground</span>
          <h1 className={styles.title}>Location User Chat</h1>
          <p className={styles.lead}>
            Use this Next.js playground to hit the chat endpoints, inspect responses, and confirm the backend persists
            location_user_chat_logs whenever you trigger actions.
          </p>
        </header>

        <section className={styles.card}>
          <h2>Connection settings</h2>
          <form className={styles.formGrid} onChange={handleSettingsChange}>
            <label className={styles.label}>
              API base URL
              <input name="apiBase" type="url" defaultValue={settings.apiBase} placeholder="http://localhost:8000" />
            </label>
            <label className={styles.label}>
              Authorization
              <input name="authToken" type="text" defaultValue={settings.authToken} placeholder="Bearer eyJhbGciOi..." />
            </label>
            <p className={styles.helper}>Store whichever base URL and token keep you authenticated while you exercise the chat flows.</p>
          </form>
        </section>

        <section className={`${styles.card} ${styles.gridTwo}`}>
          <div>
            <h3>Send message</h3>
            <form className={styles.formGrid} onSubmit={handleSendMessage}>
              <label className={styles.label}>
                Practice ID
                <input name="practice_id" type="text" placeholder="practice uuid" />
              </label>
              <label className={styles.label}>
                Location ID
                <input name="location_id" type="text" placeholder="location uuid" />
              </label>
              <label className={styles.label}>
                Recipient (optional)
                <input name="recipient_user_id" type="text" placeholder="recipient uuid" />
              </label>
              <label className={styles.label}>
                Message type
                <select name="message_type" defaultValue="text">
                  <option value="text">Text</option>
                  <option value="attachment">Attachment</option>
                  <option value="system">System</option>
                </select>
              </label>
              <label className={styles.label}>
                Payload
                <textarea name="message" rows={3} placeholder="What are you sending?" />
              </label>
              <label className={styles.label}>
                Attachment URL (optional)
                <input name="attachment_url" type="url" placeholder="https://example.com/asset.png" />
              </label>
              <label className={styles.label}>
                Attachment type (optional)
                <input name="attachment_type" type="text" placeholder="image/png" />
              </label>
              <label className={styles.label}>
                Private conversation
                <input name="is_private" type="checkbox" />
              </label>
              <button type="submit">Send message</button>
            </form>
          </div>

          <div>
            <h3>List messages</h3>
            <form className={styles.formGrid} onSubmit={handleListMessages}>
              <label className={styles.label}>
                Location ID
                <input name="location_id" type="text" placeholder="location uuid" />
              </label>
              <label className={styles.label}>
                Practice ID
                <input name="practice_id" type="text" placeholder="practice uuid" />
              </label>
              <label className={styles.label}>
                User ID filter
                <input name="user_id" type="text" placeholder="user uuid" />
              </label>
              <label className={styles.label}>
                Recipient ID
                <input name="recipient_user_id" type="text" placeholder="recipient user uuid" />
              </label>
              <label className={styles.label}>
                Limit
                <input name="limit" type="number" min={1} defaultValue={20} />
              </label>
              <label className={styles.label}>
                Include deleted
                <input name="include_deleted" type="checkbox" />
              </label>
              <label className={styles.label}>
                Private only
                <input name="private_only" type="checkbox" />
              </label>
              <button type="submit">Fetch messages</button>
            </form>
          </div>
        </section>

        <section className={`${styles.card} ${styles.gridTwo}`}>
          <div>
            <h3>Unread counts</h3>
            <form className={styles.formGrid} onSubmit={handleUnreadCounts}>
              <label className={styles.label}>
                Location ID
                <input name="location_id" type="text" placeholder="location uuid" />
              </label>
              <label className={styles.label}>
                Practice ID
                <input name="practice_id" type="text" placeholder="practice uuid" />
              </label>
              <label className={styles.label}>
                Participant ID
                <input name="participant_user_id" type="text" placeholder="user uuid" />
              </label>
              <button type="submit">Get unread summary</button>
            </form>
          </div>
          <div className={styles.gridSegment}>
            <h3>Message lifecycle</h3>
            <form className={styles.formGrid} onSubmit={handleMarkRead}>
              <label className={styles.label}>
                Message ID
                <input name="message_id" type="text" placeholder="message uuid" />
              </label>
              <button type="submit">Mark as read</button>
            </form>
            <form className={styles.formGrid} onSubmit={handleDelete}>
              <label className={styles.label}>
                Message ID
                <input name="message_id" type="text" placeholder="message uuid" />
              </label>
              <button type="submit">Delete message</button>
            </form>
          </div>
        </section>

        <section className={`${styles.card} ${styles.gridTwo}`}>
          <div>
            <h3>Location users</h3>
            <form className={styles.formGrid} onSubmit={handleLocationUsers}>
              <label className={styles.label}>
                Location ID
                <input name="location_id" type="text" placeholder="location uuid" />
              </label>
              <button type="submit">List users</button>
            </form>
          </div>
          <div>
            <h3>Practice users</h3>
            <form className={styles.formGrid} onSubmit={handlePracticeUsers}>
              <label className={styles.label}>
                Practice ID
                <input name="practice_id" type="text" placeholder="practice uuid" />
              </label>
              <button type="submit">List users</button>
            </form>
          </div>
        </section>

        <section className={styles.card}>
          <h2>Messages</h2>
          {messages.length === 0 ? (
            <p className={styles.helper}>
              Fetch messages with the form above to browse what the API returned; the response console still logs every payload.
            </p>
          ) : (
            <div className={styles.messageList}>
              {messages.map((message, index) => {
                const author =
                  message?.sender_user_id ?? message?.user_id ?? message?.participant_user_id ?? 'system';
                const timestamp = formatMessageTimestamp(
                  message?.created_at ?? message?.timestamp ?? message?.sent_at
                );
                const content =
                  typeof message === 'string'
                    ? message
                    : message?.message ??
                      message?.body ??
                      (typeof message?.payload === 'string'
                        ? message.payload
                        : message?.payload
                        ? JSON.stringify(message.payload)
                        : JSON.stringify(message));
                return (
                  <article
                    className={styles.messageItem}
                    key={message?.id ?? message?.uuid ?? index}
                  >
                    <div className={styles.messageMeta}>
                      <span>{author}</span>
                      <span>{timestamp}</span>
                    </div>
                    <p className={styles.messageBody}>{content}</p>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className={styles.card}>
          <h2>Response console</h2>
          <div className={styles.responseMeta}>
            <div>
              Last call: <span className={styles.pill}>{log.action}</span>
            </div>
            <div>
              Status: <span className={styles.pill}>{log.status}</span>
            </div>
            <div>
              Time: <span className={styles.pill}>{formattedTimestamp}</span>
            </div>
          </div>
          <pre className={styles.console}>{JSON.stringify(log.payload, null, 2)}</pre>
        </section>
      </div>
    </div>
  );
}
