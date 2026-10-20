"use client";

import { useEffect, useState } from "react";
import { Star, X } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "@/components/ui/toast";

interface Skill {
  id: string;
  slug: string;
  name: string;
  is_active?: number;
}

interface TagItem {
  id: string;
  name: string;
}

interface SkillTagPickerProps {
  /** Registry content id: '<content_type>:<ref_id>' (mis. 'course:abc-123') */
  contentId: string;
}

// Pemilih skill (multi, dengan primary) + tag bebas untuk satu konten.
// Dipakai di form admin kelas / bonus / rekaman.
export function SkillTagPicker({ contentId }: SkillTagPickerProps) {
  const [allSkills, setAllSkills] = useState<Skill[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [primaryId, setPrimaryId] = useState<string | null>(null);
  const [tagNames, setTagNames] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [suggestions, setSuggestions] = useState<TagItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/admin/skills", { credentials: "include" }).then((r) => r.json()),
      fetch(`/api/admin/content/${encodeURIComponent(contentId)}/taxonomy`, { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([skillsRes, taxRes]) => {
        if (skillsRes.success) {
          setAllSkills((skillsRes.data as Skill[]).filter((s) => s.is_active !== 0));
        }
        if (taxRes.success) {
          const current = (taxRes.data?.skills || []) as (Skill & { is_primary: number })[];
          setSelected(current.map((s) => s.id));
          setPrimaryId(current.find((s) => s.is_primary === 1)?.id || null);
          setTagNames(((taxRes.data?.tags || []) as TagItem[]).map((t) => t.name));
        }
      })
      .catch(console.error)
      .finally(() => setLoaded(true));
  }, [contentId]);

  useEffect(() => {
    const q = tagInput.trim();
    if (q.length < 2) {
      setSuggestions([]);
      return;
    }
    const t = setTimeout(() => {
      fetch(`/api/admin/tags?q=${encodeURIComponent(q)}`, { credentials: "include" })
        .then((r) => r.json())
        .then((res) => {
          if (res.success) {
            setSuggestions(
              (res.data as TagItem[])
                .filter((tag) => !tagNames.includes(tag.name))
                .slice(0, 6)
            );
          }
        })
        .catch(() => setSuggestions([]));
    }, 200);
    return () => clearTimeout(t);
  }, [tagInput, tagNames]);

  const toggleSkill = (id: string) => {
    setSelected((prev) => {
      const next = prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id];
      if (!next.includes(primaryId || "")) setPrimaryId(next[0] || null);
      return next;
    });
  };

  const addTag = (name: string) => {
    const clean = name.trim();
    if (!clean || tagNames.includes(clean)) return;
    setTagNames((prev) => [...prev, clean]);
    setTagInput("");
    setSuggestions([]);
  };

  const save = async () => {
    setSaving(true);
    try {
      const [skillsRes, tagsRes] = await Promise.all([
        fetch(`/api/admin/content/${encodeURIComponent(contentId)}/skills`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ skill_ids: selected, primary_skill_id: primaryId }),
        }).then((r) => r.json()),
        fetch(`/api/admin/content/${encodeURIComponent(contentId)}/tags`, {
          method: "PUT",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tag_names: tagNames }),
        }).then((r) => r.json()),
      ]);
      if (skillsRes.success && tagsRes.success) toast.success("Skill & tags berhasil disimpan");
      else toast.error(skillsRes.error || tagsRes.error || "Gagal menyimpan skill & tags");
    } catch {
      toast.error("Terjadi kesalahan saat menyimpan skill & tags.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="mb-5 max-w-2xl">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Skill & Tags</CardTitle>
        <Button onClick={save} loading={saving} size="sm" disabled={!loaded}>
          Simpan Skill & Tags
        </Button>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-5">
          <div>
            <p className="mb-2 text-sm text-gray-500">
              Pilih skill yang diajarkan konten ini (boleh lebih dari satu). Klik ⭐ untuk menandai skill utama.
            </p>
            <div className="flex flex-wrap gap-2">
              {allSkills.map((s) => {
                const isSelected = selected.includes(s.id);
                const isPrimary = primaryId === s.id;
                return (
                  <span key={s.id} className="inline-flex items-center">
                    <button
                      type="button"
                      onClick={() => toggleSkill(s.id)}
                      className={`rounded-l-full px-3 py-1.5 text-xs font-medium transition-colors ${
                        isSelected
                          ? "bg-primary text-white"
                          : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                      } ${isSelected ? "" : "rounded-r-full"}`}
                    >
                      {s.name}
                    </button>
                    {isSelected && (
                      <button
                        type="button"
                        title="Jadikan skill utama"
                        onClick={() => setPrimaryId(s.id)}
                        className={`rounded-r-full py-1.5 pl-1 pr-2 text-xs transition-colors ${
                          isPrimary ? "bg-primary text-amber-300" : "bg-primary/80 text-white/60 hover:text-amber-200"
                        }`}
                      >
                        <Star size={12} className={isPrimary ? "fill-amber-300" : ""} />
                      </button>
                    )}
                  </span>
                );
              })}
              {loaded && allSkills.length === 0 && (
                <p className="text-xs text-gray-400">Belum ada skill. Buat dulu di menu Skills & Tags.</p>
              )}
            </div>
          </div>

          <div>
            <p className="mb-2 text-sm text-gray-500">
              Tag bebas untuk topik yang lebih spesifik (mis. &quot;jlpt&quot;, &quot;kaigo&quot;, &quot;wawancara&quot;).
            </p>
            <div className="flex flex-wrap items-center gap-2">
              {tagNames.map((name) => (
                <span
                  key={name}
                  className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1.5 text-xs font-medium text-gray-700"
                >
                  {name}
                  <button
                    type="button"
                    onClick={() => setTagNames((prev) => prev.filter((t) => t !== name))}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
              <div className="relative">
                <input
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag(tagInput);
                    }
                  }}
                  placeholder="Ketik tag lalu Enter…"
                  className="w-44 rounded-full border border-[rgba(12,12,10,0.12)] px-3 py-1.5 text-xs outline-none focus:border-primary"
                />
                {suggestions.length > 0 && (
                  <div className="absolute left-0 top-full z-10 mt-1 w-52 overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg">
                    {suggestions.map((s) => (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => addTag(s.name)}
                        className="block w-full px-3 py-2 text-left text-xs text-gray-700 hover:bg-gray-50"
                      >
                        {s.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
