import { useState, useEffect } from "react";
import { Plus, Trash2, UploadCloud, Loader2, File as FileIcon } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/Button";

interface BonusFile {
  id: string;
  title: string;
  file_type: string;
  file_url: string;
  thumbnail_url?: string;
  r2_key?: string;
  sort_order: number;
}

export function BonusFilesModal({
  bonusId,
  open,
  onClose,
}: {
  bonusId: string | null;
  open: boolean;
  onClose: () => void;
}) {
  const [files, setFiles] = useState<BonusFile[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadingThumb, setUploadingThumb] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newThumbnailUrl, setNewThumbnailUrl] = useState("");
  const [newThumbKey, setNewThumbKey] = useState("");

  const fetchFiles = async () => {
    if (!bonusId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/bonuses/${bonusId}/files`, { credentials: "include" });
      const data = await res.json();
      if (data.success) {
        setFiles(data.data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (open) {
      fetchFiles();
      setNewTitle("");
      setNewThumbnailUrl("");
      setNewThumbKey("");
    }
  }, [open, bonusId]);

  const handleThumbUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadingThumb(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "Bonusses");

      const res = await fetch("/api/admin/storage/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        setNewThumbnailUrl(`https://pub-d56d873c4b8d4204b35361d7bea0dca8.r2.dev/${data.data.key}`);
        setNewThumbKey(data.data.key);
      } else {
        alert(data.error || "Gagal mengupload gambar");
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan saat memproses gambar.");
    } finally {
      setUploadingThumb(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !bonusId) return;
    if (!newTitle) {
      alert("Masukkan judul file terlebih dahulu");
      return;
    }

    setUploading(true);
    try {
      // Upload to storage
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folder", "Bonusses");

      const uploadRes = await fetch("/api/admin/storage/upload", {
        method: "POST",
        body: formData,
        credentials: "include",
      });
      const uploadData = await uploadRes.json();
      if (!uploadData.success) throw new Error(uploadData.error || "Upload failed");

      // Save to database
      const ext = file.name.split('.').pop()?.toLowerCase();
      let fileType = "file";
      if (["pdf"].includes(ext || "")) fileType = "pdf";
      else if (["mp3", "wav"].includes(ext || "")) fileType = "audio";
      else if (["mp4", "mkv"].includes(ext || "")) fileType = "video";

      const dbRes = await fetch(`/api/admin/bonuses/${bonusId}/files`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          file_type: fileType,
          file_url: `https://pub-d56d873c4b8d4204b35361d7bea0dca8.r2.dev/${uploadData.data.key}`,
          r2_key: uploadData.data.key,
          thumbnail_url: newThumbnailUrl || null,
          r2_thumbnail_key: newThumbKey || null,
          sort_order: files.length,
        }),
      });

      const dbData = await dbRes.json();
      if (dbData.success) {
        setNewTitle("");
        setNewThumbnailUrl("");
        setNewThumbKey("");
        fetchFiles();
      } else {
        alert(dbData.error || "Gagal menyimpan data");
      }
    } catch (err) {
      console.error(err);
      alert("Terjadi kesalahan saat mengupload");
    } finally {
      setUploading(false);
      if (e.target) e.target.value = "";
    }
  };

  const handleDelete = async (fileId: string) => {
    if (!confirm("Hapus file ini?")) return;
    try {
      await fetch(`/api/admin/bonuses/${bonusId}/files/${fileId}`, {
        method: "DELETE",
        credentials: "include",
      });
      fetchFiles();
    } catch (err) {
      console.error(err);
      alert("Gagal menghapus");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Kelola File Bundle</DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add New File Section */}
          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 space-y-3">
            <h4 className="text-sm font-semibold text-warm-black">Tambah File Baru</h4>
            <div className="flex flex-col gap-3">
              <input
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="Judul File (misal: Ebook Panduan)"
                className="w-full px-3.5 py-2 text-sm rounded-lg border border-[rgba(12,12,10,0.12)] bg-white text-warm-black outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
              />
              <div className="flex gap-2">
                <input
                  value={newThumbnailUrl}
                  onChange={(e) => setNewThumbnailUrl(e.target.value)}
                  placeholder="URL Gambar Cover (Opsional)"
                  className="flex-1 px-3.5 py-2 text-sm rounded-lg border border-[rgba(12,12,10,0.12)] bg-white text-warm-black outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-colors"
                />
                <label className="flex-shrink-0 flex items-center justify-center gap-2 px-4 py-2 bg-white hover:bg-gray-50 border border-[rgba(12,12,10,0.12)] rounded-lg cursor-pointer transition-colors text-sm font-medium text-warm-black">
                  {uploadingThumb ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                  {uploadingThumb ? "Uploading..." : "Upload Cover"}
                  <input type="file" accept="image/*" onChange={handleThumbUpload} className="hidden" disabled={uploadingThumb} />
                </label>
              </div>
              {newThumbnailUrl && (
                <div className="relative w-24 aspect-video rounded-lg overflow-hidden border border-black/10">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={newThumbnailUrl} alt="Thumbnail preview" className="object-cover w-full h-full" />
                </div>
              )}
              <label className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-white hover:bg-primary-dark rounded-lg cursor-pointer transition-colors text-sm font-medium">
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <UploadCloud size={16} />}
                {uploading ? "Menyimpan File..." : "Pilih File & Simpan"}
                <input type="file" onChange={handleFileUpload} className="hidden" disabled={uploading || uploadingThumb || !newTitle} />
              </label>
            </div>
            <p className="text-xs text-gray-500">Isi judul dan opsional cover terlebih dahulu, baru upload file-nya.</p>
          </div>

          {/* Files List */}
          <div className="space-y-2">
            <h4 className="text-sm font-semibold text-warm-black">Daftar File ({files.length})</h4>
            {loading ? (
              <div className="text-center py-6">
                <Loader2 size={24} className="animate-spin mx-auto text-gray-400" />
              </div>
            ) : files.length === 0 ? (
              <div className="text-center py-10 bg-gray-50 border border-dashed border-gray-200 rounded-xl text-gray-400 text-sm">
                Belum ada file dalam bundle ini.
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                {files.map((file) => (
                  <div key={file.id} className="flex items-center justify-between p-3 bg-white border border-[rgba(0,0,0,0.06)] rounded-xl hover:border-[rgba(0,0,0,0.1)] transition-colors">
                    <div className="flex items-center gap-3">
                      {file.thumbnail_url ? (
                        <div className="w-10 h-10 rounded-lg overflow-hidden bg-gray-50 flex-shrink-0 border border-black/10">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={file.thumbnail_url} alt="" className="w-full h-full object-cover" />
                        </div>
                      ) : (
                        <div className="w-10 h-10 rounded-lg bg-gray-50 flex items-center justify-center text-gray-400 flex-shrink-0 border border-black/10">
                          <FileIcon size={20} />
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-warm-black">{file.title}</p>
                        <p className="text-xs text-gray-400 uppercase">{file.file_type}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDelete(file.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 size={16} />
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
