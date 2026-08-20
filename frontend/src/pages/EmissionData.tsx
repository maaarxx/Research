import { useEffect, useRef, useState } from 'react'
import { apiDelete, apiGet, apiPost, apiPostForm } from '../lib/apiClient'

// ─── Types ────────────────────────────────────────────────────────────────────

interface PreviewRow {
  row: number
  year: number | null
  electricity: number | null
  transportation: number | null
  waste: number | null
  errors: string[]
  valid: boolean
}

interface UploadPreview {
  rows: PreviewRow[]
  validCount: number
  invalidCount: number
}

interface EmissionRecord {
  id: string
  year: number
  electricity_emissions: number
  transportation_emissions: number
  waste_emissions: number
  total_emissions: number
  created_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmt(v: number | null | undefined): string {
  if (v == null) return '—'
  return Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function EmissionData() {
  const [preview, setPreview] = useState<UploadPreview | null>(null)
  const [records, setRecords] = useState<EmissionRecord[]>([])
  const [loadingRecords, setLoadingRecords] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [successMsg, setSuccessMsg] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  // ── Load saved records ───────────────────────────────────────────────────
  async function loadRecords() {
    setLoadingRecords(true)
    try {
      const data = await apiGet<{ records: EmissionRecord[] }>('/api/emissions')
      setRecords(data.records)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load records')
    } finally {
      setLoadingRecords(false)
    }
  }

  useEffect(() => { loadRecords() }, [])

  // ── Upload a file ────────────────────────────────────────────────────────
  async function handleFile(file: File) {
    setError(null)
    setSuccessMsg(null)
    setPreview(null)

    const ext = file.name.split('.').pop()?.toLowerCase()
    if (!['csv', 'xlsx', 'xls'].includes(ext ?? '')) {
      setError('Only CSV and XLSX files are supported.')
      return
    }

    setUploading(true)
    const form = new FormData()
    form.append('file', file)

    try {
      const result = await apiPostForm<UploadPreview>('/api/emissions/upload', form)
      setPreview(result)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  // ── Confirm & save ───────────────────────────────────────────────────────
  async function handleConfirm() {
    if (!preview) return
    const validRows = preview.rows.filter((r) => r.valid)
    if (validRows.length === 0) {
      setError('No valid rows to save.')
      return
    }

    setSaving(true)
    setError(null)

    try {
      const result = await apiPost<{ saved: number }>('/api/emissions/confirm', {
        rows: validRows,
      })
      setSuccessMsg(
        `✓ ${result.saved} record${result.saved !== 1 ? 's' : ''} saved successfully.`,
      )
      setPreview(null)
      if (fileRef.current) fileRef.current.value = ''
      await loadRecords()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save records')
    } finally {
      setSaving(false)
    }
  }

  // ── Delete a record ──────────────────────────────────────────────────────
  async function handleDelete(id: string) {
    if (!window.confirm('Delete this emission record? This cannot be undone.')) return
    setDeletingId(id)
    setError(null)
    try {
      await apiDelete(`/api/emissions/${id}`)
      setRecords((prev) => prev.filter((r) => r.id !== id))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to delete record')
    } finally {
      setDeletingId(null)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-gray-900">Emission Data</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Upload historical emission records. Required columns:{' '}
          <code className="bg-gray-100 px-1 rounded text-xs font-mono">Year</code>{' '}
          <code className="bg-gray-100 px-1 rounded text-xs font-mono">Electricity</code>{' '}
          <code className="bg-gray-100 px-1 rounded text-xs font-mono">Transportation</code>{' '}
          <code className="bg-gray-100 px-1 rounded text-xs font-mono">Waste</code>{' '}
          (values in tCO₂e).
        </p>
      </div>

      {/* Alerts */}
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {successMsg && (
        <div className="mb-4 bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-sm text-emerald-700">
          {successMsg}
        </div>
      )}

      {/* ── Upload drop zone (shown when no preview is active) ─────────────── */}
      {!preview && (
        <div
          id="upload-dropzone"
          className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors mb-8 ${
            dragOver
              ? 'border-emerald-400 bg-emerald-50'
              : 'border-gray-300 bg-white hover:border-emerald-300 hover:bg-gray-50'
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            const file = e.dataTransfer.files[0]
            if (file) handleFile(file)
          }}
          onClick={() => fileRef.current?.click()}
        >
          <div className="text-4xl mb-3 select-none">📁</div>
          <p className="text-sm font-medium text-gray-700">
            Drag &amp; drop your file here, or{' '}
            <span className="text-emerald-600 underline">browse</span>
          </p>
          <p className="text-xs text-gray-400 mt-1">CSV or XLSX — max 10 MB</p>

          {uploading && (
            <div className="mt-5 flex items-center justify-center gap-2 text-sm text-gray-500">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600" />
              Parsing &amp; validating…
            </div>
          )}

          <input
            ref={fileRef}
            id="file-input"
            type="file"
            accept=".csv,.xlsx,.xls"
            className="hidden"
            onChange={(e) => {
              if (e.target.files?.[0]) handleFile(e.target.files[0])
            }}
          />
        </div>
      )}

      {/* ── Preview table (shown after upload) ────────────────────────────── */}
      {preview && (
        <div className="mb-8 bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
          {/* Preview header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
            <div>
              <h2 className="text-sm font-semibold text-gray-900">Preview</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                <span className="text-emerald-600 font-medium">{preview.validCount} valid</span>
                {preview.invalidCount > 0 && (
                  <>
                    ,{' '}
                    <span className="text-red-500 font-medium">
                      {preview.invalidCount} invalid
                    </span>{' '}
                    (will be skipped)
                  </>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => {
                  setPreview(null)
                  if (fileRef.current) fileRef.current.value = ''
                }}
                className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                id="confirm-save-btn"
                onClick={handleConfirm}
                disabled={preview.validCount === 0 || saving}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 transition-colors"
              >
                {saving && (
                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                )}
                {saving
                  ? 'Saving…'
                  : `Confirm & Save ${preview.validCount} record${preview.validCount !== 1 ? 's' : ''}`}
              </button>
            </div>
          </div>

          {/* Preview rows */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-2.5 text-left">#</th>
                  <th className="px-4 py-2.5 text-left">Year</th>
                  <th className="px-4 py-2.5 text-right">Electricity</th>
                  <th className="px-4 py-2.5 text-right">Transportation</th>
                  <th className="px-4 py-2.5 text-right">Waste</th>
                  <th className="px-4 py-2.5 text-left">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {preview.rows.map((row) => (
                  <tr key={row.row} className={row.valid ? '' : 'bg-red-50'}>
                    <td className="px-4 py-2.5 text-gray-400 text-xs">{row.row}</td>
                    <td className="px-4 py-2.5 font-medium">
                      {row.year ?? <span className="text-red-400">—</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {fmt(row.electricity)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">
                      {fmt(row.transportation)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums">{fmt(row.waste)}</td>
                    <td className="px-4 py-2.5">
                      {row.valid ? (
                        <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                          ✓ Valid
                        </span>
                      ) : (
                        <span
                          className="inline-flex items-center gap-1 text-xs font-medium text-red-700 bg-red-50 px-2 py-0.5 rounded-full cursor-help"
                          title={row.errors.join('\n')}
                        >
                          ✗ {row.errors[0]}
                          {row.errors.length > 1 && ` (+${row.errors.length - 1})`}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Saved records table ────────────────────────────────────────────── */}
      <div>
        <h2 className="text-base font-semibold text-gray-900 mb-3">Saved Records</h2>

        {loadingRecords ? (
          <p className="text-sm text-gray-400">Loading…</p>
        ) : records.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-xl p-8 text-center text-sm text-gray-400">
            <p className="text-2xl mb-2">📭</p>
            <p>No records yet. Upload a file above to get started.</p>
          </div>
        ) : (
          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-xs font-medium text-gray-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left">Year</th>
                    <th className="px-4 py-3 text-right">Electricity (tCO₂e)</th>
                    <th className="px-4 py-3 text-right">Transportation (tCO₂e)</th>
                    <th className="px-4 py-3 text-right">Waste (tCO₂e)</th>
                    <th className="px-4 py-3 text-right font-semibold">Total (tCO₂e)</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {records.map((rec) => (
                    <tr key={rec.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 font-semibold">{rec.year}</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {fmt(rec.electricity_emissions)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {fmt(rec.transportation_emissions)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {fmt(rec.waste_emissions)}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums font-semibold">
                        {fmt(rec.total_emissions)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => handleDelete(rec.id)}
                          disabled={deletingId === rec.id}
                          className="text-xs text-gray-400 hover:text-red-600 disabled:opacity-40 transition-colors"
                        >
                          {deletingId === rec.id ? '…' : 'Delete'}
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Totals row */}
                {records.length > 0 && (
                  <tfoot className="bg-gray-50 border-t border-gray-200">
                    <tr className="text-sm font-semibold text-gray-700">
                      <td className="px-4 py-3">All years</td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {fmt(records.reduce((s, r) => s + Number(r.electricity_emissions), 0))}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {fmt(records.reduce((s, r) => s + Number(r.transportation_emissions), 0))}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {fmt(records.reduce((s, r) => s + Number(r.waste_emissions), 0))}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {fmt(records.reduce((s, r) => s + Number(r.total_emissions), 0))}
                      </td>
                      <td />
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
