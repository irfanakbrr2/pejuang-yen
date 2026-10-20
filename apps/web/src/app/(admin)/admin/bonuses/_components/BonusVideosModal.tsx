import { useState, useEffect } from "react";
import { Plus, Trash2, Video } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/Button";

interface BonusVideo {
  id: string;
  title: string;
  file_url: string;
  thumbnail_url?: string;
  sort_order: number;
}

const inputClass =
  "w-full px-3.5 py-2 text-sm rounded-lg border border-[rgba(12,12,10,0.12)] bg-white text-warm-black outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors";

export function BonusVideosModal({
  bonusId,
  open,
  onClose,
}: {
  bonusId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [videos, setVideos] = useState<BonusVideo[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newUrl, setNewUrl] = useState("");
  const [newThumbnail, setNewThumbnail] = useState("");

  const fetchVideos = async () => {
    if (!bonusId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/bonuses/${bonusId}/files`, { credentials: "include" });
      const data = await res.json();
      if (data.success) setVideos(data.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchVideos();
      setNewTitle("");
      setNewUrl("");
      setNewThumbnail("");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, bonusId]);

  const handleAdd = async () => {
    if (!newTitle.trim()) { alert("Judul video wajib diisi"); return; }
    if (!newUrl.trim()) { alert("URL video wajib diisi"); return; }
    if (!bonusId) return;

    setSaving(true);
    try {
      const res = await fetch(`/api/admin/bonuses/${bonusId}/files`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle.trim(),
          file_type: "video",
          file_url: newUrl.trim(),
          thumbnail_url: newThumbnail.trim() || null,
          sort_order: videos.length,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setNewTitle("");
        setNewUrl("");
        setNewThumbnail("");
        fetchVideos();
      } else {
        alert(data.error || "Gagal menyimpan video");
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm("Hapus video ini?")) return;
    try {
      await fetch(`/api/admin/bonuses/${bonusId}/files/${fileId}`, {
        method: "DELETE",
        credentials: "include",
      });
      fetchVideos();
    } catch (err) {
      console.error(err);
      alert("Gagal menghapus");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kelola Video Mini Course</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add New Video */}
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-semibold text-warm-black">Tambah Video Baru</h4>
            <div className="flex flex-col gap-2">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Judul Video (mis: Modul 1 – Intro AI)"
                className={inputClass}
              />
              <input
                value={newUrl}
                onChange={(e) => setNewUrl(e.target.value)}
                placeholder="URL Video (YouTube, Vimeo, dll)"
                className={inputClass}
              />
              <input
                value={newThumbnail}
                onChange={(e) => setNewThumbnail(e.target.value)}
                placeholder="URL Thumbnail (opsional)"
                className={inputClass}
              />
              {newThumbnail && (
                <div className="relative w-32 aspect-video rounded-lg overflow-hidden border border-black/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={newThumbnail} alt="preview" className="object-cover w-full h-full" />
                </div>
              )}
              <Button onClick={handleAdd} loading={saving} className="w-full justify-center">
                <Plus size={15} />
                Tambah Video
              </Button>
            </div>
            <p className="text-xs text-gray-500">Masukkan URL YouTube/Vimeo — tidak perlu upload file.</p>
          </div>

          {/* Video List */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-warm-black">Daftar Video ({videos.length})</h4>
            {loading ? (
              <div className="text-center py-6 text-sm text-gray-400">Memuat...</div>
            ) : videos.length === 0 ? (
              <div className="text-center py-10 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-gray-400 text-sm">
                Belum ada video. Tambahkan di atas.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {videos.map((video, idx) => (
                  <div
                    key={video.id}
                    className="flex items-center gap-3 p-3 bg-white border border-[rgba(0,0,0,0.06)] rounded-xl hover:border-[rgba(0,0,0,0.1)] transition-colors"
                  >
                    <span className="text-xs font-bold text-gray-400 w-5 shrink-0 text-center">{idx + 1}</span>
                    {video.thumbnail_url ? (
                      <div className="w-16 aspect-video rounded-lg overflow-hidden bg-gray-50 shrink-0 border border-black/10">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={video.thumbnail_url} alt="" className="w-full h-full object-cover" />
                      </div>
                    ) : (
                      <div className="w-16 aspect-video rounded-lg bg-gray-50 flex items-center justify-center text-gray-300 shrink-0 border border-black/10">
                        <Video size={18} />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-warm-black truncate">{video.title}</p>
                      <p className="text-xs text-gray-400 truncate mt-0.5">{video.file_url}</p>
                    </div>
                    <button
                      onClick={() => handleDelete(video.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors shrink-0"
                    >
                      <Trash2 size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
