# AI-powered CSV Lead Importer & Mapper

An intelligent, full-stack CRM lead ingestion engine built for **GrowEasy**. This application extracts, maps, and standardizes lead records from any arbitrary CSV format (such as Facebook Lead Exports, Google Ads Exports, manual Excel sheets, or vendor reports) into a uniform schema using LLMs (Gemini / OpenAI).

### 🔗 Live Project Demo
* **Frontend Web App**: [Link](https://ai-csv-parser-three.vercel.app/)

The application features a premium dark glassmorphism UI, client-side preview parsing, Server-Sent Events (SSE) progress streaming, and a local regex-based heuristic mapper that runs out-of-the-box even without active LLM keys.

---

## 🌟 Key Features

1. **Intelligent AI Field Mapping**: Automatically matches column variations like `Fname`, `Email ID`, `Ph No`, `Date Created`, `Ad Source` to standardized CRM fields.
2. **Real-time SSE Streaming**: Provides a live progress indicator, updating success ratios and execution logs in real-time as batches of 10 are processed.
3. **Obsidian Dark Dashboard**: Built using custom Vanilla CSS with glassmorphic cards, metrics tracking widgets, and tabbed result comparisons.
4. **Sticky-Header Scrollable Preview Table**: Renders raw and mapped records dynamically.
5. **Robust Validation Rules**: Skips contact-less records (missing both email and phone) and logs the exclusion reasons, while merging overflow data into the CRM notes.
6. **Keyless Local Fallback**: Integrates regex-based heuristics when API keys are absent, guaranteeing full testing capability without cost.
7. **Docker Orchestrated**: Simple spin-up for development using Docker Compose.

---

## 🚀 Tech Stack

* **Frontend**: Next.js (App Router, TypeScript, custom Vanilla CSS, PapaParse, Lucide Icons)
* **Backend**: Node.js + Express + TypeScript + Multer
* **AI Integrations**: Google Gemini API (`@google/generative-ai`) and OpenAI (`openai`)
* **Deployment**: Docker, Docker Compose

---

## 📁 Project Directory Layout

```
ai-csv-importer/
├── backend/
│   ├── src/
│   │   ├── routes/import.routes.ts   # Express API endpoints
│   │   ├── services/ai.service.ts     # AI schema & fallback engine
│   │   ├── test-mapping.ts            # Standalone test runner
│   │   └── index.ts                   # Express server config
│   ├── tsconfig.json
│   ├── package.json
│   └── .env.example
├── frontend/
│   ├── src/
│   │   ├── app/
│   │   │   ├── globals.css            # Dark glassmorphic design system
│   │   │   ├── layout.tsx             # Root document & SEO titles
│   │   │   └── page.tsx               # Client wizard component
│   │   └── styles/
│   ├── tsconfig.json
│   ├── package.json
│   └── Dockerfile
├── samples/
│   ├── standard_crm.csv               # Ideal template
│   ├── messy_leads.csv                # Real-world arbitrary format
│   └── invalid_leads.csv              # Missing contact data (skip test)
├── docker-compose.yml
└── README.md
```

---

## ⚙️ Local Development Setup

### Prerequisite
Ensure [Node.js v18+](https://nodejs.org) and `npm` are installed.

### 1. Backend Configuration
Navigate to the `backend` folder:
```bash
cd backend
npm install
```
Create a `.env` file from the example:
```bash
cp .env.example .env
```
Fill in your API keys (optional; the app falls back to regex-heuristics if left empty):
```env
PORT=5000
GEMINI_API_KEY=your_gemini_api_key
OPENAI_API_KEY=your_openai_api_key
LLM_PROVIDER=gemini  # Or "openai"
```

Start the backend:
```bash
npm run dev
```
The server will run at `http://localhost:5000`.

### 2. Frontend Configuration
Navigate to the `frontend` folder:
```bash
cd ../frontend
npm install
```
Start the Next.js dev server:
```bash
npm run dev
```
The application will run at `http://localhost:3000`.

---

## 🐳 Docker Deployment

To spin up the entire full-stack application (frontend & backend) in a single command:
1. Ensure your keys are in `backend/.env`.
2. From the root directory, run:
```bash
docker-compose up --build
```
* **Frontend UI**: [http://localhost:3000](http://localhost:3000)
* **Backend API**: [http://localhost:5000](http://localhost:5000)

---

## 🧪 Testing and Verification

### Standalone Backend Test Runner
Verify the parsing schema and regex heuristics locally (without running UI or having active API keys):
```bash
cd backend
npm run test
```
This processes standard, messy, and invalid datasets, validating skipping checks and output schemas in the console.

### Sample CSV Datasets
* Use **`samples/standard_crm.csv`** to verify standard layout alignment.
* Use **`samples/messy_leads.csv`** to verify semantic AI mapping on mismatched headers.
* Use **`samples/invalid_leads.csv`** to check the skipping mechanism on empty fields.

---

## 📊 API Contracts

### 1. `POST /api/import/preview` (CSV Form Data)
Accepts a raw file and outputs a JSON preview of the first 20 rows.
* **Response**:
  ```json
  {
    "headers": ["Fname", "Lname", "Email ID", "Contact Number"],
    "totalRows": 23,
    "preview": [ ... ]
  }
  ```

### 2. `POST /api/import/process` (JSON Array)
Accepts JSON rows, processes them in batches, and streams updates.
* **Headers**: `Content-Type: text/event-stream`
* **Progress Stream Chunk**:
  ```json
  data: {
    "type": "progress",
    "payload": {
      "batchIndex": 0,
      "totalBatches": 3,
      "processedCount": 10,
      "totalCount": 25,
      "mappedCount": 9,
      "skippedCount": 1,
      "currentBatchMapped": [...],
      "currentBatchSkipped": [...]
    }
  }
  ```
* **Completion Stream Chunk**:
  ```json
  data: {
    "type": "complete",
    "payload": {
      "totalImported": 22,
      "totalSkipped": 3,
      "mapped": [...],
      "skipped": [...]
    }
  }
  ```
