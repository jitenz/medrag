import styles from './ChunksPanel.module.css'

export default function ChunksPanel({ chunks }) {
  if (!chunks.length) {
    return (
      <div className={styles.empty}>
        <div>📄</div>
        <p>No chunks yet. Upload a document to see extracted chunks.</p>
      </div>
    )
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <span>{chunks.length} chunks across all documents</span>
      </div>
      <div className={styles.list}>
        {chunks.map((c, i) => (
          <div key={c.id} className={styles.card}>
            <div className={styles.cardHeader}>
              <span className={styles.chunkId}>{c.id}</span>
              <span className={styles.docName}>📄 {c.doc_name}</span>
              <span className={styles.chars}>{c.text.length} chars</span>
            </div>
            <div className={styles.cardText}>{c.text.slice(0, 280)}{c.text.length > 280 ? '…' : ''}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
