"""
MedRAG - Medical PDF RAG System
FastAPI Backend
"""

import os
import uuid
import math
import re
from collections import defaultdict
from typing import Optional
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
import anthropic
import fitz  # PyMuPDF

app = FastAPI(title="MedRAG API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─── In-memory store ─────────────────────────────────────────────────────────
documents: dict[str, dict] = {}   # doc_id -> {name, chunks}
all_chunks: list[dict] = []        # flat list of all chunks
tfidf_matrix: list[dict] = []      # parallel to all_chunks


# ─── Schemas ─────────────────────────────────────────────────────────────────
class ChatRequest(BaseModel):
    query: str
    mode: str = "rag"          # rag | agentic | summarize | extract
    top_k: int = 4
    min_sim: float = 0.15
    temperature: float = 0.3
    model: str = "claude-sonnet-4-20250514"
    system_prompt: Optional[str] = None
    conversation_history: list = []

class DeleteRequest(BaseModel):
    doc_id: str


# ─── PDF Parsing ──────────────────────────────────────────────────────────────
def extract_text_from_pdf(file_bytes: bytes) -> str:
    doc = fitz.open(stream=file_bytes, filetype="pdf")
    pages = []
    for page in doc:
        pages.append(page.get_text())
    doc.close()
    return "\n\n".join(pages)


# ─── Chunking ─────────────────────────────────────────────────────────────────
def chunk_text(text: str, doc_id: str, doc_name: str,
               chunk_size: int = 800, overlap: int = 150) -> list[dict]:
    chunks = []
    start = 0
    idx = 0
    text = re.sub(r'\n{3,}', '\n\n', text).strip()
    while start < len(text):
        end = min(start + chunk_size, len(text))
        # Try to break at sentence boundary
        if end < len(text):
            for sep in ['. ', '.\n', '? ', '! ', '\n\n']:
                pos = text.rfind(sep, start + chunk_size // 2, end)
                if pos != -1:
                    end = pos + len(sep)
                    break
        chunk_text_str = text[start:end].strip()
        if len(chunk_text_str) > 40:
            chunks.append({
                "id": f"{doc_id}-c{idx}",
                "doc_id": doc_id,
                "doc_name": doc_name,
                "text": chunk_text_str,
                "index": idx,
                "char_start": start,
                "char_end": end,
            })
            idx += 1
        if end >= len(text):
            break
        start = end - overlap
    return chunks


# ─── TF-IDF ───────────────────────────────────────────────────────────────────
def tokenize(text: str) -> list[str]:
    return re.findall(r'\b[a-zA-Z]{3,}\b', text.lower())

def build_tfidf(chunks: list[dict]) -> list[dict]:
    tokenized = [tokenize(c["text"]) for c in chunks]
    N = len(tokenized)
    df: dict[str, int] = defaultdict(int)
    for tokens in tokenized:
        for w in set(tokens):
            df[w] += 1
    matrix = []
    for tokens in tokenized:
        tf: dict[str, float] = defaultdict(float)
        for w in tokens:
            tf[w] += 1
        vec: dict[str, float] = {}
        for w, count in tf.items():
            tfi = count / max(len(tokens), 1)
            idfi = math.log((N + 1) / (df[w] + 1)) + 1
            vec[w] = tfi * idfi
        matrix.append(vec)
    return matrix

def cosine_sim(a: dict, b: dict) -> float:
    dot = sum(a.get(k, 0) * v for k, v in b.items())
    norm_a = math.sqrt(sum(v * v for v in a.values()))
    norm_b = math.sqrt(sum(v * v for v in b.values()))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)

def retrieve(query: str, top_k: int, min_sim: float) -> list[dict]:
    if not all_chunks:
        return []
    q_tokens = tokenize(query)
    N = len(tfidf_matrix)
    df: dict[str, int] = defaultdict(int)
    for vec in tfidf_matrix:
        for w in vec:
            df[w] += 1
    q_tf: dict[str, float] = defaultdict(float)
    for w in q_tokens:
        q_tf[w] += 1
    q_vec: dict[str, float] = {}
    for w, count in q_tf.items():
        tfi = count / max(len(q_tokens), 1)
        idfi = math.log((N + 1) / (df[w] + 1)) + 1
        q_vec[w] = tfi * idfi
    scored = [(i, cosine_sim(q_vec, vec)) for i, vec in enumerate(tfidf_matrix)]
    scored.sort(key=lambda x: x[1], reverse=True)
    results = []
    for i, score in scored[:top_k]:
        if score >= min_sim:
            results.append({"chunk": all_chunks[i], "score": round(score, 4)})
    return results


# ─── Routes ───────────────────────────────────────────────────────────────────
@app.get("/api/health")
def health():
    return {"status": "ok", "docs": len(documents), "chunks": len(all_chunks)}

@app.post("/api/upload")
async def upload_pdf(
    file: UploadFile = File(...),
    chunk_size: int = 800,
    overlap: int = 150,
):
    if not file.filename.lower().endswith((".pdf", ".txt")):
        raise HTTPException(400, "Only PDF and TXT files are supported.")

    content = await file.read()
    doc_id = str(uuid.uuid4())[:8]

    if file.filename.lower().endswith(".pdf"):
        text = extract_text_from_pdf(content)
    else:
        text = content.decode("utf-8", errors="replace")

    if len(text.strip()) < 20:
        raise HTTPException(400, "Could not extract text from the file.")

    chunks = chunk_text(text, doc_id, file.filename, chunk_size, overlap)
    documents[doc_id] = {"name": file.filename, "chunks": chunks, "text_length": len(text)}
    all_chunks.extend(chunks)

    # Rebuild TF-IDF over all chunks
    global tfidf_matrix
    tfidf_matrix = build_tfidf(all_chunks)

    return {
        "doc_id": doc_id,
        "name": file.filename,
        "chunks": len(chunks),
        "total_chunks": len(all_chunks),
    }

@app.get("/api/documents")
def list_documents():
    return [
        {"doc_id": did, "name": d["name"], "chunks": len(d["chunks"])}
        for did, d in documents.items()
    ]

@app.get("/api/chunks")
def list_chunks(doc_id: Optional[str] = None):
    if doc_id:
        return [c for c in all_chunks if c["doc_id"] == doc_id]
    return all_chunks

@app.delete("/api/document/{doc_id}")
def delete_document(doc_id: str):
    global tfidf_matrix
    if doc_id not in documents:
        raise HTTPException(404, "Document not found.")
    documents.pop(doc_id)
    all_chunks[:] = [c for c in all_chunks if c["doc_id"] != doc_id]
    tfidf_matrix = build_tfidf(all_chunks) if all_chunks else []
    return {"deleted": doc_id, "remaining_chunks": len(all_chunks)}

@app.post("/api/chat")
async def chat(req: ChatRequest):
    api_key = os.environ.get("ANTHROPIC_API_KEY", "")
    if not api_key:
        raise HTTPException(500, "ANTHROPIC_API_KEY not set on server.")

    client = anthropic.Anthropic(api_key=api_key)

    retrieved = retrieve(req.query, req.top_k, req.min_sim)
    context = "\n\n---\n\n".join(
        f"[Chunk {i+1} | {r['chunk']['doc_name']} | sim={r['score']}]\n{r['chunk']['text']}"
        for i, r in enumerate(retrieved)
    )

    system = req.system_prompt or (
        "You are a medical AI assistant specializing in analyzing clinical documents. "
        "Always cite chunk numbers and document names for each claim. "
        "Be precise, clinical, and acknowledge uncertainty. "
        "Never give specific medical advice — recommend consulting a healthcare professional."
    )

    if req.mode == "rag":
        user_content = (
            f"Context from medical documents:\n\n{context}\n\n---\n"
            f"Question: {req.query}\n\n"
            "Answer based on the context. Cite [Chunk N] for each claim."
        ) if retrieved else (
            f"No relevant context found for: '{req.query}'. "
            "Answer from general medical knowledge if safe, and note the limitation."
        )
    elif req.mode == "agentic":
        user_content = (
            "You are an agentic medical AI. Reason step-by-step.\n\n"
            f"Evidence:\n{context or 'None retrieved.'}\n\n"
            f"Task: {req.query}\n\n"
            "Step 1 - Identify relevant evidence.\n"
            "Step 2 - Reason over findings.\n"
            "Step 3 - Synthesize answer with citations."
        )
    elif req.mode == "summarize":
        all_text = "\n\n".join(
            f"[{i+1}] {c['text']}" for i, c in enumerate(all_chunks[:15])
        )
        user_content = (
            "Summarize the following medical document content in structured clinical format "
            "(Assessment, Key Findings, Medications, Lab Values, Plan):\n\n"
            + (all_text or "No documents loaded.")
        )
    elif req.mode == "extract":
        user_content = (
            "Extract and list all medical entities from the context below. "
            "Return structured sections: Medications & Dosages, Diagnoses & Conditions, "
            "Lab Values, Procedures, Contraindications & Warnings, Follow-up Instructions.\n\n"
            f"Context:\n{context or 'No context found for: ' + req.query}"
        )
    else:
        user_content = req.query

    messages = list(req.conversation_history[-8:])
    messages.append({"role": "user", "content": user_content})

    response = client.messages.create(
        model=req.model,
        max_tokens=1200,
        system=system,
        temperature=req.temperature,
        messages=messages,
    )

    answer = "".join(b.text for b in response.content if hasattr(b, "text"))

    return {
        "answer": answer,
        "retrieved": retrieved,
        "mode": req.mode,
        "usage": {
            "input_tokens": response.usage.input_tokens,
            "output_tokens": response.usage.output_tokens,
        },
    }

# Serve React frontend (after build)
frontend_dist = os.path.join(os.path.dirname(__file__), "..", "frontend", "dist")
if os.path.exists(frontend_dist):
    app.mount("/assets", StaticFiles(directory=os.path.join(frontend_dist, "assets")), name="assets")

    @app.get("/{full_path:path}")
    def serve_spa(full_path: str):
        return FileResponse(os.path.join(frontend_dist, "index.html"))
