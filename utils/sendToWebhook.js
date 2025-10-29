/*
 * sendToWebhook.js
 * Utility to POST a JSON payload to an n8n webhook (or any webhook URL) using axios.
 */

import axios from 'axios';

/**
 * Send payload to a webhook URL using POST JSON.
 * @param {string} url - Full webhook URL (including scheme)
 * @param {any} payload - JSON-serializable payload to send
 * @param {object} [opts] - Optional options: {timeoutMs}
 * @returns {Promise<object>} - axios response data
 */
export default async function sendToWebhook(url, payload, opts = {}) {
  if (!url) throw new Error('Webhook URL is required');

  const timeout = opts.timeoutMs || 10000; // 10s

  try {
    const resp = await axios.post(url, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout,
    });

    return resp.data;
  } catch (err) {
    // Wrap and rethrow a helpful error
    const message = err.response
      ? `Webhook request failed: ${err.response.status} ${err.response.statusText}`
      : `Webhook request failed: ${err.message}`;
    const e = new Error(message);
    e.original = err;
    throw e;
  }
}
