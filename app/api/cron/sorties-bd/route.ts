import { syncBdReleases } from "@/lib/bede/sync";

/**
 * Mise à jour des sorties BD (bede.fr → table `bd_releases`).
 * Appelée par Vercel Cron les 1er et 15 de chaque mois (voir vercel.json).
 * Vercel envoie « Authorization: Bearer <CRON_SECRET> » ; tout autre appel est refusé.
 */
export const maxDuration = 60;

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ ok: false, error: "Non autorisé." }, { status: 401 });
  }

  const result = await syncBdReleases();
  return Response.json(result, { status: result.ok ? 200 : 500 });
}
