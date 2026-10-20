"use client";

import { useState } from "react";
import { FileText, X, Eye, Save, RotateCcw, Send, Code2, Inbox } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";
import { inputClass } from "./types";
import type { TemplateStep } from "./types";

interface Props {
  step: TemplateStep;
  seqName: string;
  onClose: () => void;
  onSaved: () => void;
}

type PanelTab = "edit" | "preview";

export function TemplateEditor({ step, seqName, onClose, onSaved }: Props) {
  const [activeTab, setActiveTab] = useState<PanelTab>("edit");
  const [editSubject, setEditSubject] = useState(step.subject);
  const [editPreviewText, setEditPreviewText] = useState(step.previewText || "");
  const [editCtaUrl, setEditCtaUrl] = useState(step.ctaUrl);
  const [editContent, setEditContent] = useState(step.content || "");
  const [useCustomContent, setUseCustomContent] = useState(step.hasCustomContent);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [testEmailTo, setTestEmailTo] = useState("");
  const [sendingTest, setSendingTest] = useState(false);

  const handleFetchPreview = async () => {
    if (useCustomContent) {
      setPreviewHtml(editContent || null);
      setActiveTab("preview");
      return;
    }
    setLoadingPreview(true);
    try {
      const qs = editPreviewText.trim() ? `?previewText=${encodeURIComponent(editPreviewText.trim())}` : "";
      const res = await fetch(`/api/admin/email/templates/${step.id}/preview${qs}`, { credentials: "include" });
      const data = await res.json();
      if (data.success) {
        setPreviewHtml(data.data.html);
        setActiveTab("preview");
      } else {
        toast.error("Gagal memuat pratinjau");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSave = async () => {
    if (!editSubject.trim()) {
      toast.error("Subject tidak boleh kosong");
      return;
    }
    setSavingTemplate(true);
    try {
      const res = await fetch(`/api/admin/email/templates/${step.id}`, {
        method: "PUT",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject: editSubject,
          previewText: editPreviewText,
          ctaUrl: editCtaUrl,
          content: useCustomContent && editContent ? editContent : null,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success("Template berhasil disimpan");
        onSaved();
        onClose();
      } else {
        toast.error(data.error || "Gagal menyimpan");
      }
    } catch {
      toast.error("Terjadi kesalahan");
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleResetDefault = () => {
    setUseCustomContent(false);
    setEditContent("");
    setPreviewHtml(null);
  };

  const handleSendTest = async () => {
    if (!testEmailTo.trim()) { toast.error("Masukkan alamat email tujuan"); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(testEmailTo)) { toast.error("Format email tidak valid"); return; }
    if (!previewHtml) { toast.error("Pratinjau harus dimuat terlebih dahulu"); return; }

    setSendingTest(true);
    try {
      const res = await fetch("/api/admin/email/send-test", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: testEmailTo, subject: editSubject, html: previewHtml }),
      });
      const data = await res.json();
      if (data.success) toast.success(`Email test dikirim ke ${testEmailTo}`);
      else toast.error(data.error || "Gagal mengirim email test");
    } catch {
      toast.error("Terjadi kesalahan koneksi");
    } finally {
      setSendingTest(false);
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/40 backdrop-blur-[3px] z-40" onClick={onClose} />

      {/* Panel — wider for comfortable editing */}
      <div className="fixed inset-y-0 right-0 z-50 flex flex-col bg-white shadow-2xl w-full max-w-[780px]">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-black/[0.06] shrink-0">
          <div className="w-8 h-8 rounded-lg bg-[#F7E8E8] flex items-center justify-center shrink-0">
            <FileText size={14} className="text-[#8B1414]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-warm-black leading-tight truncate">{seqName}</p>
            <div className="flex items-center gap-1.5 mt-0.5">
              <span className="text-[11px] text-[rgba(12,12,10,0.4)]">Step #{step.stepOrder}</span>
              <span className="text-[rgba(12,12,10,0.2)] text-[11px]">·</span>
              <code className="text-[10px] font-mono text-[rgba(12,12,10,0.45)] bg-gray-100 px-1.5 py-0.5 rounded">
                {step.templateKey}
              </code>
              {step.hasCustomContent && (
                <span className="inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-medium bg-amber-50 text-amber-600 border border-amber-200/60">
                  Kustom
                </span>
              )}
            </div>
          </div>
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
          {(["edit", "preview"] as PanelTab[]).map((tab) => (
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
              {tab === "edit" ? <Code2 size={12} /> : <Inbox size={12} />}
              {tab === "edit" ? "Edit Template" : "Pratinjau & Test"}
              {tab === "preview" && previewHtml && (
                <span className="ml-0.5 w-1.5 h-1.5 rounded-full bg-[#8B1414] inline-block" />
              )}
            </button>
          ))}
        </div>

        {/* ── Body ──────────────────────────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto">

          {/* Edit Tab */}
          {activeTab === "edit" && (
            <div className="p-5 flex flex-col gap-5">

              {/* Subject */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-[rgba(12,12,10,0.45)] uppercase tracking-wider">
                  Subject Email
                </label>
                <input
                  value={editSubject}
                  onChange={(e) => setEditSubject(e.target.value)}
                  className={inputClass}
                  placeholder="Subject email..."
                />
                <p className="text-[11px] text-[rgba(12,12,10,0.35)]">
                  Ini yang muncul di inbox penerima. Buat singkat dan relevan.
                </p>
              </div>

              {/* Preview text */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-[rgba(12,12,10,0.45)] uppercase tracking-wider">
                  Preview Text
                </label>
                <input
                  value={editPreviewText}
                  onChange={(e) => setEditPreviewText(e.target.value)}
                  className={inputClass}
                  placeholder="Ringkasan pendek yang muncul di inbox..."
                />
                <p className="text-[11px] text-[rgba(12,12,10,0.35)]">
                  Teks pendamping subject di inbox. Buat spesifik dan tidak mengulang subject.
                </p>
              </div>

              {/* CTA URL */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[11px] font-semibold text-[rgba(12,12,10,0.45)] uppercase tracking-wider">
                  CTA URL
                </label>
                <input
                  value={editCtaUrl}
                  onChange={(e) => setEditCtaUrl(e.target.value)}
                  className={inputClass}
                  placeholder="https://app.pejuangyen.com/..."
                />
                <p className="text-[11px] text-[rgba(12,12,10,0.35)]">
                  Link yang terbuka saat penerima klik tombol utama di email.
                </p>
              </div>

              {/* Content Mode */}
              <div className="flex flex-col gap-2.5">
                <label className="text-[11px] font-semibold text-[rgba(12,12,10,0.45)] uppercase tracking-wider">
                  Konten Email
                </label>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setUseCustomContent(false); setPreviewHtml(null); }}
                    className={cn(
                      "flex-1 flex flex-col items-start gap-0.5 px-3.5 py-3 rounded-xl border text-left transition-all duration-150",
                      !useCustomContent
                        ? "border-[#8B1414] bg-[#F7E8E8] ring-1 ring-[#8B1414]/20"
                        : "border-[rgba(12,12,10,0.1)] bg-white hover:border-[rgba(12,12,10,0.2)]"
                    )}
                  >
                    <span className={cn("text-xs font-semibold", !useCustomContent ? "text-[#8B1414]" : "text-warm-black")}>
                      Template Default
                    </span>
                    <span className="text-[11px] text-[rgba(12,12,10,0.45)]">
                      Gunakan konten dari sistem
                    </span>
                  </button>
                  <button
                    onClick={() => { setUseCustomContent(true); setPreviewHtml(null); }}
                    className={cn(
                      "flex-1 flex flex-col items-start gap-0.5 px-3.5 py-3 rounded-xl border text-left transition-all duration-150",
                      useCustomContent
                        ? "border-[#8B1414] bg-[#F7E8E8] ring-1 ring-[#8B1414]/20"
                        : "border-[rgba(12,12,10,0.1)] bg-white hover:border-[rgba(12,12,10,0.2)]"
                    )}
                  >
                    <span className={cn("text-xs font-semibold", useCustomContent ? "text-[#8B1414]" : "text-warm-black")}>
                      Custom HTML
                    </span>
                    <span className="text-[11px] text-[rgba(12,12,10,0.45)]">
                      Tulis HTML sendiri
                    </span>
                  </button>
                </div>
              </div>

              {/* HTML Editor */}
              {useCustomContent && (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-semibold text-[rgba(12,12,10,0.45)] uppercase tracking-wider">
                      HTML Body
                    </label>
                    <span className="text-[11px] text-[rgba(12,12,10,0.4)]">
                      Variabel: <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono text-[10px]">{"{{userName}}"}</code>
                    </span>
                  </div>
                  <textarea
                    value={editContent}
                    onChange={(e) => { setEditContent(e.target.value); setPreviewHtml(null); }}
                    rows={18}
                    className={cn(
                      inputClass,
                      "font-mono text-[12px] resize-y min-h-[300px] leading-relaxed bg-[#0D0D0D] text-[#E8E8E8] border-[#333] placeholder-[#555] focus:border-[#8B1414]"
                    )}
                    placeholder={"<!DOCTYPE html>\n<html>\n  <body>\n    <p>Hei {{userName}},</p>\n    ...\n  </body>\n</html>"}
                    spellCheck={false}
                  />
                </div>
              )}
            </div>
          )}

          {/* Preview & Test Tab */}
          {activeTab === "preview" && (
            <div className="flex flex-col h-full">
              {previewHtml ? (
                <>
                  {/* Send Test section */}
                  <div className="px-5 py-3.5 border-b border-black/[0.06] bg-[#FAFAFA] shrink-0">
                    <p className="text-[11px] font-semibold text-[rgba(12,12,10,0.45)] uppercase tracking-wider mb-2">
                      Kirim Email Test
                    </p>
                    <div className="flex gap-2">
                      <input
                        type="email"
                        value={testEmailTo}
                        onChange={(e) => setTestEmailTo(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSendTest()}
                        className={cn(inputClass, "flex-1 text-sm")}
                        placeholder="email@contoh.com"
                        disabled={sendingTest}
                      />
                      <Button onClick={handleSendTest} loading={sendingTest} size="sm" variant="secondary">
                        <Send size={13} />
                        {sendingTest ? "Mengirim..." : "Kirim Test"}
                      </Button>
                    </div>
                  </div>

                  {/* Preview iframe */}
                  <div className="flex-1 bg-gray-100 p-4 overflow-auto">
                    <div className="mx-auto max-w-[640px] rounded-xl overflow-hidden shadow-md border border-black/[0.08] bg-white">
                      <div className="bg-white px-4 py-2.5 border-b border-black/[0.06] flex items-center gap-2">
                        <div className="flex gap-1.5">
                          <div className="w-2.5 h-2.5 rounded-full bg-red-400" />
                          <div className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
                          <div className="w-2.5 h-2.5 rounded-full bg-green-400" />
                        </div>
                        <p className="text-xs text-[rgba(12,12,10,0.4)] flex-1 text-center font-mono truncate">{editSubject}</p>
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
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center gap-4 text-center p-8">
                  <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center">
                    <Eye size={22} className="text-[rgba(12,12,10,0.25)]" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-warm-black">Belum ada pratinjau</p>
                    <p className="text-xs text-[rgba(12,12,10,0.45)] mt-1 max-w-[240px]">
                      Klik &ldquo;Muat Pratinjau&rdquo; untuk melihat tampilan email ini
                    </p>
                  </div>
                  <Button onClick={handleFetchPreview} loading={loadingPreview} size="sm">
                    <Eye size={13} />
                    Muat Pratinjau
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Footer ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between gap-3 px-5 py-3.5 border-t border-black/[0.06] bg-white shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleResetDefault}
            disabled={!useCustomContent && !step.hasCustomContent}
          >
            <RotateCcw size={13} />
            Reset Default
          </Button>

          <div className="flex items-center gap-2">
            {activeTab === "edit" && (
              <Button
                variant="secondary"
                size="sm"
                onClick={handleFetchPreview}
                loading={loadingPreview}
                disabled={useCustomContent && !editContent.trim()}
              >
                <Eye size={13} />
                {previewHtml ? "Refresh Preview" : "Pratinjau"}
              </Button>
            )}
            {activeTab === "preview" && previewHtml && (
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setActiveTab("edit")}
              >
                <Code2 size={13} />
                Kembali Edit
              </Button>
            )}
            <Button onClick={handleSave} loading={savingTemplate} size="sm">
              <Save size={13} />
              {savingTemplate ? "Menyimpan..." : "Simpan"}
            </Button>
          </div>
        </div>
      </div>
    </>
  );
}
