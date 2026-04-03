import styles from './ConfigPanel.module.css'

const MODELS = [
  { value: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (recommended)' },
  { value: 'claude-opus-4-20250514', label: 'Claude Opus 4 (most capable)' },
  { value: 'claude-haiku-4-5-20251001', label: 'Claude Haiku 4.5 (fastest)' },
]

export default function ConfigPanel({ config, onChange }) {
  const update = (key, value) => onChange({ ...config, [key]: value })

  return (
    <div className={styles.panel}>
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Model</div>
        <div className={styles.row}>
          <label>Claude model</label>
          <select value={config.model} onChange={(e) => update('model', e.target.value)}>
            {MODELS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
        </div>
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Chunking</div>
        <SliderRow label="Chunk size (chars)" value={config.chunkSize} min={200} max={2000} step={100} format={v => v} onChange={(v) => update('chunkSize', v)} />
        <SliderRow label="Chunk overlap" value={config.overlap} min={0} max={500} step={50} format={v => v} onChange={(v) => update('overlap', v)} />
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>Retrieval</div>
        <SliderRow label="Top-K chunks" value={config.topK} min={1} max={10} step={1} format={v => v} onChange={(v) => update('topK', v)} />
        <SliderRow label="Min similarity" value={config.minSim} min={0} max={1} step={0.05} format={v => v.toFixed(2)} onChange={(v) => update('minSim', parseFloat(v))} />
        <SliderRow label="Temperature" value={config.temperature} min={0} max={1} step={0.05} format={v => parseFloat(v).toFixed(2)} onChange={(v) => update('temperature', parseFloat(v))} />
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>System Prompt</div>
        <textarea
          className={styles.sysPrompt}
          value={config.systemPrompt}
          onChange={(e) => update('systemPrompt', e.target.value)}
          rows={6}
        />
      </div>

      <div className={styles.section}>
        <div className={styles.sectionTitle}>About</div>
        <div className={styles.about}>
          <p>MedRAG uses TF-IDF cosine similarity for retrieval and Anthropic Claude for generation. All processing happens on your server — no data sent to third parties except Anthropic's API.</p>
          <p style={{marginTop: 8}}>Set <code>ANTHROPIC_API_KEY</code> as an environment variable on your server.</p>
        </div>
      </div>
    </div>
  )
}

function SliderRow({ label, value, min, max, step, format, onChange }) {
  return (
    <div className={styles.sliderRow}>
      <label>{label}</label>
      <input type="range" min={min} max={max} step={step} value={value}
        onChange={(e) => onChange(e.target.value)} />
      <span className={styles.val}>{format(parseFloat(value))}</span>
    </div>
  )
}
