import React, { useEffect, useMemo, useState, useRef } from 'react';
import { sendChatMessage } from '../utils/chatApi';
// Try to import lucide icons if available; otherwise fall back to simple text/SVG
let PaperPlaneIcon = null;
let MessageSquare = null;
try {
  // eslint-disable-next-line import/no-extraneous-dependencies
  const lucide = require('lucide-react');
  PaperPlaneIcon = lucide.PaperPlane;
  MessageSquare = lucide.MessageSquare;
} catch (e) {
  /* ignore */
}

function formatDate(ts) {
  const d = new Date(ts || Date.now());
  return d.toLocaleString();
}

function buildDatasetSummary(datasets) {
  if (!datasets) return 'No datasets loaded.';
  try {
    const names = Object.keys(datasets || {});
    if (names.length === 0) return 'No datasets loaded.';
    const lines = [];
    for (const name of names) {
      const ds = datasets[name];
      const cols = ds?.columns || (ds?.data && ds.data[0] ? Object.keys(ds.data[0]) : []);
      const rowCount = ds?.data?.length ?? ds?.length ?? 'unknown';
      lines.push(`- ${name}: ${cols.length} columns, ~${rowCount} rows`);
      lines.push(`  columns: ${cols.slice(0, 10).join(', ')}${cols.length > 10 ? ', ...' : ''}`);
      // basic stats for numeric columns (first 3)
      const numericCols = cols.filter((c) => {
        const sample = (ds.data && ds.data[0] && ds.data[0][c]);
        return typeof sample === 'number';
      });
      const take = numericCols.slice(0, 3);
      if (take.length) {
        for (const c of take) {
          const vals = (ds.data || []).map((r) => Number(r[c])).filter((v) => !Number.isNaN(v));
          const mean = vals.reduce((a, b) => a + b, 0) / (vals.length || 1);
          lines.push(`  sample numeric '${c}': count=${vals.length}, mean=${(mean || 0).toFixed(2)}`);
        }
      }
    }
    return lines.join('\n');
  } catch (err) {
    return 'Could not summarize datasets.';
  }
}

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState(() => {
    try {
      const raw = localStorage.getItem('chat_messages');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [useMock, setUseMock] = useState(true);
  const listRef = useRef(null);

  const datasets = useMemo(() => {
    try {
      const raw = localStorage.getItem('datasets');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }, [messages]);

  const charts = useMemo(() => {
    try {
      const raw = localStorage.getItem('charts');
      return raw ? JSON.parse(raw) : null;
    } catch (e) {
      return null;
    }
  }, [messages]);

  const summary = useMemo(() => buildDatasetSummary(datasets), [datasets]);

  useEffect(() => {
    try {
      localStorage.setItem('chat_messages', JSON.stringify(messages));
    } catch (e) {
      // ignore
    }
    // scroll to bottom
    setTimeout(() => {
      if (listRef.current) listRef.current.scrollTop = listRef.current.scrollHeight;
    }, 50);
  }, [messages]);

  async function handleSend(text) {
    if (!text || !text.trim()) return;
    setError(null);
    const trimmed = text.trim();
    // local echo
    const userMsg = { id: Date.now() + Math.random(), role: 'user', text: trimmed, ts: Date.now() };
    setMessages((m) => [...m, userMsg]);
    setInput('');

    // commands
    if (trimmed === '/summary') {
      const bot = { id: Date.now() + Math.random(), role: 'bot', text: summary, ts: Date.now() };
      setMessages((m) => [...m, bot]);
      return;
    }

    setLoading(true);
    try {
      const resp = await sendChatMessage({ question: trimmed, summary, charts, datasets, useMock });
      const bot = { id: Date.now() + Math.random(), role: 'bot', text: resp.text || String(resp), ts: Date.now() };
      setMessages((m) => [...m, bot]);
    } catch (err) {
      console.error(err);
      setError(err.message || 'Unknown error');
      const bot = { id: Date.now() + Math.random(), role: 'bot', text: 'Error: ' + (err.message || 'Failed to get response'), ts: Date.now() };
      setMessages((m) => [...m, bot]);
    } finally {
      setLoading(false);
    }
  }

  function exportChat() {
    const text = messages.map((m) => `[${formatDate(m.ts)}] ${m.role.toUpperCase()}: ${m.text}`).join('\n\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tansam_chat_${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearChat() {
    setMessages([]);
    localStorage.removeItem('chat_messages');
  }

  return (
    <>
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end space-y-2">
        <button
          onClick={() => setOpen((o) => !o)}
          className="bg-indigo-600 hover:bg-indigo-700 text-white p-3 rounded-full shadow-lg flex items-center space-x-2"
          title="Toggle chat"
        >
          {MessageSquare ? <MessageSquare className="w-5 h-5" /> : <span>💬</span>}
        </button>
      </div>

      <div
        className={`fixed bottom-20 right-6 z-40 transition-transform duration-200 ${open ? 'translate-y-0' : 'translate-y-6 opacity-0 pointer-events-none'}`}
        style={{ width: 360 }}
      >
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800">
            <div className="flex items-center space-x-2">
              {MessageSquare ? <MessageSquare className="w-5 h-5 text-indigo-600" /> : <span>🤖</span>}
              <div>
                <div className="text-sm font-semibold">Data Assistant</div>
                <div className="text-xs text-slate-500">Ask about your datasets and charts</div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setUseMock((v) => !v)}
                className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200"
                title="Toggle mock API"
              >
                {useMock ? 'Mock' : 'Live'}
              </button>
              <button onClick={exportChat} className="text-xs px-2 py-1 rounded bg-slate-100 dark:bg-slate-800">
                Export
              </button>
              <button onClick={clearChat} className="text-xs px-2 py-1 rounded bg-rose-100 text-rose-600">
                Clear
              </button>
            </div>
          </div>

          <div ref={listRef} className="p-3 h-64 overflow-auto bg-slate-50 dark:bg-slate-950">
            {messages.length === 0 && <div className="text-xs text-slate-500">No messages yet. Type /summary for a quick dataset summary.</div>}
            {messages.map((m) => (
              <div key={m.id} className={`mb-3 flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`${m.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 border'} p-2 rounded-md max-w-[80%] shadow`}> 
                  <div className="text-xs text-slate-400 mb-1">{m.role === 'user' ? 'You' : 'Assistant'} • {formatDate(m.ts)}</div>
                  <div className="whitespace-pre-wrap text-sm">{m.text}</div>
                </div>
              </div>
            ))}
            {loading && <div className="text-sm text-slate-500">Assistant is typing...</div>}
            {error && <div className="text-sm text-rose-600">{error}</div>}
          </div>

          <div className="px-3 py-2 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
            <div className="flex items-center space-x-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSend(input);
                  }
                }}
                placeholder="Ask a question or type /summary"
                className="flex-1 px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm"
              />
              <button
                onClick={() => handleSend(input)}
                disabled={loading}
                className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded"
                title="Send"
              >
                {PaperPlaneIcon ? <PaperPlaneIcon className="w-4 h-4" /> : 'Send'}
              </button>
            </div>
            <div className="mt-2 text-xs text-slate-400">Tip: Use <code>/summary</code> for a quick dataset overview.</div>
          </div>
        </div>
      </div>
    </>
  );
}
