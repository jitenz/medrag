# MedRAG — Medical PDF RAG System

A full-stack Retrieval-Augmented Generation (RAG) system for medical PDF documents with an agentic chat interface powered by Anthropic Claude.

---

## Architecture

```
┌─────────────────┐       ┌──────────────────────┐       ┌─────────────────┐
│  React Frontend │ ───▶  │  FastAPI Backend      │ ───▶  │ Anthropic API   │
│  (Vite + CSS    │       │  - PDF parsing        │       │ Claude Sonnet 4 │
│   Modules)      │ ◀───  │  - TF-IDF chunking    │       │ Claude Opus 4   │
│                 │       │  - Vector retrieval   │       │ Claude Haiku 4.5│
└─────────────────┘       │  - Agentic pipeline   │       └─────────────────┘
                          └──────────────────────┘
```

### RAG Pipeline
1. **Upload** → PDF parsed with PyMuPDF, text extracted page-by-page
2. **Chunk** → Smart chunking at sentence boundaries (configurable size + overlap)
3. **Embed** → TF-IDF vectors built over all chunks
4. **Retrieve** → Cosine similarity search at query time (top-K, min-sim threshold)
5. **Generate** → Claude receives retrieved context + query, returns cited answer

### 4 Query Modes
| Mode | Description |
|------|-------------|
| **RAG** | Standard retrieval + generation with chunk citations |
| **Agentic** | Multi-step reasoning with explicit planning and evidence synthesis |
| **Summarize** | Full document summary in structured clinical format |
| **Extract** | Structured extraction of medications, labs, diagnoses, contraindications |

---

## Prerequisites

- Python 3.11+
- Node.js 20+
- An [Anthropic API key](https://console.anthropic.com/)
- Docker + Docker Compose (for containerized deployment)

---

## License

@j10
