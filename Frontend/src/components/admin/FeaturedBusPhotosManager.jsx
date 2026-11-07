import { useEffect, useRef, useState } from "react";
import { Camera, Image as ImageIcon, Loader2, Plus, Sparkles, Trash2, X } from "lucide-react";
import Button from "../common/Button";
import Modal from "../common/Modal";
import { useAuth } from "../../context/AuthContext";
import {
  deleteFeaturedBusPhoto,
  getAdminFeaturedBusPhotos,
  uploadFeaturedBusPhoto,
} from "../../services/busPhotoService";

export default function FeaturedBusPhotosManager() {
  const { setToast } = useAuth();
  const fileInputRef = useRef(null);

  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Form State
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [title, setTitle] = useState("");
  const [caption, setCaption] = useState("");
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function loadPhotos() {
    setLoading(true);
    try {
      const data = await getAdminFeaturedBusPhotos();
      setPhotos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load featured bus photos:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadPhotos();
  }, []);

  function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setToast({ type: "error", message: "Please select an image file (PNG, JPG, WEBP, or GIF)." });
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setToast({ type: "error", message: "Bus photo size must be less than 10MB." });
      return;
    }

    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  }

  function handleClearSelection() {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleCloseModal() {
    if (uploading) return;
    setModalOpen(false);
    handleClearSelection();
    setTitle("");
    setCaption("");
  }

  async function handleUpload(e) {
    e.preventDefault();
    if (!selectedFile) {
      setToast({ type: "error", message: "Please select a bus image to upload." });
      return;
    }

    setUploading(true);
    try {
      await uploadFeaturedBusPhoto({
        file: selectedFile,
        title: title.trim(),
        caption: caption.trim(),
      });

      setToast({
        type: "success",
        message: "Bus photo uploaded to Cloudinary and featured in everyone's carousel!",
      });

      handleCloseModal();
      await loadPhotos();

      // Notify carousel to refresh
      window.dispatchEvent(new Event("safar:bus-photos-updated"));
    } catch (err) {
      setToast({
        type: "error",
        message: err.message || "Failed to upload bus photo to Cloudinary.",
      });
    } finally {
      setUploading(false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;

    setDeleting(true);
    try {
      await deleteFeaturedBusPhoto(deleteTarget.id);
      setToast({ type: "success", message: "Featured bus photo removed." });
      setDeleteTarget(null);
      await loadPhotos();
      window.dispatchEvent(new Event("safar:bus-photos-updated"));
    } catch (err) {
      setToast({
        type: "error",
        message: err.message || "Failed to remove bus photo.",
      });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-safar-ink dark:text-white">
              Featured Bus Photos & Carousel
            </h2>
            <span className="inline-flex items-center gap-1 rounded-full bg-cyan-50 px-2.5 py-0.5 text-xs font-semibold text-cyan-700 dark:bg-cyan-950 dark:text-cyan-300">
              <Sparkles className="h-3 w-3" />
              Cloudinary
            </span>
          </div>
          <p className="mt-1 text-sm text-safar-gray">
            Upload new bus photos that are featured on every user's dashboard carousel.
          </p>
        </div>

        <Button
          tone="primary"
          onClick={() => setModalOpen(true)}
          className="flex items-center gap-2 shrink-0"
        >
          <Plus className="h-4 w-4" />
          Upload New Bus Photo
        </Button>
      </div>

      {/* Photos Grid */}
      <div className="mt-5">
        {loading ? (
          <div className="flex items-center justify-center py-10 text-safar-gray">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            Loading featured photos...
          </div>
        ) : photos.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-slate-300 py-10 px-4 text-center dark:border-slate-700">
            <ImageIcon className="h-10 w-10 text-slate-400" />
            <p className="mt-2 text-sm font-semibold text-safar-ink dark:text-white">
              No custom featured photos yet
            </p>
            <p className="mt-1 text-xs text-safar-gray max-w-sm">
              The dashboard is currently showing default CUET Jamuna bus images. Click the upload button above to feature new buses!
            </p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {photos.map((photo) => (
              <div
                key={photo.id}
                className="group relative overflow-hidden rounded-xl border border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/50 shadow-sm transition hover:shadow-md"
              >
                <div className="aspect-[16/10] w-full overflow-hidden bg-slate-200 dark:bg-slate-700">
                  <img
                    src={photo.image_url}
                    alt={photo.title || "Featured Bus"}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-bold text-safar-ink dark:text-white">
                        {photo.title || "Featured CUET Bus"}
                      </h3>
                      <p className="mt-0.5 line-clamp-2 text-xs text-safar-gray">
                        {photo.caption || "No caption provided"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setDeleteTarget(photo)}
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-600 transition dark:hover:bg-red-950 dark:hover:text-red-400"
                      title="Remove photo from carousel"
                      aria-label="Delete photo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <div className="mt-2 text-[10px] text-safar-gray flex items-center justify-between">
                    <span>
                      {new Date(photo.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })}
                    </span>
                    <span className="font-semibold text-safar-teal">Featured in Carousel</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Upload Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
          <div className="relative w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
              <div className="flex items-center gap-2">
                <Camera className="h-5 w-5 text-safar-teal" />
                <h3 className="text-lg font-bold text-safar-ink dark:text-white">
                  Upload Featured Bus Photo
                </h3>
              </div>
              <button
                type="button"
                onClick={handleCloseModal}
                disabled={uploading}
                className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleUpload} className="mt-4 space-y-4">
              {/* Image Picker / Preview */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-safar-gray mb-1.5">
                  Bus Image <span className="text-red-500">*</span>
                </label>
                {previewUrl ? (
                  <div className="relative aspect-[16/9] w-full overflow-hidden rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-900">
                    <img
                      src={previewUrl}
                      alt="Selected bus preview"
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={handleClearSelection}
                      disabled={uploading}
                      className="absolute top-2 right-2 grid h-8 w-8 place-items-center rounded-full bg-black/60 text-white hover:bg-black/80 transition"
                      title="Choose a different image"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 p-6 text-center cursor-pointer hover:border-safar-teal hover:bg-safar-mint/10 transition dark:border-slate-700"
                  >
                    <ImageIcon className="h-10 w-10 text-safar-teal/70" />
                    <p className="mt-2 text-sm font-bold text-safar-ink dark:text-white">
                      Click to choose a bus photo
                    </p>
                    <p className="mt-1 text-xs text-safar-gray">
                      PNG, JPG, WEBP, or GIF up to 10MB. Stored securely on Cloudinary.
                    </p>
                  </div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>

              {/* Title Input */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-safar-gray mb-1.5">
                  Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Jamuna AC Fleet Special"
                  maxLength={100}
                  className="focus-ring h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm text-safar-ink dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              {/* Caption Input */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-safar-gray mb-1.5">
                  Caption / Description
                </label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  placeholder="e.g. Modernized transportation added to Route 1 connecting campus to Station."
                  rows={3}
                  maxLength={250}
                  className="focus-ring w-full rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-safar-ink dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseModal}
                  disabled={uploading}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  tone="primary"
                  disabled={!selectedFile || uploading}
                  className="flex items-center gap-2"
                >
                  {uploading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading to Cloudinary...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Upload & Feature
                    </>
                  )}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <Modal
        open={Boolean(deleteTarget)}
        title="Remove Featured Photo?"
        description={`Are you sure you want to remove "${deleteTarget?.title || "this photo"}" from the carousel? It will no longer appear on user dashboards.`}
        confirmLabel={deleting ? "Removing..." : "Remove Photo"}
        danger
        onClose={() => setDeleteTarget(null)}
        onConfirm={confirmDelete}
      />
    </section>
  );
}

