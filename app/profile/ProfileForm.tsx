"use client";

import { useRouter } from "next/navigation";
import { useActionState, useRef, useState } from "react";
import type { ActionResult } from "@/app/actions/library";
import { setAvatar, updateProfile } from "@/app/actions/profile";
import Avatar from "@/app/components/Avatar";
import { supabase } from "@/lib/supabase";
import AvatarCropper from "./AvatarCropper";
import type { Profile } from "@/types/book";

/** Traduit les erreurs du stockage Supabase en consignes claires */
function explainStorageError(message: string) {
  const m = message.toLowerCase();
  if (m.includes("bucket not found") || m.includes("not found"))
    return "Le dossier de stockage « avatars » n'existe pas : exécute la migration 20261019000000_avatars.sql dans Supabase (SQL Editor).";
  if (m.includes("row-level security") || m.includes("policy") || m.includes("unauthorized") || m.includes("not authorized"))
    return "Autorisation refusée par Supabase : exécute la migration 20261019000000_avatars.sql dans Supabase (SQL Editor), puis reconnecte-toi.";
  if (m.includes("mime") || m.includes("not supported")) return "Format refusé par le stockage (JPEG attendu).";
  if (m.includes("exceeded") || m.includes("too large") || m.includes("payload")) return "Image trop lourde pour le stockage.";
  if (m.includes("failed to fetch") || m.includes("network")) return "Pas de connexion au serveur de stockage. Vérifie ton réseau.";
  return `Envoi impossible : ${message}`;
}

const AVATAR_PATH = "/storage/v1/object/public/avatars/";

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
  const router = useRouter();
  const [cropFile, setCropFile] = useState<File | null>(null);

  /** Choix du fichier : on ouvre le recadrage */
  const onFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = ""; // permet de rechoisir le même fichier
    if (!file) return;
    setUploadError(null);
    if (!file.type.startsWith("image/")) return setUploadError("Choisis une image.");
    setCropFile(file);
  };

  /** Photo recadrée : envoi dans le stockage puis enregistrement dans le profil */
  const uploadAvatar = async (blob: Blob) => {
    setCropFile(null);
    setUploading(true);
    try {
      // Nom unique : évite que le navigateur garde l'ancienne image en cache
      const path = `${userId}/avatar-${Date.now()}.jpg`;
      const { error } = await supabase.storage
        .from("avatars")
        .upload(path, blob, { cacheControl: "3600", contentType: "image/jpeg" });
      if (error) {
        console.error("Storage avatars :", error);
        throw new Error(explainStorageError(error.message));
      }

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const saved = await setAvatar(data.publicUrl);
      if (!saved.ok) throw new Error(saved.error);

      // Ménage : on supprime l'ancienne photo (sans bloquer si ça échoue)
      const previous = avatarUrl.split(AVATAR_PATH)[1];
      if (previous) supabase.storage.from("avatars").remove([previous]).catch(() => {});
      setAvatarUrl(data.publicUrl);
      router.refresh();
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Envoi impossible.");
    } finally {
      setUploading(false);
    }
  };

  const removeAvatar = async () => {
    setUploadError(null);
    const saved = await setAvatar(null);
    if (!saved.ok) return setUploadError(saved.error);
    const previous = avatarUrl.split(AVATAR_PATH)[1];
    if (previous) supabase.storage.from("avatars").remove([previous]).catch(() => {});
    setAvatarUrl("");
    router.refresh();
  };

  return (
    <form action={formAction} className="grid gap-5">
      <input type="hidden" name="avatar_url" value={avatarUrl} />
      {cropFile && <AvatarCropper file={cropFile} onCancel={() => setCropFile(null)} onConfirm={uploadAvatar} />}

      <div className="flex items-center gap-4">
        <Avatar url={avatarUrl || null} name={displayName || email} size={80} />
        <div className="flex flex-col items-start gap-1">
          <button
            type="button"
            onClick={() => fileInput.current?.click()}
            disabled={uploading}
            className="btn-ghost"
          >
            {uploading ? "Envoi…" : avatarUrl ? "Changer la photo" : "Ajouter une photo"}
          </button>
          {avatarUrl && (
            <button type="button" onClick={removeAvatar} className="text-xs text-muted hover:underline">
              Retirer la photo
            </button>
          )}
          {uploadError && <p className="max-w-xs text-xs text-red-600" role="alert">{uploadError}</p>}
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
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
