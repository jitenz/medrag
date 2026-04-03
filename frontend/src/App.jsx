import { useState, useEffect, useCallback } from 'react'
import Sidebar from './Sidebar.jsx'
import ChatPanel from './ChatPanel.jsx'
import ChunksPanel from './ChunksPanel.jsx'
import ConfigPanel from './ConfigPanel.jsx'
import * as api from './api.js'
import styles from './App.module.css'

const TABS = [
  { key: 'chat',    label: 'Chat' },
  { key: 'chunks',  label: 'Chunks' },
  { key: 'config',  label: 'Config' },
]

const DEFAULT_CONFIG = {
  model: 'claude-sonnet-4-20250514',
  chunkSize: 800,
  overlap: 150,
  topK: 4,
  minSim: 0.15,
  temperature: 0.3,
  systemPrompt:
    'You are a medical AI assistant specializing in analyzing clinical documents. ' +
    'Always cite chunk numbers and document names for each claim. ' +
    'Be precise, clinical, and acknowledge uncertainty. ' +
    "Never give specific medical advice — recommend consulting a healthcare professional.",
}

const IDLE_PIPELINE = { load: 'idle', chunk: 'idle', embed: 'idle', index: 'idle', ready: 'idle' }

export default function App() {
  const [tab, setTab] = useState('chat')
  const [docs, setDocs] = useState([])
  const [chunks, setChunks] = useState([])
  const [messages, setMessages] = useState([])
  const [mode, setMode] = useState('rag')
  const [isLoading, setIsLoading] = useState(false)
  const [pipeline, setPipeline] = useState(IDLE_PIPELINE)
  const [config, setConfig] = useState(DEFAULT_CONFIG)
  const [error, setError] = useState(null)
  const [conversationHistory, setConversationHistory] = useState([])

  const refreshDocs = useCallback(async () => {
    try {
      const d = await api.listDocuments()
      setDocs(d)
    } catch {}
  }, [])

  const refreshChunks = useCallback(async () => {
    try {
      const c = await api.listChunks()
      setChunks(c)
    } catch {}
  }, [])

  useEffect(() => {
    refreshDocs()
    refreshChunks()
  }, [])

  const setPipelineStep = (step, state) =>
    setPipeline((p) => ({ ...p, [step]: state }))

  const handleUpload = async (file) => {
    setError(null)
    setPipeline(IDLE_PIPELINE)
    try {
      setPipelineStep('load', 'active')
      await new Promise((r) => setTimeout(r, 100))
      setPipelineStep('load', 'done')
      setPipelineStep('chunk', 'active')

      const result = await api.uploadFile(file, config.chunkSize, config.overlap)

      setPipelineStep('chunk', 'done')
      setPipelineStep('embed', 'active')
      await new Promise((r) => setTimeout(r, 300))
      setPipelineStep('embed', 'done')
      setPipelineStep('index', 'active')
      await new Promise((r) => setTimeout(r, 200))
      setPipelineStep('index', 'done')
      setPipelineStep('ready', 'done')

      await refreshDocs()
      await refreshChunks()
    } catch (e) {
      setError(e.message)
      setPipeline(IDLE_PIPELINE)
    }
  }

  const handleDelete = async (docId) => {
    try {
      await api.deleteDocument(docId)
      await refreshDocs()
      await refreshChunks()
      if (docs.length <= 1) {
        setPipeline(IDLE_PIPELINE)
      }
    } catch (e) {
      setError(e.message)
    }
  }

  const handleSend = async (query) => {
    if (isLoading) return
    setError(null)
    setIsLoading(true)

    // Add user message
    const userMsg = { role: 'user', text: query }
    setMessages((m) => [...m, userMsg])

    // Add loading agent message
    const agentStepLabels = {
      rag:       ['Encoding query', 'Retrieving chunks', 'Generating answer'],
      agentic:   ['Planning', 'Retrieving evidence', 'Reasoning', 'Synthesizing'],
      summarize: ['Collecting chunks', 'Summarizing'],
      extract:   ['Scanning entities', 'Extracting'],
    }[mode] || ['Processing']

    const loadingMsg = {
      role: 'agent',
      loading: true,
      text: '',
      steps: agentStepLabels.map((l, i) => ({ label: l, done: i < agentStepLabels.length - 1 })),
    }
    setMessages((m) => [...m, loadingMsg])

    try {
      const result = await api.chat({
        query,
        mode,
        top_k: config.topK,
        min_sim: config.minSim,
        temperature: config.temperature,
        model: config.model,
        system_prompt: config.systemPrompt,
        conversation_history: conversationHistory.slice(-8),
      })

      // Update conversation history
      setConversationHistory((h) => [
        ...h,
        { role: 'user', content: query },
        { role: 'assistant', content: result.answer },
      ])

      // Replace loading message
      setMessages((m) => [
        ...m.slice(0, -1),
        {
          role: 'agent',
          loading: false,
          text: result.answer,
          retrieved: result.retrieved,
          usage: result.usage,
          steps: agentStepLabels.map((l) => ({ label: l, done: true })),
        },
      ])
    } catch (e) {
      setMessages((m) => [
        ...m.slice(0, -1),
        { role: 'agent', loading: false, text: `Error: ${e.message}`, retrieved: [] },
      ])
      setError(e.message)
    }

    setIsLoading(false)
  }

  const totalChunks = chunks.length

  return (
    <div className={styles.app}>
      <Sidebar
        docs={docs}
        pipelineState={pipeline}
        onUpload={handleUpload}
        onDelete={handleDelete}
        totalChunks={totalChunks}
      />

      <div className={styles.main}>
        {error && (
          <div className={styles.errorBar}>
            ⚠ {error}
            <button onClick={() => setError(null)}>✕</button>
          </div>
        )}

        <div className={styles.tabs}>
          {TABS.map((t) => (
            <button
              key={t.key}
              className={`${styles.tabBtn} ${tab === t.key ? styles.tabActive : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
              {t.key === 'chunks' && totalChunks > 0 && (
                <span className={styles.tabBadge}>{totalChunks}</span>
              )}
            </button>
          ))}

          <div className={styles.tabStats}>
            {docs.length > 0 && <span>{docs.length} doc{docs.length !== 1 ? 's' : ''}</span>}
            {totalChunks > 0 && <span>{totalChunks} chunks</span>}
          </div>
        </div>

        <div className={styles.tabContent}>
          {tab === 'chat' && (
            <ChatPanel
              hasChunks={totalChunks > 0}
              onSend={handleSend}
              isLoading={isLoading}
              messages={messages}
              mode={mode}
              onModeChange={setMode}
            />
          )}
          {tab === 'chunks' && <ChunksPanel chunks={chunks} />}
          {tab === 'config' && <ConfigPanel config={config} onChange={setConfig} />}
        </div>
      </div>
    </div>
  )
}
