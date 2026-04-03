import { useRef } from 'react'
import styles from './Sidebar.module.css'

const PIPELINE = [
  { id: 'load',   label: 'Document loading' },
  { id: 'chunk',  label: 'Chunking & parsing' },
  { id: 'embed',  label: 'TF-IDF embedding' },
  { id: 'index',  label: 'Vector index built' },
  { id: 'ready',  label: 'Agent ready' },
]

export default function Sidebar({ docs, pipelineState, onUpload, onDelete, totalChunks }) {
  const inputRef = useRef()

  const handleFiles = async (files) => {
    for (const f of Array.from(files)) await onUpload(f)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    handleFiles(e.dataTransfer.files)
  }

  return (
    <aside className={styles.sidebar}>
      <div className={styles.header}>
        <div className={styles.logo}>
          <div className={styles.logoIcon}>
            <svg viewBox="0 0 20 20" fill="white" width="14" height="14">
              <path d="M10 2a8 8 0 100 16A8 8 0 0010 2zm1 11H9v-2h2v2zm0-4H9V7h2v2z"/>
            </svg>
          </div>
          <div>
            <div className={styles.logoText}>MedRAG</div>
            <div className={styles.logoSub}>Medical Document AI</div>
          </div>
        </div>

        <div
          className={styles.uploadZone}
          onClick={() => inputRef.current.click()}
          onDrop={handleDrop}
          onDragOver={(e) => e.preventDefault()}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,.txt"
            multiple
            style={{ display: 'none' }}
            onChange={(e) => handleFiles(e.target.files)}
          />
          <div className={styles.uploadIcon}>↑</div>
          <div className={styles.uploadLabel}>Upload PDF / TXT</div>
          <div className={styles.uploadSub}>Drag & drop or click</div>
        </div>
      </div>

      <div className={styles.docsList}>
        <div className={styles.sectionLabel}>
          Documents
          {docs.length > 0 && <span className={styles.badge}>{docs.length}</span>}
        </div>
        {docs.length === 0 && (
          <div className={styles.emptyDocs}>No documents yet</div>
        )}
        {docs.map((doc) => (
          <div key={doc.doc_id} className={styles.docItem}>
            <div className={styles.docIcon}>📄</div>
            <div className={styles.docMeta}>
              <div className={styles.docName}>{doc.name}</div>
              <div className={styles.docChunks}>{doc.chunks} chunks</div>
            </div>
            <div className={styles.docActions}>
              <span className={styles.indexed}>indexed</span>
              <button
                className={styles.deleteBtn}
                onClick={() => onDelete(doc.doc_id)}
                title="Remove document"
              >✕</button>
            </div>
          </div>
        ))}
      </div>

      <div className={styles.pipeline}>
        <div className={styles.sectionLabel}>RAG Pipeline</div>
        {PIPELINE.map((step) => {
          const state = pipelineState[step.id] || 'idle'
          return (
            <div key={step.id} className={styles.pipelineStep}>
              <div className={`${styles.dot} ${styles[state]}`} />
              <span>{step.label}</span>
              {state === 'active' && <div className="spinner" style={{ width: 10, height: 10 }} />}
            </div>
          )
        })}
        {totalChunks > 0 && (
          <div className={styles.totalChunks}>{totalChunks} total chunks indexed</div>
        )}
      </div>
    </aside>
  )
}
