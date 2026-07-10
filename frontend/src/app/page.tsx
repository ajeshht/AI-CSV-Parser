"use client";

import { useState, useRef, DragEvent, ChangeEvent } from "react";
import Papa from "papaparse";
import { 
  Upload, 
  FileSpreadsheet, 
  CheckCircle2, 
  AlertCircle, 
  RefreshCw, 
  Sparkles, 
  ChevronRight, 
  BarChart2, 
  ShieldAlert, 
  FileText, 
  ArrowRight,
  Database,
  Users,
  Settings,
  HelpCircle
} from "lucide-react";

interface RawRecord {
  [key: string]: any;
}

interface CRMLead {
  created_at: string;
  name: string;
  email: string | null;
  country_code: string | null;
  mobile_without_country_code: string | null;
  company: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  lead_owner: string | null;
  crm_status: 'GOOD_LEAD_FOLLOW_UP' | 'DID_NOT_CONNECT' | 'BAD_LEAD' | 'SALE_DONE';
  crm_note: string | null;
  data_source: 'leads_on_demand' | 'meridian_tower' | 'eden_park' | 'varah_swamy' | 'sarjapur_plots' | null;
  possession_time: string | null;
  description: string | null;
}

interface SkippedRecord {
  row: any;
  index: number;
  reason: string;
}

interface LogEntry {
  time: string;
  type: 'info' | 'success' | 'error';
  text: string;
}

export default function Home() {
  // Wizard state: 1 = Upload, 2 = Preview, 3 = Processing, 4 = Results
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [file, setFile] = useState<File | null>(null);
  const [csvHeaders, setCsvHeaders] = useState<string[]>([]);
  const [rawRecords, setRawRecords] = useState<RawRecord[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Processing state
  const [progress, setProgress] = useState(0);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [mappedResults, setMappedResults] = useState<CRMLead[]>([]);
  const [skippedResults, setSkippedResults] = useState<SkippedRecord[]>([]);

  // Results tab state
  const [resultTab, setResultTab] = useState<'success' | 'skipped'>('success');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  const addLog = (type: 'info' | 'success' | 'error', text: string) => {
    const time = new Date().toLocaleTimeString();
    setLogs((prev) => [...prev, { time, type, text }]);
    setTimeout(() => {
      if (logsEndRef.current) {
        logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 50);
  };

  // Step 1: File selection & Drag/Drop
  const handleDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    setError(null);
    const droppedFile = e.dataTransfer.files[0];
    validateAndParseFile(droppedFile);
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      validateAndParseFile(selectedFile);
    }
  };

  const validateAndParseFile = (targetFile: File) => {
    if (!targetFile.name.endsWith('.csv')) {
      setError("Invalid file type. Please upload a valid CSV file (.csv).");
      return;
    }
    setFile(targetFile);
    parseCSV(targetFile);
  };

  // Step 2: Parse CSV in client-side using PapaParse
  const parseCSV = (targetFile: File) => {
    Papa.parse(targetFile, {
      header: true,
      skipEmptyLines: 'greedy',
      complete: (results) => {
        if (results.errors.length > 0 && results.data.length === 0) {
          setError("Error parsing CSV: " + results.errors[0].message);
          return;
        }
        if (results.data.length === 0) {
          setError("The CSV file appears to be empty.");
          return;
        }
        const headers = results.meta.fields || [];
        setCsvHeaders(headers);
        setRawRecords(results.data as RawRecord[]);
        setStep(2); // Progress to preview
      },
      error: (err) => {
        setError("Error reading file: " + err.message);
      }
    });
  };

  // Step 3: Trigger backend API with SSE Streaming
  const startImport = async () => {
    setStep(3);
    setProgress(0);
    setLogs([
      { 
        time: new Date().toLocaleTimeString(), 
        type: 'info', 
        text: `Initializing ingestion processor for ${rawRecords.length} records...` 
      }
    ]);
    setError(null);

    try {
      const response = await fetch('http://localhost:5000/api/import/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ 
          records: rawRecords,
          batchSize: 10 
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(errorText || 'Server returned an error');
      }

      if (!response.body) {
        throw new Error('Your browser does not support response streaming.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          const trimmed = line.trim();
          if (trimmed.startsWith('data: ')) {
            try {
              const eventData = JSON.parse(trimmed.substring(6));
              const { type, payload } = eventData;

              if (type === 'info') {
                addLog('info', payload.message);
              } else if (type === 'progress') {
                const percent = Math.round((payload.processedCount / payload.totalCount) * 100);
                setProgress(percent);
                addLog(
                  'info', 
                  `Processed ${payload.processedCount}/${payload.totalCount} rows. Mapped: ${payload.mappedCount}, Skipped: ${payload.skippedCount}`
                );
              } else if (type === 'complete') {
                setProgress(100);
                addLog('success', `Completed processing all records!`);
                setMappedResults(payload.mapped);
                setSkippedResults(payload.skipped);
                setStep(4);
              } else if (type === 'error') {
                addLog('error', payload.message);
                setError(payload.message);
                setStep(2);
              }
            } catch (jsonErr) {
              console.error('Failed parsing stream chunk:', jsonErr, trimmed);
            }
          }
        }
      }
    } catch (err: any) {
      console.error('Import processing failed:', err);
      setError(err.message || 'Connection to backend failed');
      setStep(2);
    }
  };

  const resetImporter = () => {
    setFile(null);
    setCsvHeaders([]);
    setRawRecords([]);
    setMappedResults([]);
    setSkippedResults([]);
    setProgress(0);
    setLogs([]);
    setError(null);
    setStep(1);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'GOOD_LEAD_FOLLOW_UP':
        return <span className="badge badge-success">Follow Up</span>;
      case 'DID_NOT_CONNECT':
        return <span className="badge badge-info">Did Not Connect</span>;
      case 'BAD_LEAD':
        return <span className="badge badge-danger">Bad Lead</span>;
      case 'SALE_DONE':
        return <span className="badge badge-success">Sale Closed</span>;
      default:
        return <span className="badge badge-warning">{status}</span>;
    }
  };

  return (
    <div className="container">
      {/* Header */}
      <header className="header">
        <div className="header-title">
          <Database size={32} />
          <div>
            <h1>GrowEasy Importer</h1>
            <p className="subtitle">AI-powered CSV Lead Integrator & Schema Mapper</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <span className="badge badge-info" style={{ textTransform: 'none', padding: '0.4rem 0.8rem' }}>
            Stateless Engine
          </span>
          <button className="btn btn-secondary" style={{ padding: '0.5rem' }} onClick={resetImporter} title="Reset">
            <RefreshCw size={16} />
          </button>
        </div>
      </header>

      {/* Steps bar */}
      <div className="steps-container">
        <div className={`step-item ${step === 1 ? 'active' : ''} ${step > 1 ? 'completed' : ''}`}>
          <div className="step-badge">{step > 1 ? '✓' : '1'}</div>
          <span className="step-label">Upload CSV</span>
        </div>
        <div className={`step-item ${step === 2 ? 'active' : ''} ${step > 2 ? 'completed' : ''}`}>
          <div className="step-badge">{step > 2 ? '✓' : '2'}</div>
          <span className="step-label">Preview Data</span>
        </div>
        <div className={`step-item ${step === 3 ? 'active' : ''} ${step > 3 ? 'completed' : ''}`}>
          <div className="step-badge">{step > 3 ? '✓' : '3'}</div>
          <span className="step-label">AI Processing</span>
        </div>
        <div className={`step-item ${step === 4 ? 'active' : ''}`}>
          <div className="step-badge">4</div>
          <span className="step-label">CRM Leads</span>
        </div>
      </div>

      {/* Error Banner */}
      {error && (
        <div className="alert-banner alert-banner-error">
          <AlertCircle size={20} />
          <div>{error}</div>
        </div>
      )}

      {/* STEP 1: Upload */}
      {step === 1 && (
        <div className="glow-card" style={{ padding: '2rem' }}>
          <div 
            className={`upload-zone ${isDragging ? 'dragging' : ''}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <input 
              type="file" 
              ref={fileInputRef} 
              style={{ display: 'none' }} 
              accept=".csv"
              onChange={handleFileChange}
            />
            <div className="upload-icon-wrapper">
              <Upload size={32} />
            </div>
            <h3 className="upload-title">Drag & drop your CSV file here</h3>
            <p className="upload-desc">or click to browse your local files</p>
            <button className="btn btn-primary">
              <FileSpreadsheet size={18} /> Select CSV File
            </button>
          </div>
          
          <div className="mt-6" style={{ background: 'rgba(255,255,255,0.02)', padding: '1.25rem', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <h4 style={{ fontFamily: 'var(--font-title)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Sparkles size={16} className="text-info" /> AI Core Capabilities
            </h4>
            <ul style={{ listStyleType: 'none', color: 'var(--text-secondary)', fontSize: '0.85rem', lineHeight: '1.6' }}>
              <li>• Maps arbitrary column layouts (e.g. maps "Fname" or "First" to CRM Name).</li>
              <li>• Normalizes email domains, splits mobile country codes, and parses chaotic timestamps.</li>
              <li>• Maps notes, overflow numbers, and additional detail fields into CRM notes.</li>
              <li>• Determines lead statuses (GOOD_LEAD_FOLLOW_UP, BAD_LEAD, etc.) based on contextual descriptions.</li>
            </ul>
          </div>
        </div>
      )}

      {/* STEP 2: Preview */}
      {step === 2 && (
        <div className="glow-card" style={{ padding: '1.5rem' }}>
          <div className="actions-bar">
            <div className="file-info">
              <FileSpreadsheet className="text-info" size={24} />
              <div>
                <span className="file-name-label">{file?.name}</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginLeft: '0.75rem' }}>
                  ({rawRecords.length} records parsed)
                </span>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={resetImporter}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={startImport}>
                Confirm Import <ArrowRight size={16} />
              </button>
            </div>
          </div>

          <div className="alert-banner alert-banner-info" style={{ marginBottom: '1.25rem' }}>
            <Sparkles size={18} />
            <span>Below is the raw parser preview. Confirming will execute AI mapping in batches.</span>
          </div>

          <div className="table-wrapper">
            <table className="custom-table">
              <thead>
                <tr>
                  <th>Row</th>
                  {csvHeaders.map((header) => (
                    <th key={header}>{header}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rawRecords.map((row, idx) => (
                  <tr key={idx}>
                    <td style={{ fontWeight: 'bold', color: 'var(--text-muted)' }}>{idx + 1}</td>
                    {csvHeaders.map((header) => (
                      <td key={header} title={row[header]}>
                        {row[header] !== undefined && row[header] !== null ? String(row[header]) : ''}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* STEP 3: Processing */}
      {step === 3 && (
        <div className="glow-card" style={{ padding: '2rem' }}>
          <div className="progress-container">
            <RefreshCw size={40} className="text-info" style={{ animation: 'spin 2s linear infinite', marginBottom: '1rem' }} />
            <h3 style={{ fontSize: '1.5rem' }}>AI Mapping in Progress...</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginTop: '0.25rem' }}>
              Communicating with the LLM. Processing rows in batches of 10.
            </p>

            <div className="progress-loader">
              <div className="progress-bar-fill" style={{ width: `${progress}%` }}></div>
            </div>

            <div className="flex justify-between align-center mb-4" style={{ fontSize: '0.95rem' }}>
              <span className="font-bold">{progress}% Complete</span>
              <span style={{ color: 'var(--text-secondary)' }}>
                {Math.round((progress / 100) * rawRecords.length)} / {rawRecords.length} records
              </span>
            </div>

            <h4 style={{ textAlign: 'left', marginBottom: '0.75rem', fontFamily: 'var(--font-title)' }}>
              Live Execution Logs
            </h4>
            <div className="progress-logs">
              {logs.map((log, idx) => (
                <div key={idx} className={`log-entry ${log.type}`}>
                  [{log.time}] {log.text}
                </div>
              ))}
              <div ref={logsEndRef} />
            </div>
          </div>
        </div>
      )}

      {/* STEP 4: Results */}
      {step === 4 && (
        <div className="dashboard-grid">
          {/* Metrics summary cards */}
          <div className="metrics-row">
            <div className="glow-card metric-card">
              <div className="metric-icon-wrapper" style={{ background: 'rgba(99,102,241,0.1)', color: 'var(--accent-primary)' }}>
                <FileText size={24} />
              </div>
              <div className="metric-info">
                <span className="metric-label">Total CSV Rows</span>
                <span className="metric-value">{rawRecords.length}</span>
              </div>
            </div>

            <div className="glow-card metric-card">
              <div className="metric-icon-wrapper" style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
                <CheckCircle2 size={24} />
              </div>
              <div className="metric-info">
                <span className="metric-label">Successfully Mapped</span>
                <span className="metric-value">{mappedResults.length}</span>
              </div>
            </div>

            <div className="glow-card metric-card">
              <div className="metric-icon-wrapper" style={{ background: 'var(--color-danger-bg)', color: 'var(--color-danger)' }}>
                <ShieldAlert size={24} />
              </div>
              <div className="metric-info">
                <span className="metric-label">Skipped (Invalid)</span>
                <span className="metric-value">{skippedResults.length}</span>
              </div>
            </div>

            <div className="glow-card metric-card">
              <div className="metric-icon-wrapper" style={{ background: 'rgba(6,182,212,0.1)', color: 'var(--color-info)' }}>
                <BarChart2 size={24} />
              </div>
              <div className="metric-info">
                <span className="metric-label">Import Success Rate</span>
                <span className="metric-value">
                  {rawRecords.length > 0 ? Math.round((mappedResults.length / rawRecords.length) * 100) : 0}%
                </span>
              </div>
            </div>
          </div>

          {/* Results Tab Table */}
          <div className="glow-card" style={{ padding: '1.5rem' }}>
            <div className="results-header-box">
              <h3 style={{ fontSize: '1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <Sparkles size={18} className="text-info" /> Mapped CRM Output
              </h3>

              <div className="tab-selector">
                <button 
                  className={`tab-btn ${resultTab === 'success' ? 'active' : ''}`}
                  onClick={() => setResultTab('success')}
                >
                  Mapped Leads ({mappedResults.length})
                </button>
                <button 
                  className={`tab-btn ${resultTab === 'skipped' ? 'active' : ''}`}
                  onClick={() => setResultTab('skipped')}
                >
                  Skipped Records ({skippedResults.length})
                </button>
              </div>
            </div>

            {resultTab === 'success' ? (
              <div className="table-wrapper">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th>Lead Created</th>
                      <th>Full Name</th>
                      <th>Email Address</th>
                      <th>Country Code</th>
                      <th>Mobile Number</th>
                      <th>Company</th>
                      <th>Status</th>
                      <th>Source</th>
                      <th>Possession Time</th>
                      <th>Notes / Overflow Info</th>
                    </tr>
                  </thead>
                  <tbody>
                    {mappedResults.map((lead, idx) => (
                      <tr key={idx}>
                        <td>
                          {lead.created_at ? new Date(lead.created_at).toLocaleString() : 'N/A'}
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{lead.name}</td>
                        <td>{lead.email || <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                        <td>{lead.country_code || <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                        <td>{lead.mobile_without_country_code || <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                        <td>{lead.company || <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                        <td>{getStatusBadge(lead.crm_status)}</td>
                        <td>
                          {lead.data_source ? (
                            <span className="badge badge-info">{lead.data_source.replace(/_/g, ' ')}</span>
                          ) : (
                            <span style={{ color: 'var(--text-muted)' }}>-</span>
                          )}
                        </td>
                        <td>{lead.possession_time || <span style={{ color: 'var(--text-muted)' }}>-</span>}</td>
                        <td title={lead.crm_note || ''} style={{ fontStyle: 'italic', maxWidth: '250px' }}>
                          {lead.crm_note || <span style={{ color: 'var(--text-muted)' }}>-</span>}
                        </td>
                      </tr>
                    ))}
                    {mappedResults.length === 0 && (
                      <tr>
                        <td colSpan={10} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                          No leads were successfully mapped.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="table-wrapper">
                <table className="custom-table">
                  <thead>
                    <tr>
                      <th style={{ width: '80px' }}>Row Index</th>
                      <th style={{ width: '250px' }}>Reason for Skipping</th>
                      <th>Original CSV Data</th>
                    </tr>
                  </thead>
                  <tbody>
                    {skippedResults.map((skipped, idx) => (
                      <tr key={idx}>
                        <td style={{ fontWeight: 'bold' }}>{skipped.index + 1}</td>
                        <td className="text-danger" style={{ fontWeight: 500 }}>
                          {skipped.reason}
                        </td>
                        <td>
                          <pre style={{ 
                            margin: 0, 
                            fontFamily: 'monospace', 
                            fontSize: '0.8rem',
                            color: 'var(--text-secondary)',
                            background: 'rgba(0,0,0,0.15)',
                            padding: '0.4rem',
                            borderRadius: '4px',
                            overflowX: 'auto',
                            maxWidth: '600px'
                          }}>
                            {JSON.stringify(skipped.row, null, 2)}
                          </pre>
                        </td>
                      </tr>
                    ))}
                    {skippedResults.length === 0 && (
                      <tr>
                        <td colSpan={3} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-secondary)' }}>
                          No records were skipped. All rows mapped successfully!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div className="mt-6 flex justify-between align-center">
              <button className="btn btn-secondary" onClick={resetImporter}>
                Import Another File
              </button>
              <button 
                className="btn btn-primary" 
                onClick={() => {
                  // Export as clean JSON download
                  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(mappedResults, null, 2));
                  const downloadAnchor = document.createElement('a');
                  downloadAnchor.setAttribute("href", dataStr);
                  downloadAnchor.setAttribute("download", "groweasy_mapped_leads.json");
                  document.body.appendChild(downloadAnchor);
                  downloadAnchor.click();
                  downloadAnchor.remove();
                }}
                disabled={mappedResults.length === 0}
              >
                Export Mapped CRM JSON
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Spin animation styles */}
      <style jsx global>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}
