"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { toast } from "react-hot-toast";
import { classifyImport, type ToastKind } from "@/lib/operation-toast";
import {
  Check,
  FileSpreadsheet,
  FileUp,
  Loader2,
  UploadCloud,
  X,
} from "lucide-react";

function showToast(result: { kind: ToastKind; message: string }) {
  if (result.kind === "success") toast.success(result.message);
  else if (result.kind === "error") toast.error(result.message);
  else toast(result.message, { icon: "⚠️" });
}

type Preview = {
  sheetName: string;
  sheetNames: string[];
  mapping: Record<string, string>;
  rows: Array<{
    rowNumber: number;
    status: string;
    values: Record<string, string>;
    errors: string[];
    changes?: Record<string, { old: string; next: string }>;
  }>;
  summary: {
    total: number;
    invalid: number;
    duplicates: number;
    existing: number;
    new: number;
  };
};

type ImportError = {
  row: number;
  rowNumber: number;
  status: "FAILED" | "SKIPPED";
  name: string;
  nmls: string;
  errorCode: string;
  error: string;
};

const ACCEPTED_EXTENSIONS = ["csv", "xlsx", "xls"];

function fileExtension(file: File) {
  return file.name.split(".").pop()?.toLowerCase() || "";
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function BrokerImportPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const [fileError, setFileError] = useState("");
  const [defaultCity, setDefaultCity] = useState("");
  const [defaultDescription, setDefaultDescription] = useState(
    "Imported broker profile pending admin completion.",
  );
  const [mapping, setMapping] = useState("{}");
  const [sheetName, setSheetName] = useState("");
  const [mode, setMode] = useState<"CREATE_ONLY" | "UPDATE_ONLY" | "UPSERT">(
    "CREATE_ONLY",
  );
  const [preview, setPreview] = useState<Preview | null>(null);
  const [message, setMessage] = useState("");
  const [importErrors, setImportErrors] = useState<ImportError[]>([]);
  const [loading, setLoading] = useState(false);

  function selectFile(candidate: File | undefined) {
    if (!candidate) return;
    if (!ACCEPTED_EXTENSIONS.includes(fileExtension(candidate))) {
      setFile(null);
      setPreview(null);
      setFileError("Unsupported file type. Please upload CSV, XLSX, or XLS.");
      return;
    }
    setFile(candidate);
    setPreview(null);
    setFileError("");
    setMessage("");
    setImportErrors([]);
  }

  function browse() {
    inputRef.current?.click();
  }

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragActive(false);
    selectFile(event.dataTransfer.files?.[0]);
  }

  async function previewImport() {
    if (!file) return;
    setLoading(true);
    setMessage("Parsing and validating workbook...");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("defaultCity", defaultCity);
      form.set("defaultDescription", defaultDescription);
      form.set("mapping", mapping);
      form.set("sheetName", sheetName);
      const response = await fetch("/api/admin/brokers/import/preview", {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Preview failed");
      setPreview(data);
      setImportErrors([]);
      if (!sheetName) setSheetName(data.sheetName);
      setMapping(JSON.stringify(data.mapping, null, 2));
      setMessage("Preview ready. Review the rows before confirming the import.");
    } catch (error) {
      setMessage(`Preview failed: ${error instanceof Error ? error.message : "Unable to parse workbook"}`);
      toast.error("Broker import failed — please fix the validation errors.");
    } finally {
      setLoading(false);
    }
  }

  async function importRows() {
    if (!file || !preview) return;
    setLoading(true);
    setMessage("");
    try {
      const form = new FormData();
      form.set("file", file);
      form.set("defaultCity", defaultCity);
      form.set("defaultDescription", defaultDescription);
      form.set("mapping", mapping);
      form.set("sheetName", sheetName);
      form.set("mode", mode);
      const response = await fetch("/api/admin/brokers/import", {
        method: "POST",
        body: form,
      });
      const data = await response.json();
      if (!response.ok) {
        toast.error(response.status === 422 ? "Broker import failed — please fix the validation errors." : "Broker import failed — please try again.");
        throw new Error(data.message || "Import failed");
      }
      setImportErrors(data.result.errors || []);
      setMessage(
        `Import complete: ${data.result.imported} created, ${data.result.updated} updated, ${data.result.skipped} skipped, ${data.result.failed} failed.`,
      );
      showToast(classifyImport(data.result));
    } catch (error) {
      setMessage(`Import failed: ${error instanceof Error ? error.message : "Unable to import workbook"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl space-y-6">
      {importErrors.length > 0 && (
        <section
          className="space-y-2 rounded border border-red-200 bg-red-50 p-5"
          role="alert"
        >
          <h2 className="font-semibold text-red-900">Import row errors</h2>
          {importErrors.map((item) => (
            <div
              key={`${item.rowNumber}-${item.errorCode}`}
              className="rounded border border-red-200 bg-white p-3 text-sm text-red-900"
            >
              <p>
                <strong>Row {item.rowNumber}</strong> · {item.status} ·{" "}
                {item.name || "Unnamed broker"} · NMLS {item.nmls || "—"}
              </p>
              <p className="mt-1">
                Error: {item.error} ({item.errorCode})
              </p>
            </div>
          ))}
        </section>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium text-muted-foreground">
            Broker Management
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-[#17213C]">
            Import Brokers
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Review and validate broker data before it reaches the database.
          </p>
          <p className="mt-2 text-sm font-medium text-[#17213C]">
            Default Subscription: FREE
            <span className="ml-2 font-normal text-[#596579]">Admin-imported brokers automatically receive the active FREE plan.</span>
          </p>
        </div>
        <Link
          href="/admin/brokers"
          className="rounded border border-[#E3E7ED] bg-white px-4 py-2 text-sm font-medium text-[#17213C] hover:bg-[#F7F9FC]"
        >
          Back to brokers
        </Link>
      </div>

      <section className="space-y-6 rounded border border-[#E3E7ED] bg-white p-5 shadow-sm sm:p-6">
        <div>
          <h2 className="text-lg font-semibold text-[#17213C]">Upload file</h2>
          <p className="mt-1 text-sm text-[#596579]">
            Select a broker data file to preview. Nothing is sent until you
            choose Preview and validate.
          </p>
        </div>

        <input
          ref={inputRef}
          type="file"
          accept=".csv,.xlsx,.xls"
          className="sr-only"
          onChange={(event) => selectFile(event.target.files?.[0])}
          aria-describedby="broker-file-help broker-file-error"
        />
        {!file ? (
          <div
            role="button"
            tabIndex={0}
            aria-label="Upload broker CSV, XLSX, or XLS file"
            onClick={browse}
            onKeyDown={(event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                browse();
              }
            }}
            onDragEnter={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              setDragActive(false);
            }}
            onDrop={handleDrop}
            className={`flex min-h-56 cursor-pointer flex-col items-center justify-center rounded border border-dashed px-6 py-10 text-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-[#4AA256] ${dragActive ? "border-[#4AA256] bg-[#EAF5EC]" : "border-[#CDD4DE] bg-[#F7F9FC] hover:border-[#4AA256] hover:bg-[#EAF5EC]/60"}`}
          >
            <UploadCloud
              className="h-10 w-10 text-[#4AA256]"
              aria-hidden="true"
            />
            <p className="mt-4 text-base font-semibold text-[#17213C]">
              {dragActive
                ? "Drop your file here"
                : "Drag & drop your broker file here"}
            </p>
            <p className="mt-1 text-sm text-[#596579]">
              or{" "}
              <span className="font-semibold text-[#4AA256]">Browse files</span>
            </p>
            <p id="broker-file-help" className="mt-4 text-xs text-[#7B8798]">
              CSV · XLSX · XLS · Maximum file size: 10 MB
            </p>
          </div>
        ) : (
          <div className="flex flex-wrap items-center gap-4 rounded border border-[#B9DDBF] bg-[#EAF5EC] p-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded bg-white text-[#4AA256]">
              <FileSpreadsheet className="h-6 w-6" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#17213C]">
                <Check className="h-4 w-4 text-[#4AA256]" aria-hidden="true" />{" "}
                <span className="break-all">{file.name}</span>
              </div>
              <p className="mt-1 text-xs uppercase tracking-wide text-[#596579]">
                {fileExtension(file).toUpperCase()} ·{" "}
                {formatFileSize(file.size)}
              </p>
            </div>
            <button
              type="button"
              onClick={browse}
              className="rounded border border-[#B9DDBF] bg-white px-3 py-2 text-sm font-semibold text-[#4AA256] hover:bg-[#F7F9FC]"
            >
              Change file
            </button>
            <button
              type="button"
              onClick={() => {
                setFile(null);
                setPreview(null);
                setFileError("");
                if (inputRef.current) inputRef.current.value = "";
              }}
              className="rounded p-2 text-[#596579] hover:bg-white hover:text-[#17213C]"
              aria-label="Remove selected file"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}
        {fileError && (
          <p
            id="broker-file-error"
            role="alert"
            className="text-sm text-red-600"
          >
            {fileError}
          </p>
        )}

        <div className="grid gap-4 border-t border-[#E3E7ED] pt-6 sm:grid-cols-2">
          <label className="space-y-1 text-sm font-medium text-[#17213C]">
            Default city for rows without City
            <input
              value={defaultCity}
              onChange={(event) => setDefaultCity(event.target.value)}
              placeholder="Houston"
              className="w-full rounded border border-[#E3E7ED] bg-[#F7F9FC] px-3 py-2.5 font-normal outline-none focus:border-[#4AA256] focus:ring-2 focus:ring-[#4AA256]/20"
            />
          </label>
          <label className="space-y-1 text-sm font-medium text-[#17213C]">
            Default description
            <input
              value={defaultDescription}
              onChange={(event) => setDefaultDescription(event.target.value)}
              className="w-full rounded border border-[#E3E7ED] bg-[#F7F9FC] px-3 py-2.5 font-normal outline-none focus:border-[#4AA256] focus:ring-2 focus:ring-[#4AA256]/20"
            />
          </label>
        </div>

        <details className="border-t border-[#E3E7ED] pt-5">
          <summary className="cursor-pointer text-sm font-semibold text-[#17213C]">
            Advanced mapping{" "}
            <span className="font-normal text-[#7B8798]">
              Optional — adjust automatic column detection
            </span>
          </summary>
          <label className="mt-4 block space-y-1 text-sm font-medium text-[#17213C]">
            Column mapping JSON
            <textarea
              value={mapping}
              onChange={(event) => setMapping(event.target.value)}
              aria-describedby="mapping-help"
              className="min-h-28 w-full rounded border border-[#E3E7ED] bg-[#F7F9FC] p-3 font-mono text-xs outline-none focus:border-[#4AA256] focus:ring-2 focus:ring-[#4AA256]/20"
            />
          </label>
          <p id="mapping-help" className="mt-1 text-xs text-[#7B8798]">
            Use canonical field names only. Unsupported columns can be omitted.
          </p>
        </details>

        <div className="flex flex-wrap items-center gap-3 border-t border-[#E3E7ED] pt-5">
          <button
            type="button"
            onClick={previewImport}
            disabled={loading || !file}
            className="inline-flex min-w-44 items-center justify-center gap-2 rounded bg-[#4AA256] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#3E8C4A] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <FileUp className="h-4 w-4" aria-hidden="true" />
            )}
            {loading ? "Parsing and validating..." : "Preview and validate"}
          </button>
          {message && (
            <p role="status" className="text-sm text-[#596579]">
              {message}
            </p>
          )}
        </div>
      </section>

      {preview && (
        <section className="space-y-4 rounded border border-[#E3E7ED] bg-white p-5 shadow-sm sm:p-6">
          <div className="grid gap-3 sm:grid-cols-5">
            {Object.entries(preview.summary).map(([key, value]) => (
              <div key={key} className="rounded bg-[#F7F9FC] p-3">
                <p className="text-xs uppercase tracking-wide text-[#7B8798]">
                  {key}
                </p>
                <p className="text-2xl font-semibold text-[#17213C]">{value}</p>
              </div>
            ))}
          </div>
          {preview.sheetNames.length > 1 && (
            <label className="block max-w-sm space-y-1 text-sm font-medium text-[#17213C]">
              Sheet
              <select
                value={sheetName}
                onChange={(event) => {
                  setSheetName(event.target.value);
                  setPreview(null);
                }}
                className="w-full rounded border border-[#E3E7ED] bg-[#F7F9FC] px-3 py-2"
              >
                <option value="">Select sheet</option>
                {preview.sheetNames.map((sheet) => (
                  <option key={sheet}>{sheet}</option>
                ))}
              </select>
            </label>
          )}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={mode}
              onChange={(event) => setMode(event.target.value as typeof mode)}
              className="rounded border border-[#E3E7ED] bg-white px-3 py-2 text-sm text-[#17213C]"
            >
              <option value="CREATE_ONLY">Create only</option>
              <option value="UPDATE_ONLY">Update only</option>
              <option value="UPSERT">Create + update</option>
            </select>
            <button
              type="button"
              onClick={importRows}
              disabled={loading}
              className="rounded border border-[#4AA256] px-4 py-2 text-sm font-semibold text-[#4AA256] hover:bg-[#EAF5EC] disabled:opacity-50"
            >
              Confirm import
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[#E3E7ED] text-[#596579]">
                  <th className="p-2">Row</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Name</th>
                  <th className="p-2">NMLS</th>
                  <th className="p-2">Phone</th>
                  <th className="p-2">Email</th>
                  <th className="p-2">Office address</th>
                  <th className="p-2">City</th>
                  <th className="p-2">State</th>
                  <th className="p-2">ZIP</th>
                  <th className="p-2">Errors/changes</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.map((row) => (
                  <tr
                    key={row.rowNumber}
                    className="border-b border-[#E3E7ED] align-top"
                  >
                    <td className="p-2">{row.rowNumber}</td>
                    <td className="p-2">{row.status}</td>
                    <td className="p-2">{row.values.displayName || ""}</td>
                    <td className="p-2">{row.values.nmls || ""}</td>
                    <td className="p-2">{row.values.phone || ""}</td>
                    <td className="p-2">{row.values.email || ""}</td>
                    <td className="p-2">{row.values.officeAddress || ""}</td>
                    <td className="p-2">{row.values.city || ""}</td>
                    <td className="p-2">{row.values.state || ""}</td>
                    <td className="p-2">{row.values.pinCode || ""}</td>
                    <td className="p-2 text-xs text-red-600">
                      {row.errors.join("; ") ||
                        Object.keys(row.changes || {}).join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </main>
  );
}
