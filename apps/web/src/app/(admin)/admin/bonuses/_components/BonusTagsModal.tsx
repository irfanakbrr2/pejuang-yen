"use client";

import { useState, useEffect } from "react";
import { Plus, Trash2, X } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/Button";
import { SkillTagPicker } from "@/components/admin/SkillTagPicker";

interface BonusTagsModalProps {
  bonusId: string | null;
  open: boolean;
  onClose: () => void;
}

export function BonusTagsModal({ bonusId, open, onClose }: BonusTagsModalProps) {
  const [tags, setTags] = useState<{tag_type: string, tag_value: string}[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open && bonusId) {
      setLoading(true);
      fetch(`/api/admin/resources/${bonusId}/tags?type=bonus`, { credentials: "include" })
        .then(res => res.json())
        .then(data => {
          if (data.success) setTags(data.data);
          setLoading(false);
        })
        .catch(() => setLoading(false));
    }
  }, [open, bonusId]);

  const handleSave = async () => {
    if (!bonusId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/resources/${bonusId}/tags`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resource_type: "bonus", tags })
      });
      const data = await res.json();
      if (data.success) {
        onClose();
      } else {
        alert(data.error || "Gagal menyimpan tags");
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  };

  const inputClass = "w-full px-3 py-2 text-sm rounded-lg border border-[rgba(12,12,10,0.12)] bg-white outline-none focus:border-primary";

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Personalization Tags</DialogTitle>
        </DialogHeader>
        
        <div className="py-4 max-h-[70vh] overflow-y-auto pr-1">
          {bonusId && <SkillTagPicker contentId={`bonus:${bonusId}`} />}

          <p className="text-sm text-gray-500 mb-4">
            Tambahkan tag persona (role/goal) untuk membantu sistem merekomendasikan bonus ini ke pengguna yang tepat.
          </p>
          
          {loading ? (
            <div className="text-center py-4 text-sm text-gray-500">Memuat...</div>
          ) : (
            <div className="space-y-3">
              {tags.map((tag, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  <select
                    className={inputClass + " w-1/3"}
                    value={tag.tag_type}
                    onChange={(e) => {
                      const newTags = [...tags];
                      newTags[idx].tag_type = e.target.value;
                      setTags(newTags);
                    }}
                  >
                    <option value="role">Peran / Profesi</option>
                    <option value="goal">Tujuan</option>
                  </select>
                  <input
                    className={inputClass + " flex-1"}
                    placeholder="Nilai tag (mis. pemula, jlpt-n5)"
                    value={tag.tag_value}
                    onChange={(e) => {
                      const newTags = [...tags];
                      newTags[idx].tag_value = e.target.value;
                      setTags(newTags);
                    }}
                  />
                  <button
                    onClick={() => setTags(tags.filter((_, i) => i !== idx))}
                    className="p-2 text-gray-400 hover:text-red-500 transition-colors"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setTags([...tags, { tag_type: 'role', tag_value: '' }])}
                className="w-full justify-center mt-2"
              >
                <Plus size={14} className="mr-1" /> Tambah Tag
              </Button>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="secondary" onClick={onClose}>Batal</Button>
          <Button onClick={handleSave} loading={saving}>
            {saving ? "Menyimpan..." : "Simpan Tags"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
