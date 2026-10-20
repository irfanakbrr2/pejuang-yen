"use client";
/* eslint-disable react-hooks/set-state-in-effect, @typescript-eslint/no-explicit-any, react/no-unescaped-entities */

import { useState, useEffect } from "react";
import {
  KeyRound,
  Plus,
  Copy,
  Check,
  Trash2,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";
import { PageHeader } from "@/components/ui/dashboard-chrome";

interface ApiKey {
  id: string;
  name: string;
  key_prefix: string;
  created_at: string;
  last_used_at: string | null;
  expires_at: string | null;
  is_active: number;
  request_count: number;
}

interface NewKeyResult {
  id: string;
  name: string;
  key: string;
  key_prefix: string;
  created_at: string;
}

function fmtDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("id-ID", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AdminApiKeysPage() {
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [newKeyResult, setNewKeyResult] = useState<NewKeyResult | null>(null);
  const [copied, setCopied] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [form, setForm] = useState({ name: "", expires_at: "" });
  const [revoking, setRevoking] = useState<string | null>(null);

  async function loadKeys() {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/analytics-keys", { credentials: "include" });
      const d = await res.json();
      if (d.success) setKeys(d.data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { loadKeys(); }, []);

  async function handleGenerate() {
    if (!form.name.trim()) {
      toast.error("Nama API key wajib diisi");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/analytics-keys", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: form.name.trim(), expires_at: form.expires_at || undefined }),
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error);
      setNewKeyResult(d.data);
      setForm({ name: "", expires_at: "" });
      await loadKeys();
    } catch (e: any) {
      toast.error(e.message || "Gagal membuat API key");
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevoke(id: string, name: string) {
    if (!confirm(`Revoke API key "${name}"? Semua request dengan key ini akan ditolak.`)) return;
    setRevoking(id);
    try {
      const res = await fetch(`/api/admin/analytics-keys/${id}`, {
        method: "DELETE",
        credentials: "include",
      });
      const d = await res.json();
      if (!d.success) throw new Error(d.error);
      toast.success(`Key "${name}" berhasil direvoke`);
      await loadKeys();
    } catch (e: any) {
      toast.error(e.message || "Gagal revoke key");
    } finally {
      setRevoking(null);
    }
  }

  async function handleCopy(text: string) {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function closeNewKeyModal() {
    setNewKeyResult(null);
    setShowModal(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Developer"
        title="API Keys"
        description="Kelola akses ke Analytics API untuk tools AI eksternal (ChatGPT, Claude, dll)"
        actions={
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={loadKeys} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
          <Button onClick={() => { setShowModal(true); setNewKeyResult(null); }} size="sm">
            <Plus className="h-4 w-4 mr-2" />
            Generate Key
          </Button>
        </div>
        }
      />

      {/* Docs link */}
      <div className="glass-card flex items-center gap-2 text-sm text-indigo-600 rounded-2xl px-4 py-2.5 w-fit">
        <ExternalLink className="h-4 w-4 flex-shrink-0" />
        <span>Dokumentasi API tersedia di</span>
        <a
          href="/api/analytics/docs"
          target="_blank"
          rel="noopener noreferrer"
          className="underline font-medium"
        >
          /api/analytics/docs
        </a>
      </div>

      {/* Keys table */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-gray-400" />
            API Keys ({keys.filter(k => k.is_active).length} aktif)
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-8 text-center text-gray-400 text-sm">Memuat…</div>
          ) : keys.length === 0 ? (
            <div className="p-8 text-center text-gray-400 text-sm">
              Belum ada API key. Klik "Generate Key" untuk membuat yang pertama.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 text-xs text-gray-500 uppercase tracking-wide">
                    <th className="text-left px-6 py-3 font-medium">Nama</th>
                    <th className="text-left px-6 py-3 font-medium">Prefix</th>
                    <th className="text-left px-6 py-3 font-medium">Status</th>
                    <th className="text-left px-6 py-3 font-medium">Req Count</th>
                    <th className="text-left px-6 py-3 font-medium">Terakhir Digunakan</th>
                    <th className="text-left px-6 py-3 font-medium">Berlaku Hingga</th>
                    <th className="text-left px-6 py-3 font-medium">Dibuat</th>
                    <th className="px-6 py-3" />
                  </tr>
                </thead>
                <tbody>
                  {keys.map(k => {
                    const expired = k.expires_at && k.expires_at < new Date().toISOString();
                    const active = k.is_active && !expired;
                    return (
                      <tr key={k.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="px-6 py-3 font-medium text-gray-900">{k.name}</td>
                        <td className="px-6 py-3">
                          <code className="text-xs bg-gray-100 px-2 py-0.5 rounded font-mono">
                            {k.key_prefix}…
                          </code>
                        </td>
                        <td className="px-6 py-3">
                          {active ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-emerald-50 text-emerald-700 font-medium">
                              <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                              Aktif
                            </span>
                          ) : expired ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-amber-50 text-amber-700 font-medium">
                              Expired
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full bg-red-50 text-red-700 font-medium">
                              Revoked
                            </span>
                          )}
                        </td>
                        <td className="px-6 py-3 text-gray-600">{k.request_count.toLocaleString()}</td>
                        <td className="px-6 py-3 text-gray-500 text-xs">{fmtDate(k.last_used_at)}</td>
                        <td className="px-6 py-3 text-gray-500 text-xs">{fmtDate(k.expires_at)}</td>
                        <td className="px-6 py-3 text-gray-500 text-xs">{fmtDate(k.created_at)}</td>
                        <td className="px-6 py-3">
                          {k.is_active ? (
                            <Button
                              variant="danger"
                              size="sm"
                              className="h-7 text-xs"
                              onClick={() => handleRevoke(k.id, k.name)}
                              disabled={revoking === k.id}
                            >
                              {revoking === k.id ? (
                                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <Trash2 className="h-3.5 w-3.5" />
                              )}
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Rate limit info */}
      <p className="text-xs text-gray-400">
        Rate limit: 60 request/menit per API key. Key yang sudah direvoke tidak dapat diaktifkan kembali — buat key baru jika diperlukan.
      </p>

      {/* Generate modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
            {newKeyResult ? (
              /* Step 2 — show key ONCE */
              <div className="p-6 space-y-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Check className="h-5 w-5 text-emerald-600" />
                  </div>
                  <div>
                    <h2 className="font-semibold text-gray-900">API Key Berhasil Dibuat</h2>
                    <p className="text-sm text-gray-500">{newKeyResult.name}</p>
                  </div>
                </div>

                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 flex gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-xs text-amber-800">
                    <strong>Simpan key ini sekarang.</strong> Key tidak akan ditampilkan lagi setelah modal ini ditutup.
                  </p>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">API Key</label>
                  <div className="mt-1.5 flex items-center gap-2">
                    <code className="flex-1 text-xs bg-gray-900 text-green-400 px-3 py-2.5 rounded-lg font-mono break-all">
                      {newKeyResult.key}
                    </code>
                    <button
                      onClick={() => handleCopy(newKeyResult.key)}
                      className="flex-shrink-0 p-2 rounded-lg bg-gray-100 hover:bg-gray-200 transition-colors"
                    >
                      {copied ? (
                        <Check className="h-4 w-4 text-emerald-600" />
                      ) : (
                        <Copy className="h-4 w-4 text-gray-600" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase tracking-wide">Cara Penggunaan</label>
                  <div className="mt-1.5 bg-gray-900 text-gray-300 text-xs px-3 py-2.5 rounded-lg font-mono">
                    Authorization: Bearer {newKeyResult.key}
                  </div>
                </div>

                <Button className="w-full" onClick={closeNewKeyModal}>
                  Sudah Disimpan, Tutup
                </Button>
              </div>
            ) : (
              /* Step 1 — form */
              <div className="p-6 space-y-4">
                <h2 className="font-semibold text-gray-900 text-lg">Generate API Key</h2>

                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Nama Key <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="Contoh: ChatGPT Plugin, Claude Project"
                    value={form.name}
                    onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div>
                  <label className="text-sm font-medium text-gray-700">
                    Berlaku Hingga <span className="text-gray-400 text-xs font-normal">(opsional — kosong = tidak ada batas)</span>
                  </label>
                  <input
                    type="date"
                    value={form.expires_at}
                    onChange={e => setForm(f => ({ ...f, expires_at: e.target.value }))}
                    className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                <div className="flex gap-3 pt-1">
                  <Button
                    variant="secondary"
                    className="flex-1"
                    onClick={() => { setShowModal(false); setForm({ name: "", expires_at: "" }); }}
                    disabled={generating}
                  >
                    Batal
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={handleGenerate}
                    disabled={generating || !form.name.trim()}
                  >
                    {generating ? (
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <KeyRound className="h-4 w-4 mr-2" />
                    )}
                    Generate
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
