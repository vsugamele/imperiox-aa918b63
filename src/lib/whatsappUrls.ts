// Helpers de URLs do módulo WhatsApp.
const PROJECT_ID = import.meta.env.VITE_SUPABASE_PROJECT_ID;

export function buildDistributorUrl(slug: string): string {
  return `https://${PROJECT_ID}.supabase.co/functions/v1/wa-group-distributor?slug=${slug}`;
}
