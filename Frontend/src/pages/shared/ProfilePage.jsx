import { useRef, useState } from "react";
import { Building2, Calendar, Camera, FileText, Globe2, Loader2, Moon, Phone, Trash2, User } from "lucide-react";
import Badge from "../../components/common/Badge";
import PageHeader from "../../components/layout/PageHeader";
import DashboardLayout from "../../layouts/DashboardLayout";
import { useAuth } from "../../context/AuthContext";
import ThemeToggle from "../../components/common/ThemeToggle";
import { uploadAvatar, updateProfile } from "../../services/authService";

export default function ProfilePage({ role }) {
  const { user, updateUser, setToast } = useAuth();
  const fileInputRef = useRef(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  void role;

  const initials = user?.name
    ? user.name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase()
    : "JU";

  async function handleFileSelect(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so same file can be selected again if needed
    e.target.value = "";

    if (!file.type.startsWith("image/")) {
      setToast({ type: "error", message: "Please select an image file (PNG, JPG, WEBP, or GIF)." });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setToast({ type: "error", message: "Image size must be less than 5MB." });
      return;
    }

    setIsUploading(true);
    try {
      const updatedUser = await uploadAvatar(file);
      if (updatedUser) {
        updateUser(updatedUser);
      }
      setToast({ type: "success", message: "Profile picture uploaded successfully!" });
    } catch (err) {
      setToast({
        type: "error",
        message: err.message || "Failed to upload profile picture to Cloudinary.",
      });
    } finally {
      setIsUploading(false);
    }
  }

  async function handleRemovePhoto() {
    if (!user?.profileImage) return;
    setIsRemoving(true);
    try {
      await updateProfile({ profileImage: null });
      updateUser({ profileImage: null });
      setToast({ type: "success", message: "Profile picture removed." });
    } catch (err) {
      setToast({
        type: "error",
        message: err.message || "Failed to remove profile picture.",
      });
    } finally {
      setIsRemoving(false);
    }
  }

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <PageHeader
          eyebrow="Profile"
          title="Account and preferences"
          description="Manage your Safar identity, communication details, and transport preferences."
        />

        <section className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
            <div className="flex flex-col items-center text-center">
              {/* Profile Avatar Container */}
              <div className="relative group">
                {user?.profileImage ? (
                  <img
                    src={user.profileImage}
                    alt={user.name}
                    className="h-28 w-28 rounded-full object-cover ring-4 ring-white shadow-md dark:ring-slate-800 transition duration-300"
                  />
                ) : (
                  <div className="grid h-28 w-28 place-items-center rounded-full bg-safar-mint text-3xl font-bold text-safar-teal ring-4 ring-white shadow-md dark:ring-slate-800">
                    {initials}
                  </div>
                )}

                {/* Upload Spinner Overlay */}
                {isUploading && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center rounded-full bg-black/60 text-white backdrop-blur-sm">
                    <Loader2 className="h-7 w-7 animate-spin" />
                    <span className="mt-1 text-[10px] font-semibold">Uploading...</span>
                  </div>
                )}

                {/* Camera upload button */}
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || isRemoving}
                  className="absolute bottom-0 right-0 grid h-9 w-9 place-items-center rounded-full bg-safar-teal text-white shadow-md hover:bg-safar-navy focus-ring transition-transform hover:scale-110 disabled:opacity-50"
                  title="Upload profile picture (Cloudinary)"
                  aria-label="Upload profile picture"
                >
                  <Camera className="h-4 w-4" />
                </button>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handleFileSelect}
                />
              </div>

              {/* Photo Action Buttons */}
              <div className="mt-3 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading || isRemoving}
                  className="text-xs font-semibold text-safar-teal hover:underline disabled:opacity-50"
                >
                  {user?.profileImage ? "Change Photo" : "Upload Photo"}
                </button>
                {user?.profileImage && (
                  <>
                    <span className="text-slate-300 dark:text-slate-700">•</span>
                    <button
                      type="button"
                      onClick={handleRemovePhoto}
                      disabled={isUploading || isRemoving}
                      className="flex items-center gap-1 text-xs font-semibold text-red-500 hover:text-red-700 disabled:opacity-50"
                    >
                      {isRemoving ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                      Remove
                    </button>
                  </>
                )}
              </div>

              <h2 className="mt-3 text-xl font-bold text-safar-ink dark:text-white">{user?.name}</h2>
              <p className="mt-1 text-sm text-safar-gray">{user?.universityId || user?.id}</p>
              <div className="mt-3"><Badge tone="info">{user?.roleLabel}</Badge></div>
            </div>

            <dl className="mt-6 space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-safar-teal" />
                <span className="text-safar-gray">{user?.email}</span>
              </div>
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-safar-teal" />
                <span className="text-safar-gray">{user?.phone || "Not provided"}</span>
              </div>
              <div className="flex items-center gap-3">
                <Globe2 className="h-4 w-4 text-safar-teal" />
                <span className="text-safar-gray">{user?.universityId || user?.id}</span>
              </div>
              {user?.department && (
                <div className="flex items-center gap-3">
                  <Building2 className="h-4 w-4 text-safar-teal" />
                  <span className="text-safar-gray">Department:</span>
                  <span className="font-semibold text-safar-ink dark:text-white">{user.department}</span>
                </div>
              )}
              {user?.batch && (
                <div className="flex items-center gap-3">
                  <Calendar className="h-4 w-4 text-safar-teal" />
                  <span className="text-safar-gray">Batch:</span>
                  <span className="font-semibold text-safar-ink dark:text-white">{user.batch}</span>
                </div>
              )}
              {user?.studentId && (
                <div className="flex items-center gap-3">
                  <FileText className="h-4 w-4 text-safar-teal" />
                  <span className="text-safar-gray">Student ID:</span>
                  <span className="font-semibold text-safar-ink dark:text-white">{user.studentId}</span>
                </div>
              )}
            </dl>
          </div>

          <div className="rounded-xl bg-white p-5 shadow-sm ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-800">
            <h2 className="text-lg font-bold text-safar-ink dark:text-white">Settings</h2>
            <div className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
              <div className="flex flex-wrap items-center justify-between gap-4 py-4">
                <div className="flex items-center gap-3">
                  <div className="grid h-10 w-10 place-items-center rounded-lg bg-safar-sky dark:bg-slate-800">
                    <Moon className="h-5 w-5 text-safar-teal" />
                  </div>
                  <p className="font-semibold text-safar-ink dark:text-white">Theme</p>
                </div>
                <div className="w-full max-w-[230px]"><ThemeToggle /></div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
