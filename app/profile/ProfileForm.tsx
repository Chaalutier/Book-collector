"use client";

import { useActionState, useRef, useState } from "react";
import type { ActionResult } from "@/app/actions/library";
import { updateProfile } from "@/app/actions/profile";
import Avatar from "@/app/components/Avatar";
import { supabase } from "@/lib/supabase";
import type { Profile } from "@/types/book";

const MAX_SIZE = 2 * 1024 * 1024; // 2 Mo, comme la limite du bucket

export default function ProfileForm({
  userId,
  email,
  profile,
}: {
  userId: string;
  email: string;
  profile: Profile;
}) {
  const [state, formAction, pending] = useActionState<ActionResult | null, FormData>(updateProfile, null);
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "");
  const [displayName, setDisplayName] = useState(profile.display_name ?? "");
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const onFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setUploadError(null);

    if (!file.type.startsWith("image/")) return setUploadError("Choisis une image.");
    if (file.size > MAX_SIZE) return setUploadError("Image trop lourde (2 Mo max).");

    setUploading(true);
    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    // Nom unique : évite que le navigateur garde l'ancienne image en cache
    const path = `${userId}/avatar-${Date.now()}.${extension}`;

    const { error } = await supabase.storage
      .from("avatars")
      .upload(path, file, { cacheControl: "3600", upsert: true, contentType: file.type });

    setUploading(false);
    if (error) {
      console.error(error);
      return setUploadError("Envoi impossible.");
    }

    const { data } = supabase.storage.from("avatars").getPublicUrl(path);
    setAvatarUrl(data.publicUrl);
  };

  return (
    <form action={formAction} className="grid gap-5">
      <input type="hidden" name="avatar_url" value={avatarUrl} />

      <div className="flex items-center gap-4">
        <Avatar url={avatarUrl || null} name={displayName || email} size={80} />
        <div className="flex flex-col items-start gap-1">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="btn-ghost"
          >
            {uploading ? "Envoi…" : "Changer la photo"}
          </button>
          {avatarUrl && (
            <button type="button" onClick={() => setAvatarUrl("")} className="text-xs text-muted hover:underline">
              Retirer la photo
            </button>
          )}
          {uploadError && <p className="text-xs text-red-600">{uploadError}</p>}
          <input
            ref={fileInput}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            onChange={onFileChange}
            className="hidden"
          />
        </div>
      </div>

      <label className="text-sm">
        Nom affiché
        <input
          name="display_name"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          maxLength={50}
          className="field mt-1"
        />
      </label>

      <label className="text-sm">
        Description
        <textarea
          name="bio"
          rows={4}
          maxLength={500}
          defaultValue={profile.bio ?? ""}
          placeholder="Tes genres préférés, ton livre de chevet…"
          className="field mt-1"
        />
      </label>

      <p className="text-xs text-muted">Email : {email}</p>

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending || uploading} className="btn-primary">
          {pending ? "Enregistrement…" : "Enregistrer"}
        </button>
        {state && (
          <p className={`text-sm ${state.ok ? "text-accent-strong" : "text-red-600"}`}>
            {state.ok ? state.message : state.error}
          </p>
        )}
      </div>
    </form>
  );
}
