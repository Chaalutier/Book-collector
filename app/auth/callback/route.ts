import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/server";

/** Redirection interne uniquement (évite qu'un lien détourné nous envoie sur un autre site) */
function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") ? value : "/profile";
}

/**
 * Retour du lien de confirmation envoyé par email (inscription, changement d'adresse…).
 * Deux formes de lien : `?code=…` (PKCE, même navigateur que l'inscription)
 * ou `?token_hash=…&type=…` (modèle d'email personnalisé, marche aussi depuis un autre appareil).
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = safeNext(searchParams.get("next"));

  const supabase = await createClient();
  let failed = true;

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    failed = !!error;
    if (error) console.error("verifyOtp :", error.message);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    failed = !!error;
    if (error) console.error("exchangeCodeForSession :", error.message);
  }

  return NextResponse.redirect(new URL(failed ? "/login?confirm=error" : next, origin));
}
