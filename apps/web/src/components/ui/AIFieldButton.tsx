"use client";

import { useState } from "react";
import { Wand2 } from "lucide-react";
import { api } from "@/lib/api-client";
import { Button } from "@/components/ui/Button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

type EntityType = "course" | "lesson" | "webinar" | "email_campaign";
type OutputFormat = "plain" | "html";

interface AIFieldButtonProps {
  field: string;
  fieldName: string;
  entityType: EntityType;
  context?: unknown;
  outputFormat?: OutputFormat;
  onFill: (content: string) => void;
  disabled?: boolean;
  className?: string;
}

type AiFieldResponse = {
  field: string;
  content: string;
};

// Fitur AI-fill (warisan GrowWithAI, butuh backend AI) dinonaktifkan untuk PejuangYen.
const AI_FILL_ENABLED = false;

export function AIFieldButton({
  field,
  fieldName,
  entityType,
  context,
  outputFormat = "plain",
  onFill,
  disabled,
  className,
}: AIFieldButtonProps) {
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!AI_FILL_ENABLED) return null;

  const generate = async () => {
    if (!prompt.trim()) {
      setError("Prompt wajib diisi");
      return;
    }

    setLoading(true);
    setError("");
    const res = await api<AiFieldResponse>("/api/admin/ai-fill", {
      method: "POST",
      cacheTtl: 0,
      body: {
        mode: "field",
        entity_type: entityType,
        field,
        context,
        prompt,
        output_format: outputFormat,
      },
    });
    setLoading(false);

    if (!res.success || !res.data?.content) {
      setError(res.error || "Gagal generate konten");
      return;
    }

    onFill(res.data.content);
    toast.success(`${fieldName} berhasil diisi AI`);
    setOpen(false);
    setPrompt("");
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={disabled}
        title={`Isi ${fieldName} dengan AI`}
        className={cn(
          "inline-flex h-6 items-center gap-1 rounded-lg bg-[#F7E8E8] px-2 text-[10px] font-semibold text-[#8B1414]",
          "transition-colors hover:bg-[#d8eee6] disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
      >
        <Wand2 className="h-3 w-3" />
        AI
      </button>

      <Dialog open={open} onOpenChange={(next) => !loading && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Isi {fieldName} dengan AI</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <textarea
              value={prompt}
              onChange={(event) => {
                setPrompt(event.target.value);
                setError("");
              }}
              rows={5}
              className="w-full rounded-xl border border-[rgba(12,12,10,0.12)] px-3.5 py-2.5 text-sm text-warm-black outline-none transition-colors focus:border-primary focus:ring-2 focus:ring-primary-light"
              placeholder="Contoh: Buat lebih hangat, jelas, dan cocok untuk solopreneur Indonesia."
              disabled={loading}
            />
            {error && (
              <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-600">
                {error}
              </p>
            )}
          </div>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setOpen(false)} disabled={loading}>
              Batal
            </Button>
            <Button onClick={generate} loading={loading}>
              Generate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
