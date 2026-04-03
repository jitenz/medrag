const BASE = '/api'

export async function uploadFile(file, chunkSize = 800, overlap = 150) {
  const form = new FormData()
  form.append('file', file)
  const res = await fetch(`${BASE}/upload?chunk_size=${chunkSize}&overlap=${overlap}`, {
    method: 'POST',
    body: form,
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Upload failed (${res.status})`)
  }
  return res.json()
}

export async function listDocuments() {
  const res = await fetch(`${BASE}/documents`)
  return res.json()
}

export async function listChunks(docId = null) {
  const url = docId ? `${BASE}/chunks?doc_id=${docId}` : `${BASE}/chunks`
  const res = await fetch(url)
  return res.json()
}

export async function deleteDocument(docId) {
  const res = await fetch(`${BASE}/document/${docId}`, { method: 'DELETE' })
  return res.json()
}

export async function chat(payload) {
  const res = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.detail || `Chat failed (${res.status})`)
  }
  return res.json()
}

export async function health() {
  const res = await fetch(`${BASE}/health`)
  return res.json()
}
