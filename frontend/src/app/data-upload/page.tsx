"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import Link from "next/link";
import { AppShell, PageHeading } from "@/components/app-shell";
import { ApiError } from "@/lib/client";
import {
  getUpload,
  getUploadRows,
  listUploads,
  uploadGovernmentData,
} from "@/lib/api/data-upload";
import type {
  DataUploadSummary,
  ImportedDataRow,
  UploadStatus,
} from "@/types/data-upload";

const MAX_UPLOAD_BYTES = 20 * 1024 * 1024;
const ACCEPTED_EXTENSIONS = [".csv", ".xlsx", ".pdf"];
const ROWS_PER_PAGE = 100;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(date);
}

function displayValue(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function statusLabel(status: UploadStatus): string {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

function statusTone(status: UploadStatus): string {
  return `upload-status upload-status-${status.toLowerCase()}`;
}

function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.status === 401) {
      return "Your session has expired. Sign in again to continue.";
    }
    if (error.status === 403) {
      return "You do not have permission to access this upload.";
    }
    if (error.status === 413) {
      return "This file is too large. The maximum file size is 20 MB.";
    }
    if (error.status === 415) {
      return "This file type is not supported. Choose a CSV, XLSX, or PDF file.";
    }
    if (error.status === 422) {
      return "The file could not be validated. Check its format and contents, then try again.";
    }
    if (error.status >= 500) {
      return "The service is temporarily unavailable. Please try again later.";
    }
    if (error.status === 404) {
      return "This upload could not be found. Refresh the upload history and try again.";
    }
    return error.message || "The request could not be completed.";
  }

  if (error instanceof TypeError) {
    return "A network error prevented the request. Check your connection and try again.";
  }
  return "Something went wrong while processing this request. Please try again.";
}

function validateFile(file: File): string | null {
  const extension = file.name.slice(file.name.lastIndexOf(".")).toLowerCase();
  if (!ACCEPTED_EXTENSIONS.includes(extension)) {
    return "Choose a CSV, XLSX, or PDF file.";
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    return "This file is too large. The maximum file size is 20 MB.";
  }
  if (file.size === 0) {
    return "This file is empty. Choose a file that contains data.";
  }
  return null;
}

function UploadResult({ upload }: { upload: DataUploadSummary }) {
  const mappings = Object.entries(upload.mapped_columns);

  return (
    <section className="panel upload-result" aria-labelledby="upload-result-title">
      <div className="upload-result-heading">
        <div>
          <div className="section-eyebrow">PROCESSING RESULT</div>
          <h2 id="upload-result-title">{upload.filename}</h2>
          <p>Uploaded {formatDate(upload.created_at)}</p>
        </div>
        <span className={statusTone(upload.status)}>{statusLabel(upload.status)}</span>
      </div>

      <dl className="upload-metrics">
        <div><dt>Status</dt><dd>{statusLabel(upload.status)}</dd></div>
        <div><dt>Filename</dt><dd title={upload.filename}>{upload.filename}</dd></div>
        <div><dt>File type</dt><dd>{upload.file_type}</dd></div>
        <div><dt>Total rows</dt><dd>{upload.row_count.toLocaleString()}</dd></div>
        <div><dt>Valid rows</dt><dd>{upload.valid_rows.toLocaleString()}</dd></div>
        <div><dt>Rejected rows</dt><dd>{upload.rejected_rows.toLocaleString()}</dd></div>
        <div><dt>Created</dt><dd>{formatDate(upload.created_at)}</dd></div>
      </dl>

      <div className="upload-mapping-grid">
        <div>
          <h3>Mapped columns</h3>
          {mappings.length ? (
            <ul className="upload-chip-list">
              {mappings.map(([source, target]) => (
                <li key={`${source}-${target}`}>
                  <span>{source}</span><span aria-hidden="true">→</span><strong>{target}</strong>
                </li>
              ))}
            </ul>
          ) : <p className="upload-muted">No columns were mapped.</p>}
        </div>
        <div>
          <h3>Unmapped columns</h3>
          {upload.unmapped_columns.length ? (
            <ul className="upload-chip-list upload-unmapped-list">
              {upload.unmapped_columns.map((column) => <li key={column}>{column}</li>)}
            </ul>
          ) : <p className="upload-muted">No unmapped columns.</p>}
        </div>
      </div>

      {(upload.warnings.length > 0 || upload.validation_errors.length > 0) && (
        <div className="upload-messages">
          {upload.warnings.length > 0 && (
            <div className="upload-message upload-message-warning">
              <h3>Warnings</h3>
              <ul>{upload.warnings.map((warning, index) => <li key={`${index}-${warning}`}>{warning}</li>)}</ul>
            </div>
          )}
          {upload.validation_errors.length > 0 && (
            <div className="upload-message upload-message-error">
              <h3>Validation errors</h3>
              <ul>{upload.validation_errors.map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}</ul>
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default function DataUploadPage() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [activeUpload, setActiveUpload] = useState<DataUploadSummary | null>(null);
  const [uploads, setUploads] = useState<DataUploadSummary[]>([]);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyError, setHistoryError] = useState("");
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [rows, setRows] = useState<ImportedDataRow[]>([]);
  const [rowsTotal, setRowsTotal] = useState(0);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [rowsError, setRowsError] = useState("");

  const refreshUploads = useCallback(async () => {
    try {
      setUploads(await listUploads());
      setHistoryError("");
    } catch (error) {
      setHistoryError(getErrorMessage(error));
    } finally {
      setHistoryLoading(false);
    }
  }, []);

  useEffect(() => {
    let isCurrent = true;
    listUploads()
      .then((result) => {
        if (isCurrent) {
          setUploads(result);
          setHistoryError("");
        }
      })
      .catch((error: unknown) => {
        if (isCurrent) setHistoryError(getErrorMessage(error));
      })
      .finally(() => {
        if (isCurrent) setHistoryLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  function setFile(file: File | undefined) {
    if (!file) return;
    const validationError = validateFile(file);
    setFileError(validationError ?? "");
    setSelectedFile(validationError ? null : file);
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    setFile(event.currentTarget.files?.[0]);
    event.currentTarget.value = "";
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    setFile(event.dataTransfer.files[0]);
  }

  async function handleUpload() {
    if (!selectedFile || isUploading) return;
    setIsUploading(true);
    setUploadError("");
    setRows([]);
    setRowsTotal(0);
    setRowsError("");
    try {
      const result = await uploadGovernmentData(selectedFile);
      setActiveUpload(result);
      void refreshUploads();
    } catch (error) {
      setUploadError(getErrorMessage(error));
    } finally {
      setIsUploading(false);
    }
  }

  async function selectHistoryUpload(uploadId: string) {
    setDetailLoading(true);
    setDetailError("");
    setRows([]);
    setRowsTotal(0);
    setRowsError("");
    try {
      setActiveUpload(await getUpload(uploadId));
    } catch (error) {
      setDetailError(getErrorMessage(error));
    } finally {
      setDetailLoading(false);
    }
  }

  async function loadRows(uploadId: string, append = false) {
    setRowsLoading(true);
    setRowsError("");
    try {
      const response = await getUploadRows(
        uploadId,
        append ? rows.length : 0,
        ROWS_PER_PAGE,
      );
      setRows((current) => append ? [...current, ...response.items] : response.items);
      setRowsTotal(response.total);
    } catch (error) {
      setRowsError(getErrorMessage(error));
    } finally {
      setRowsLoading(false);
    }
  }

  const rowColumns = Array.from(new Set(
    rows.flatMap((row) => Object.keys(row.normalized_data)),
  ));

  return (
    <AppShell title="Data Upload">
      <PageHeading
        eyebrow="GOVERNMENT DATA"
        title="Government Data Upload"
        detail="Upload beneficiary and service-delivery data for validation and analysis."
      />

      <section className="panel upload-card" aria-labelledby="upload-file-heading">
        <div className="section-heading">
          <div>
            <div className="section-eyebrow">NEW DATASET</div>
            <h2 id="upload-file-heading">Upload a government data file</h2>
            <p>Supported formats: CSV, XLSX, PDF · Maximum file size: 20 MB</p>
          </div>
        </div>

        <input
          ref={fileInputRef}
          className="sr-only"
          type="file"
          accept=".csv,.xlsx,.pdf"
          aria-label="Choose a CSV, XLSX, or PDF file"
          onChange={handleFileChange}
        />
        <div
          className={`upload-dropzone${isDragging ? " upload-dropzone-active" : ""}`}
          onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
          onDragOver={(event) => event.preventDefault()}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setIsDragging(false);
          }}
          onDrop={handleDrop}
        >
          <div className="upload-file-icon" aria-hidden="true">↑</div>
          <div>
            <strong>Drag and drop a file here</strong>
            <p>or select a file from your device</p>
          </div>
          <button
            className="button button-secondary"
            onClick={() => fileInputRef.current?.click()}
            type="button"
          >
            Choose File
          </button>
        </div>

        {selectedFile && (
          <div className="upload-selected-file">
            <span className="upload-selected-icon" aria-hidden="true">▤</span>
            <div className="upload-selected-copy">
              <strong title={selectedFile.name}>{selectedFile.name}</strong>
              <span>{formatFileSize(selectedFile.size)}</span>
            </div>
            <button
              className="upload-remove-file"
              onClick={() => { setSelectedFile(null); setFileError(""); }}
              type="button"
              aria-label="Remove selected file"
            >
              ×
            </button>
          </div>
        )}
        {fileError && <p className="upload-inline-error" role="alert">{fileError}</p>}
        {uploadError && (
          <div className="upload-feedback upload-feedback-error" role="alert">
            {uploadError}
            {uploadError.startsWith("Your session has expired") && (
              <> <a href="/login">Sign in</a></>
            )}
          </div>
        )}
        <div className="upload-submit-row">
          <span className="upload-private-note">Files are validated before their data is made available.</span>
          <button
            className="button button-primary"
            disabled={!selectedFile || isUploading}
            onClick={handleUpload}
            type="button"
          >
            {isUploading && <span className="loading-indicator" aria-hidden="true" />}
            {isUploading ? "Processing data…" : "Process Data"}
          </button>
        </div>
      </section>

      {activeUpload && (
        <>
          <UploadResult upload={activeUpload} />
          {activeUpload.valid_rows > 0 && activeUpload.status !== "FAILED" && (
            <div className="upload-active-callout">
              <div>
                <strong>This upload is now the active dataset.</strong>
                <span> Dashboard, map, analytics, villages, and alerts will use these validated rows.</span>
              </div>
              <Link className="button button-primary" href="/dashboard">View Dashboard</Link>
            </div>
          )}
        </>
      )}

      {detailLoading && (
        <div className="dashboard-state" role="status">
          <span className="loading-indicator" /> Loading upload details…
        </div>
      )}
      {detailError && <div className="upload-feedback upload-feedback-error" role="alert">{detailError}</div>}

      {activeUpload && activeUpload.valid_rows > 0 && (
        <section className="panel upload-rows-panel" aria-labelledby="processed-rows-heading">
          <div className="section-heading upload-rows-heading">
            <div>
              <div className="section-eyebrow">NORMALIZED DATA</div>
              <h2 id="processed-rows-heading">View Processed Data</h2>
              <p>{rows.length ? `${rows.length.toLocaleString()} of ${rowsTotal.toLocaleString()} valid rows loaded` : "Review validated rows in a normalized format."}</p>
            </div>
            {rows.length === 0 && (
              <button
                className="button button-secondary"
                disabled={rowsLoading}
                onClick={() => void loadRows(activeUpload.upload_id)}
                type="button"
              >
                {rowsLoading ? "Loading…" : "View Processed Data"}
              </button>
            )}
          </div>
          {rowsError && <div className="upload-feedback upload-feedback-error" role="alert">{rowsError}</div>}
          {rowsLoading && rows.length === 0 && (
            <div className="dashboard-state" role="status"><span className="loading-indicator" /> Loading processed rows…</div>
          )}
          {rows.length > 0 && (
            <>
              <div className="upload-table-wrap">
                <table className="upload-table">
                  <thead>
                    <tr><th scope="col">Row</th>{rowColumns.map((column) => <th scope="col" key={column}>{column.replaceAll("_", " ")}</th>)}</tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={`${activeUpload.upload_id}-${row.row_number}`}>
                        <td>{row.row_number}</td>
                        {rowColumns.map((column) => (
                          <td key={column}>{displayValue(row.normalized_data[column])}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {rows.length < rowsTotal && (
                <div className="upload-table-footer">
                  <span>Showing {rows.length.toLocaleString()} of {rowsTotal.toLocaleString()} rows</span>
                  <button
                    className="button button-secondary"
                    disabled={rowsLoading}
                    onClick={() => void loadRows(activeUpload.upload_id, true)}
                    type="button"
                  >
                    {rowsLoading ? "Loading…" : "Load more rows"}
                  </button>
                </div>
              )}
            </>
          )}
        </section>
      )}

      <section className="panel upload-history-panel" aria-labelledby="upload-history-heading">
        <div className="section-heading">
          <div>
            <div className="section-eyebrow">RECENT ACTIVITY</div>
            <h2 id="upload-history-heading">Upload history</h2>
            <p>Previously processed government data files</p>
          </div>
          <button
            className="button button-secondary"
            disabled={historyLoading}
            onClick={() => { setHistoryLoading(true); void refreshUploads(); }}
            type="button"
          >
            {historyLoading ? "Refreshing…" : "Refresh"}
          </button>
        </div>

        {historyError && <div className="upload-feedback upload-feedback-error" role="alert">{historyError}</div>}
        {historyLoading && uploads.length === 0 && (
          <div className="dashboard-state" role="status"><span className="loading-indicator" /> Loading upload history…</div>
        )}
        {!historyLoading && !historyError && uploads.length === 0 && (
          <div className="dashboard-state dashboard-state-empty">No uploads yet. Process a file to see it here.</div>
        )}
        {uploads.length > 0 && (
          <div className="upload-history-list">
            {uploads.map((upload) => (
              <button
                className={`upload-history-row${activeUpload?.upload_id === upload.upload_id ? " upload-history-row-active" : ""}`}
                key={upload.upload_id}
                onClick={() => void selectHistoryUpload(upload.upload_id)}
                type="button"
              >
                <span className="upload-history-file">
                  <span className="upload-selected-icon" aria-hidden="true">▤</span>
                  <span><strong>{upload.filename}</strong><small>{formatDate(upload.created_at)}</small></span>
                </span>
                <span className={statusTone(upload.status)}>{statusLabel(upload.status)}</span>
                <span className="upload-history-counts">
                  <span><strong>{upload.row_count.toLocaleString()}</strong><small>Total</small></span>
                  <span><strong>{upload.valid_rows.toLocaleString()}</strong><small>Valid</small></span>
                  <span><strong>{upload.rejected_rows.toLocaleString()}</strong><small>Rejected</small></span>
                </span>
                <span className="upload-history-arrow" aria-hidden="true">›</span>
              </button>
            ))}
          </div>
        )}
      </section>
    </AppShell>
  );
}
