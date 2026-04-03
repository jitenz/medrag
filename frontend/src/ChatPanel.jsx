import { useState, useRef, useEffect } from 'react'
import styles from './ChatPanel.module.css'

const MODES = [
  { key: 'rag',       label: 'RAG',       desc: 'Retrieval-augmented generation with citations' },
  { key: 'agentic',   label: 'Agentic',   desc: 'Multi-step reasoning agent' },
  { key: 'summarize', label: 'Summarize', desc: 'Full document summary' },
  { key: 'extract',   label: 'Extract',   desc: 'Entity extraction (meds, labs, diagnoses)' },
]

const SUGGESTIONS = [
  'What are the main clinical findings?',
  'Summarize the treatment plan and medications',
  'List all contraindications and warnings',
  'What lab values are abnormal and what do they indicate?',
  'Extract all medications with dosages',
]

const AGENT_STEP_LABELS = {
  rag:       ['Encoding query', 'Retrieving chunks', 'Generating answer'],
  agentic:   ['Planning strategy', 'Retrieving evidence', 'Step-by-step reasoning', 'Synthesizing'],
  summarize: ['Collecting chunks', 'Generating summary'],
  extract:   ['Scanning for entities', 'Extracting structured data'],
}

export default function ChatPanel({ hasChunks, onSend, isLoading, messages, mode, onModeChange }) {
  const [input, setInput] = useState('')
  const messagesEndRef = useRef()
  const textareaRef = useRef()

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = () => {
    const q = input.trim()
    if (!q || isLoading || !hasChunks) return
    setInput('')
    onSend(q)
  }

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const autoResize = (el) => {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  return (
    <div className={styles.panel}>
      <div className={styles.messages}>
        {messages.length === 0 && (
          <div className={styles.welcome}>
            <div className={styles.welcomeIcon}>🏥</div>
            <h2>Medical RAG Assistant</h2>
            <p>
              {hasChunks
                ? 'Documents loaded. Ask anything about your medical files.'
                : 'Upload PDF/TXT medical documents to get started.'}
            </p>
            {hasChunks && (
              <div className={styles.suggestions}>
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    className={styles.suggestion}
                    onClick={() => onSend(s)}
                    disabled={isLoading}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {messages.map((msg, i) => (
          <div key={i} className={`${styles.msg} ${styles[msg.role]} fade-in`}>
            <div className={styles.avatar}>
              {msg.role === 'user' ? 'You' : 'AI'}
            </div>
            <div className={styles.msgContent}>
              {msg.role === 'agent' && msg.steps && (
                <div className={styles.agentSteps}>
                  {msg.steps.map((step, si) => (
                    <div key={si} className={styles.agentStep}>
                      <div className={`${styles.stepDot} ${step.done ? styles.done : styles.active}`} />
                      {step.label}
                    </div>
                  ))}
                </div>
              )}
              <div className={styles.bubble}>
                {msg.role === 'agent' && msg.loading ? (
                  <div className={styles.thinking}>
                    <div className="spinner" />
                    <span>Thinking...</span>
                  </div>
                ) : (
                  <div className={styles.text}>
                    {msg.text.split('\n').map((line, li) => (
                      <span key={li}>{line}{li < msg.text.split('\n').length - 1 && <br />}</span>
                    ))}
                  </div>
                )}
                {msg.retrieved && msg.retrieved.length > 0 && (
                  <div className={styles.sources}>
                    <div className={styles.sourcesLabel}>Sources</div>
                    {msg.retrieved.map((r, ri) => (
                      <span key={ri} className={styles.sourceChip}>
                        {r.chunk.doc_name} #{r.chunk.index + 1}
                        <span className={styles.simScore}>{r.score.toFixed(2)}</span>
                      </span>
                    ))}
                  </div>
                )}
                {msg.usage && (
                  <div className={styles.usage}>
                    {msg.usage.input_tokens} in / {msg.usage.output_tokens} out tokens
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className={styles.inputArea}>
        <div className={styles.modeRow}>
          {MODES.map((m) => (
            <button
              key={m.key}
              className={`${styles.modeBtn} ${mode === m.key ? styles.modeActive : ''}`}
              onClick={() => onModeChange(m.key)}
              title={m.desc}
            >
              {m.label}
            </button>
          ))}
        </div>
        <div className={styles.inputRow}>
          <div className={styles.inputWrap}>
            <textarea
              ref={textareaRef}
              className={styles.input}
              value={input}
              onChange={(e) => { setInput(e.target.value); autoResize(e.target) }}
              onKeyDown={handleKey}
              placeholder={
                hasChunks
                  ? `Ask in ${mode.toUpperCase()} mode... (Enter to send)`
                  : 'Upload documents first...'
              }
              disabled={!hasChunks || isLoading}
              rows={1}
            />
          </div>
          <button
            className={styles.sendBtn}
            onClick={handleSend}
            disabled={!hasChunks || isLoading || !input.trim()}
          >
            {isLoading ? <div className="spinner" /> : '↑'}
          </button>
        </div>
      </div>
    </div>
  )
}
