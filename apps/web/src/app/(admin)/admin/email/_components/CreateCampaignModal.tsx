"use client";

import { useState, useMemo } from "react";
import { Megaphone, X, Eye, Save, Send, Users, Code2, Inbox, AlertTriangle, ChevronDown, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { inputClass } from "./types";
import { AIFieldButton } from "@/components/ui/AIFieldButton";
import { AIBundleButton } from "@/components/ui/AIBundleButton";

const SEGMENTS = [
  { value: "all",        label: "Semua Subscriber",   desc: "Semua email yang subscribed" },
  { value: "paid",       label: "Pengguna Berbayar",  desc: "Yang sudah beli kelas" },
  { value: "free",       label: "Pengguna Gratis",    desc: "Yang belum beli kelas" },
  { value: "employee",   label: "Karyawan",           desc: "Role: karyawan" },
  { value: "business",   label: "Pemilik Bisnis",     desc: "Role: pebisnis" },
  { value: "student",    label: "Mahasiswa",          desc: "Role: mahasiswa" },
  { value: "creator",    label: "Kreator Konten",     desc: "Role: kreator" },
  { value: "freelancer", label: "Freelancer",         desc: "Role: freelancer" },
];

const SUPPORTED_BROADCAST_VARS = new Set([
  'first_name',
  'role',
  'dashboard_url',
  'support_email',
  'support_url',
  'community_whatsapp_url',
  'unsubscribe_url',
]);

const BROADCAST_VAR_DOCS = [
  { name: '{{first_name}}',      desc: 'Nama depan penerima' },
  { name: '{{role}}',            desc: 'Role: employee, business, student, creator, freelancer' },
  { name: '{{dashboard_url}}',   desc: 'Link dashboard user (app.pejuangyen.com/dashboard)' },
  { name: '{{support_url}}',     desc: 'Link grup WhatsApp komunitas untuk pertanyaan' },
  { name: '{{community_whatsapp_url}}', desc: 'Alias link grup WhatsApp komunitas' },
  { name: '{{unsubscribe_url}}', desc: 'Link berhenti berlangganan (wajib ada di footer)' },
];

function detectUnsupportedVars(subject: string, content: string): string[] {
  const combined = subject + ' ' + content;
  const found = [...combined.matchAll(/\{\{(\w+)\}\}/g)].map((m) => m[1]);
  return [...new Set(found)].filter((v) => !SUPPORTED_BROADCAST_VARS.has(v));
}

type PanelTab = "compose" | "preview";

interface Props {
  onClose: () => void;
  onSaved: () => void;
}

export function CreateCampaignModal({ onClose, onSaved }: Props) {
  const [activeTab, setActiveTab] = useState<PanelTab>("compose");
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [segment, setSegment] = useState("all");
  const [content, setContent] = useState("");
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [varPanelOpen, setVarPanelOpen] = useState(false);

  const unsupportedVars = useMemo(
    () => detectUnsupportedVars(subject, content),
    [subject, content]
  );

  const validate = (blockOnUnsupportedVars = false) => {
    if (!name.trim()) { toast.error("Nama campaign wajib diisi"); return false; }
    if (!subject.trim()) { toast.error("Subject email wajib diisi"); return false; }
    if (!content.trim()) { toast.error("Konten email wajib diisi"); return false; }
    if (blockOnUnsupportedVars && unsupportedVars.length > 0) {
      toast.error(
        `Campaign mengandung variable yang tidak didukung: ${unsupportedVars.map(v => `{{${v}}}`).join(', ')}. Hapus dulu sebelum mengirim.`
      );
      return false;
    }
    return true;
  };

  const handleSaveDraft = async () => {
    if (!validate(false)) return;
    setSaving(true);
    try {
      const res = await fetch("/api/admin/email/campaigns", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, subject, content, segment }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Draft campaign berhasil disimpan");
        onSaved();
        onClose();
      } else {
        toast.error(data.error || "Gagal menyimpan draft");
      }
    } catch {
      toast.error("Terjadi kesalahan koneksi");
    } finally {
      setSaving(false);
    }
  };

  const handleSendNow = async () => {
    if (!validate(true)) return;
    setConfirmOpen(true);
  };

  const handleConfirmSend = async () => {
    setConfirmOpen(false);
    setSending(true);
    try {
      const createRes = await fetch("/api/admin/email/campaigns", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, subject, content, segment }),
      });
      const createData = await createRes.json();
      if (!createData.success) {
        toast.error(createData.error || "Gagal membuat campaign");
        return;
      }

      const sendRes = await fetch(`/api/admin/email/campaigns/${createData.data.id}/send`, {
        method: "POST",
        credentials: "include",
      });
      const sendData = await sendRes.json();
      if (sendData.success) {
        toast.success(sendData.data?.message || "Campaign berhasil dikirim!");
        onSaved();
        onClose();
      } else {
        toast.error(sendData.error || "Gagal mengirim campaign");
      }
    } catch {
      toast.error("Terjadi kesalahan koneksi");
    } finally {
      setSending(false);
    }
  };

  const handlePreview = () => {
    if (!content.trim()) {
      toast.error("Isi konten email terlebih dahulu");
      return;
    }
    setPreviewHtml(content);
    setActiveTab("preview");
  };

  const selectedSegment = SEGMENTS.find((s) => s.value === segment);
  const isLoading = saving || sending;
  const aiContext = {
    campaign_name: name,
    segment,
    segment_label: selectedSegment?.label,
    allowed_variables: [
      "{{first_name}}",
      "{{role}}",
      "{{dashboard_url}}",
      "{{support_url}}",
      "{{community_whatsapp_url}}",
      "{{unsubscribe_url}}",
    ],
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[3px] z-40" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 flex flex-col bg-white shadow-2xl w-full max-w-[780px]">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-black/[0.06] shrink-0">
          <div className="w-8 h-8 rounded-lg bg-[#F7E8E8] flex items-center justify-center shrink-0">
            <Megaphone size={14} className="text-[#8B1414]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-warm-black leading-tight">Buat Broadcast Campaign</p>
            <p className="text-[11px] text-[rgba(12,12,10,0.4)] mt-0.5">Tulis dan kirim email ke subscriber yang dipilih</p>
          </div>
          <AIBundleButton
            label="Generate email"
            entityType="email_campaign"
            fields={["subject", "content"]}
            context={aiContext}
            disabled={isLoading}
            onFill={(fields) => {
              if (fields.subject) setSubject(fields.subject);
              if (fields.content) {
                setContent(fields.content);
                setPreviewHtml(null);
              }
            }}
          />
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[rgba(12,12,10,0.4)] hover:bg-gray-100 hover:text-warm-black transition-colors shrink-0"
            aria-label="Tutup"
          >
            <X size={16} />
          </button>
        </div>

        {/* ── Tab Navigation ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-0 px-5 border-b border-black/[0.06] shrink-0 bg-[#FAFAFA]">
          {(["compose", "preview"] as PanelTab[]).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={cn(
                "flex items-center gap-1.5 px-4 py-2.5 text-xs font-semibold border-b-2 transition-all duration-150 -mb-px",
                activeTab === tab
                  ? "border-[#8B1414] text-[#8B1414]"
                  : "border-transparent text-[rgba(12,12,10,0.45)] hover:text-warm-black"
              )}
            >
              {tab === "compose" ? <Code2 size={12} /> : <Inbox size={12} />}
              {tab === "compose" ? "Tulis Email" : "Pratinjau"}
              {tab === "preview" && previewHtml && (
                <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-[#8B1414] inline-block" />
              )}
            </button>
          ))}
        </div>

        {/* ── Body ──────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* Compose Tab */}
          {activeTab === "compose" && (
            <div className="p-5 flex flex-col gap-5">

              {/* Row: Name + Subject */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[11px] font-semibold text-[rgba(12,12,10,0.45)] uppercase tracking-wider">
                    Nama Campaign
                  </label>
                  <input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className={inputClass}
                    placeholder="Contoh: Newsletter Mei 2026"
                    disabled={isLoading}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-semibold text-[rgba(12,12,10,0.45)] uppercase tracking-wider">
                      Subject Email
                    </label>
                    <AIFieldButton
                      field="subject"
                      fieldName="Subject Email"
                      entityType="email_campaign"
                      context={aiContext}
                      disabled={isLoading}
                      onFill={setSubject}
                    />
                  </div>
                  <input
                    value={subject}
                    onChange={(e) => setSubject(e.target.value)}
                    className={inputClass}
                    placeholder="Buat singkat dan menarik..."
                    disabled={isLoading}
                  />
                </div>
              </div>

              {/* Segment Selector */}
              <div className="flex flex-col gap-2">
                <label className="text-[11px] font-semibold text-[rgba(12,12,10,0.45)] uppercase tracking-wider">
                  Segmen Penerima
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {SEGMENTS.map((s) => (
                    <button
                      key={s.value}
                      onClick={() => setSegment(s.value)}
                      disabled={isLoading}
                      className={cn(
                        "flex flex-col items-start gap-0.5 px-3 py-2.5 rounded-xl border text-left transition-all duration-150",
                        segment === s.value
                          ? "border-[#8B1414] bg-[#F7E8E8] ring-1 ring-[#8B1414]/20"
                          : "border-[rgba(12,12,10,0.1)] bg-white hover:border-[rgba(12,12,10,0.2)]"
                      )}
                    >
                      <span className={cn("text-xs font-semibold leading-tight", segment === s.value ? "text-[#8B1414]" : "text-warm-black")}>
                        {s.label}
                      </span>
                      <span className="text-[10px] text-[rgba(12,12,10,0.4)] leading-tight">{s.desc}</span>
                    </button>
                  ))}
                </div>
                {selectedSegment && (
                  <div className="flex items-center gap-1.5 text-xs text-[rgba(12,12,10,0.5)]">
                    <Users size={12} />
                    <span>Email akan dikirim ke segmen: <strong className="text-warm-black">{selectedSegment.label}</strong></span>
                  </div>
                )}
              </div>

              {/* ── Variable Reference Panel ─────────────────────────────── */}
              <div className="rounded-xl border border-[rgba(12,12,10,0.08)] overflow-hidden">
                <button
                  onClick={() => setVarPanelOpen((v) => !v)}
                  className="w-full flex items-center justify-between px-4 py-3 bg-[#FAFAFA] hover:bg-[#F5F5F5] transition-colors text-left"
                >
                  <span className="text-xs font-semibold text-[rgba(12,12,10,0.6)]">
                    Variables yang tersedia di broadcast
                  </span>
                  {varPanelOpen ? (
                    <ChevronDown size={14} className="text-[rgba(12,12,10,0.4)]" />
                  ) : (
                    <ChevronRight size={14} className="text-[rgba(12,12,10,0.4)]" />
                  )}
                </button>
                {varPanelOpen && (
                  <div className="px-4 py-3 flex flex-col gap-2 bg-white border-t border-[rgba(12,12,10,0.06)]">
                    {BROADCAST_VAR_DOCS.map((v) => (
                      <div key={v.name} className="flex items-start gap-3">
                        <code className="shrink-0 text-[11px] font-mono bg-[#F3F4F6] text-[#111827] px-1.5 py-0.5 rounded">
                          {v.name}
                        </code>
                        <span className="text-[12px] text-[rgba(12,12,10,0.55)] leading-tight pt-0.5">{v.desc}</span>
                      </div>
                    ))}
                    <p className="text-[11px] text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mt-1 leading-relaxed">
                      Jangan gunakan variable lain seperti{' '}
                      <code className="font-mono text-[10px]">{'{{course_name}}'}</code>,{' '}
                      <code className="font-mono text-[10px]">{'{{checkout_url}}'}</code>, atau{' '}
                      <code className="font-mono text-[10px]">{'{{progress_percentage}}'}</code>{' '}
                      — variable tersebut tidak didukung dan akan tampil sebagai teks mentah di email penerima.
                    </p>
                  </div>
                )}
              </div>

              {/* ── Unsupported Variable Warning ─────────────────────────── */}
              {unsupportedVars.length > 0 && (
                <div className="flex items-start gap-3 px-4 py-3 bg-red-50 border border-red-200 rounded-xl">
                  <AlertTriangle size={15} className="text-red-500 shrink-0 mt-0.5" />
                  <div className="flex flex-col gap-1">
                    <p className="text-[12px] font-semibold text-red-700">Variable tidak didukung ditemukan</p>
                    <p className="text-[11px] text-red-600 leading-relaxed">
                      Email ini mengandung variable yang tidak akan diganti dan akan tampil sebagai teks mentah:{' '}
                      {unsupportedVars.map((v) => (
                        <code key={v} className="font-mono bg-red-100 px-1 py-0.5 rounded text-[10px] mr-1">
                          {`{{${v}}}`}
                        </code>
                      ))}
                    </p>
                    <p className="text-[11px] text-red-500">Hapus variable di atas sebelum mengirim.</p>
                  </div>
                </div>
              )}

              {/* Content Editor */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-semibold text-[rgba(12,12,10,0.45)] uppercase tracking-wider">
                      Konten Email (HTML)
                    </label>
                    <AIFieldButton
                      field="content"
                      fieldName="Konten Email"
                      entityType="email_campaign"
                      outputFormat="html"
                      context={aiContext}
                      disabled={isLoading}
                      onFill={(nextContent) => {
                        setContent(nextContent);
                        setPreviewHtml(null);
                      }}
                    />
                  </div>
                </div>
                <textarea
                  value={content}
                  onChange={(e) => { setContent(e.target.value); setPreviewHtml(null); }}
                  rows={18}
                  className={cn(
                    inputClass,
                    "font-mono text-[12px] resize-y min-h-[300px] leading-relaxed bg-[#0D0D0D] text-[#E8E8E8] border-[#333] placeholder-[#555] focus:border-[#8B1414]"
                  )}
                  placeholder={"<!DOCTYPE html>\n<html>\n  <body>\n    <p>Hei {{first_name}},</p>\n    ...\n    <a href=\"{{unsubscribe_url}}\">Berhenti berlangganan</a>\n  </body>\n</html>"}
                  spellCheck={false}
                  disabled={isLoading}
                />
                <p className="text-[11px] text-[rgba(12,12,10,0.4)]">
                  Pastikan footer email mengandung{' '}
                  <code className="font-mono bg-gray-100 px-1 py-0.5 rounded text-[10px]">{'{{unsubscribe_url}}'}</code>
                  {' '}untuk kepatuhan anti-spam.
                </p>
              </div>
            </div>
          )}

          {/* Preview Tab */}
          {activeTab === "preview" && (
            <div className="flex flex-col h-full">
              {previewHtml ? (
                <div className="flex-1 bg-gray-100 p-4 overflow-auto">
                  <div className="mx-auto max-w-[640px] rounded-xl overflow-hidden shadow-md border border-black/[0.08] bg-white">
                    <div className="bg-white px-4 py-2.5 border-b border-black/[0.06] flex items-center gap-2">
                      <div className="flex gap-1.5">
                        <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                        <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                        <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                      </div>
                      <p className="text-xs text-[rgba(12,12,10,0.4)] flex-1 text-center font-mono truncate">
                        {subject || "Tanpa subject"}
                      </p>
                    </div>
                    <iframe
                      srcDoc={previewHtml}
                      className="w-full"
                      style={{ height: "600px" }}
                      title="Email preview"
                      sandbox="allow-same-origin"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                    <Eye size={22} className="text-[rgba(12,12,10,0.25)]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-warm-black">Belum ada pratinjau</p>
                    <p className="text-xs text-[rgba(12,12,10,0.45)] mt-1 max-w-[240px]">
                      Kembali ke tab &ldquo;Tulis Email&rdquo; lalu klik &ldquo;Pratinjau&rdquo;
                    </p>
                  </div>
                  <Button variant="secondary" size="sm" onClick={() => setActiveTab("compose")}>
                    Kembali ke Editor
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-black/[0.06] bg-white shrink-0">
          {activeTab === "compose" ? (
            <Button
              variant="secondary"
              size="sm"
              onClick={handlePreview}
              disabled={isLoading || !content.trim()}
            >
              <Eye size={13} />
              {previewHtml ? "Refresh Preview" : "Pratinjau"}
            </Button>
          ) : (
            <Button variant="secondary" size="sm" onClick={() => setActiveTab("compose")}>
              <Code2 size={13} />
              Kembali Edit
            </Button>
          )}

          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleSaveDraft} loading={saving} disabled={sending}>
              <Save size={13} />
              Simpan Draft
            </Button>
            <Button
              onClick={handleSendNow}
              loading={sending}
              disabled={saving}
              size="sm"
              className={cn(unsupportedVars.length > 0 && "ring-2 ring-red-300")}
            >
              <Send size={13} />
              Kirim Sekarang
            </Button>
          </div>
        </div>
      </div>

      {/* Confirm Dialog */}
      <ConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        title={`Kirim campaign ke ${selectedSegment?.label}?`}
        description={`Campaign "${name}" akan dikirim ke semua subscriber di segmen "${selectedSegment?.label}". Tindakan ini tidak bisa dibatalkan.`}
        confirmLabel="Ya, Kirim Sekarang"
        cancelLabel="Batal"
        loading={sending}
        onConfirm={handleConfirmSend}
      />
    </>
  );
}
