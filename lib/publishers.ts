import type { SupabaseClient } from "@supabase/supabase-js";

export type PublisherInfo = {
  id: number;
  name: string;
  country: string | null;
  parent_group: string | null;
  website: string | null;
  description: string | null;
};

/** Fiche d'une maison d'édition (null si aucune, ou si la migration n'est pas encore exécutée) */
export async function getPublisherInfo(supabase: SupabaseClient, name: string): Promise<PublisherInfo | null> {
  const pattern = name.replace(/[\\%_]/g, (m) => `\\${m}`);
  const { data, error } = await supabase
    .from("publishers")
    .select("id, name, country, parent_group, website, description")
    .ilike("name", pattern)
    .maybeSingle();
  if (error) return null;
  return data as PublisherInfo | null;
}
