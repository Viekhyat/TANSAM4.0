import React, { useEffect, useMemo, useState, useRef } from 'react';
import { sendChatMessage } from '../utils/chatApi';
// Try to import lucide icons if available; otherwise fall back to simple text/SVG
let PaperPlaneIcon = null;
let MessageSquare = null;
let Settings = null;
let X = null;
let Save = null;
let Key = null;
try {
  // eslint-disable-next-line import/no-extraneous-dependencies
  const lucide = require('lucide-react');
  PaperPlaneIcon = lucide.PaperPlane;
  MessageSquare = lucide.MessageSquare;
  Settings = lucide.Settings;
  X = lucide.X;
  Save = lucide.Save;
  Key = lucide.Key;
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
  const [useMock, setUseMock] = useState(() => !localStorage.getItem('openai_api_key'));
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState(() => localStorage.getItem('openai_api_key') || '');
  const [apiKeyInput, setApiKeyInput] = useState('');
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

  function saveApiKey() {
    if (apiKeyInput) {
      localStorage.setItem('openai_api_key', apiKeyInput);
      setApiKey(apiKeyInput);
      setUseMock(false);
      setShowSettings(false);
      setApiKeyInput('');
    }
  }

  function clearApiKey() {
    localStorage.removeItem('openai_api_key');
    setApiKey('');
    setUseMock(true);
  }

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
      const resp = await sendChatMessage({ 
        question: trimmed, 
        summary, 
        charts, 
        datasets, 
        apiKey, 
        useMock 
      });
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
    a.download = `DATANAUT_chat_${Date.now()}.txt`;
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
          className="bg-indigo-600 hover:bg-indigo-700 text-white p-4 rounded-full shadow-lg flex items-center justify-center"
          title="Toggle chat"
          style={{ width: '60px', height: '60px' }}
        >
          {MessageSquare ? <MessageSquare className="w-8 h-8" /> : <span style={{ fontSize: '24px' }}>💬</span>}
        </button>
      </div>

      <div
        className={`fixed bottom-20 right-6 z-40 transition-transform duration-200 ${open ? 'translate-y-0' : 'translate-y-6 opacity-0 pointer-events-none'}`}
        style={{ width: 450 }}
      >
        <div className="bg-white bg-opacity-70 dark:bg-slate-900 dark:bg-opacity-70 backdrop-blur-md border border-slate-200 dark:border-slate-700 rounded-lg shadow-xl flex flex-col overflow-hidden">
          <div className="px-4 py-3 flex items-center justify-between border-b border-slate-100 dark:border-slate-800 bg-gradient-to-r from-indigo-600 to-purple-600 text-white">
            <div className="flex items-center space-x-2">
              {MessageSquare ? <MessageSquare className="w-5 h-5 text-white" /> : <span>🤖</span>}
              <div>
                <div className="text-sm font-semibold">Data Assistant</div>
                <div className="text-xs text-indigo-100">Ask about your datasets and charts</div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="text-xs p-1.5 rounded-full hover:bg-white/20 text-white transition-colors"
                title="Settings"
              >
                {Settings ? <Settings className="w-4 h-4" /> : '⚙️'}
              </button>
              <button
                onClick={() => setUseMock((v) => !v)}
                className={`text-xs px-2 py-1 rounded ${useMock ? 'bg-yellow-500 text-white' : 'bg-green-500 text-white'}`}
                title="Toggle API mode"
              >
                {useMock ? 'Mock' : 'Live'}
              </button>
              <button onClick={exportChat} className="text-xs px-2 py-1 rounded bg-white/20 hover:bg-white/30 text-white">
                Export
              </button>
              <button onClick={clearChat} className="text-xs px-2 py-1 rounded bg-red-500 text-white hover:bg-red-600">
                Clear
              </button>
            </div>
          </div>

          {showSettings && (
            <div className="p-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800">
              <div className="text-sm font-medium mb-2 flex items-center">
                {Key ? <Key className="w-4 h-4 mr-1 text-indigo-600" /> : '🔑'} 
                <span>OpenAI API Key</span>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  placeholder={apiKey ? "••••••••" : "Enter your OpenAI API key"}
                  className="flex-1 px-3 py-2 rounded border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
                />
                <button
                  onClick={saveApiKey}
                  disabled={!apiKeyInput}
                  className="p-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded disabled:opacity-50"
                  title="Save API Key"
                >
                  {Save ? <Save className="w-4 h-4" /> : 'Save'}
                </button>
              </div>
              {apiKey && (
                <div className="mt-2 flex justify-between items-center">
                  <div className="text-xs text-green-600 dark:text-green-400">API key is set</div>
                  <button
                    onClick={clearApiKey}
                    className="text-xs text-red-500 hover:text-red-600"
                  >
                    Clear key
                  </button>
                </div>
              )}
            </div>
          )}

          <div ref={listRef} className="p-3 h-80 overflow-auto bg-slate-50 dark:bg-slate-950">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center p-4">
                <div className="w-16 h-16 bg-indigo-100 dark:bg-indigo-900 rounded-full flex items-center justify-center mb-3">
                  {MessageSquare ? <MessageSquare className="w-8 h-8 text-indigo-600 dark:text-indigo-400" /> : <span className="text-2xl">💬</span>}
                </div>
                <div className="text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Your Data Assistant</div>
                <div className="text-xs text-slate-500 dark:text-slate-400 mb-3">Ask questions about your datasets and visualizations</div>
                <div className="text-xs text-indigo-600 dark:text-indigo-400">Type /summary for a quick dataset overview</div>
              </div>
            )}
            {messages.map((m) => (
              <div key={m.id} className={`mb-3 flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div 
                  className={`${
                    m.role === 'user' 
                      ? 'bg-gradient-to-r from-indigo-600 to-purple-600 text-white' 
                      : 'bg-white bg-opacity-60 dark:bg-slate-800 dark:bg-opacity-60 backdrop-blur-md text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-slate-700'
                  } p-3 rounded-lg max-w-[80%] shadow-md`}
                > 
                  <div className="text-xs opacity-70 mb-1">{m.role === 'user' ? 'You' : 'Assistant'} • {formatDate(m.ts)}</div>
                  <div className="whitespace-pre-wrap text-sm">{m.text}</div>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start mb-3">
                <div className="bg-white bg-opacity-60 dark:bg-slate-800 dark:bg-opacity-60 backdrop-blur-md border border-slate-200 dark:border-slate-700 p-3 rounded-lg shadow-md">
                  <div className="flex items-center space-x-2">
                    <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></div>
                    <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse delay-150"></div>
                    <div className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse delay-300"></div>
                    <span className="text-sm text-slate-500 ml-1">Assistant is thinking...</span>
                  </div>
                </div>
              </div>
            )}
            {error && <div className="text-sm text-rose-600 p-2 bg-rose-50 dark:bg-rose-900/20 rounded-md">{error}</div>}
          </div>

          <div className="px-3 py-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
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
                className="flex-1 px-3 py-2.5 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition-all"
              />
              <button
                onClick={() => handleSend(input)}
                disabled={loading || !input.trim()}
                className="p-2.5 bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white rounded-full disabled:opacity-50 transition-all"
                title="Send"
              >
                {PaperPlaneIcon ? <PaperPlaneIcon className="w-4 h-4" /> : 'Send'}
              </button>
            </div>
            <div className="mt-2 text-xs text-slate-400 px-3">Tip: Use <code className="bg-slate-100 dark:bg-slate-800 px-1 py-0.5 rounded">/summary</code> for a quick dataset overview.</div>
          </div>
        </div>
      </div>
    </>
  );
}
