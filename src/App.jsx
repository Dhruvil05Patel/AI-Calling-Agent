import React, { useState, useEffect } from 'react'
import './App.css'
// Production-ready React component to send client JSON to an n8n webhook
// - Functional components and hooks
// - Async/await fetch to POST the entire client object
// - Loading spinner while request is in progress
// - Toast notifications for success / error

// Backend will be triggered via /api/start-calls; see server.js

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
  const [counter, setCounter] = useState({ total: 0, success: 0, lastRun: null, lastUpdate: null })

  // Toast state: { visible, message, type }
  const [toast, setToast] = useState({ visible: false, message: '', type: 'info' })

  // Auto-dismiss toast after a short time
  useEffect(() => {
    if (!toast.visible) return
    const t = setTimeout(() => setToast((s) => ({ ...s, visible: false })), 3500)
    return () => clearTimeout(t)
  }, [toast.visible])

  // Start backend process that runs db_fetch.js and initiates webhook POSTs
  async function startAllCalls() {
    setLoading(true)
    try {
      const res = await fetch('/api/start-calls', { method: 'POST' })
      if (!res.ok) throw new Error(`Failed to start calls: ${res.status}`)
      setToast({ visible: true, message: 'Started call run', type: 'success' })
    } catch (err) {
      console.error('Failed to start calls:', err)
      setToast({ visible: true, message: `Error: ${err.message}`, type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  // Poll counter from backend
  useEffect(() => {
    let stop = false
    async function poll() {
      try {
        const res = await fetch('/api/counter')
        if (res.ok) {
          const data = await res.json()
          if (!stop) setCounter(data)
        }
      } catch {}
    }
    poll()
    const id = setInterval(poll, 2000)
    return () => {
      stop = true
      clearInterval(id)
    }
  }, [])

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
                `Start All Calls (${counter.total || CLIENTS.length})`
              )}
            </button>
          </div>
          <div style={{ marginTop: 16, textAlign: 'center' }}>
            <p><strong>Completed:</strong> {counter.success} / {counter.total}</p>
          </div>
        </section>
      </main>

      <Toast toast={toast} />
    </div>
  )
}
