import React, { useState, useEffect } from 'react'
import './App.css'
import dotenv from 'dotenv'

dotenv.config()
// Production-ready React component to send client JSON to an n8n webhook
// - Functional components and hooks
// - Async/await fetch to POST the entire client object
// - Loading spinner while request is in progress
// - Toast notifications for success / error

// NOTE: Replace this with your real webhook URL
const N8N_WEBHOOK_URL = process.env.INITIATE_URL

// Example hardcoded client list (requirement #1)
const CLIENTS = [
  {
    id: 'f21c0983-9229-4a0e-863c-4e32b3553ab5',
    name: 'Dhruvil Patel',
    phone_number: '919925017345',
    email: 'newtechinfosoft@gmail.com',
    last_visit: '12th September',
    details: null,
    update_call_summary: null,
    retell_call_id: null,
    status: 'pending',
    created_at: '2025-10-27T19:39:49.993097+00:00',
    updated_at: '2025-10-27T19:39:49.993097+00:00',
  },
  {
    id: 'aa2b3c44-1111-2222-3333-abcdefabcdef',
    name: 'Aarya Shah',
    phone_number: '919426589465',
    email: 'jane@example.com',
    last_visit: '1st October',
    details: 'VIP',
    update_call_summary: null,
    retell_call_id: null,
    status: 'pending',
    created_at: '2025-10-01T10:00:00+00:00',
    updated_at: '2025-10-01T10:00:00+00:00',
  },
]

function Toast({ toast }) {
  // Simple toast UI: appears bottom-right
  if (!toast || !toast.visible) return null
  return (
    <div className={`toast ${toast.type || 'info'}`} role="status" aria-live="polite">
      {toast.message}
    </div>
  )
}

function Spinner() {
  return <div className="spinner" aria-hidden="true"></div>
}

export default function App() {
  // Tracks whether a bulk send is in progress
  const [loading, setLoading] = useState(false)

  // Toast state: { visible, message, type }
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' })

  // Auto-dismiss toast after a short time
  useEffect(() => {
    if (!toast.visible) return
    const t = setTimeout(() => setToast((s) => ({ ...s, visible: false })), 3500)
    return () => clearTimeout(t)
  }, [toast.visible])

  // Sends full client JSON to the n8n webhook via POST
  // Uses async/await and proper error handling (requirement #3)
  // Sends the entire CLIENTS array in one POST to the webhook
  async function startAllCalls() {
    if (!N8N_WEBHOOK_URL || N8N_WEBHOOK_URL.includes('<your-n8n-domain>')) {
      setToast({ visible: true, message: 'Please configure N8N_WEBHOOK_URL in App.jsx', type: 'error' })
      return
    }

    setLoading(true)
    try {
      const res = await fetch(N8N_WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        // Send the full clients array as the POST body
        body: JSON.stringify(CLIENTS),
      })

      if (!res.ok) {
        // Try to get helpful error message from response body
        let errText
        try {
          const errJson = await res.json()
          errText = errJson?.message || JSON.stringify(errJson)
        } catch {
          // ignore JSON parse errors and try to read plain text
          errText = await res.text()
        }
        throw new Error(`Webhook error: ${res.status} ${res.statusText} ${errText}`)
      }

      // Success
      setToast({ visible: true, message: 'All calls initiated successfully', type: 'success' })
    } catch (err) {
      console.error('Failed to send webhook:', err)
      setToast({ visible: true, message: `Error: ${err.message}`, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="app-root">
      <header className="header">
        <h1>Calling Agent</h1>
        <p className="subtitle">Send client JSON to an n8n webhook when starting calls</p>
      </header>

      <main>
        <section className="clients-grid">
          {/* Minimal UI as requested: do not show client details, only a button */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <button
              className="btn btn-primary"
              onClick={startAllCalls}
              disabled={loading}
              aria-live="polite"
            >
              {loading ? (
                <>
                  <Spinner /> <span className="sr-only">Starting...</span>
                </>
              ) : (
                // Show number of clients being sent for clarity without exposing details
                `Start All Calls (${CLIENTS.length})`
              )}
            </button>
          </div>
        </section>
      </main>

      <Toast toast={toast} />
    </div>
  )
}
