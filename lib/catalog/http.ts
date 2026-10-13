/**
 * fetch avec réessais : les API gratuites répondent parfois 429 (quota) ou 5xx (surcharge).
 * On réessaie quelques fois avec une pause croissante avant de renoncer, et on met
 * les réponses en cache (cache de données de Next) pour ne pas redemander la même chose.
 */
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string
  ) {
    super(message);
    this.name = "HttpError";
  }
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function fetchWithRetry(
  url: string,
  {
    timeoutMs = 8000,
    retries = 2,
    revalidate,
    headers,
    label = "API",
  }: { timeoutMs?: number; retries?: number; revalidate?: number; headers?: HeadersInit; label?: string } = {}
): Promise<Response> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt <= retries; attempt++) {
    let delay = 400 * 3 ** attempt; // 400 ms, 1,2 s, 3,6 s…
    try {
      const response = await fetch(url, {
        headers,
        signal: AbortSignal.timeout(timeoutMs),
        ...(revalidate ? { next: { revalidate } } : {}),
      });
      if (response.ok) return response;

      const error = new HttpError(response.status, `${label} a répondu ${response.status}`);
      // Erreurs "définitives" (clé refusée, requête invalide…) : inutile d'insister
      if (response.status !== 429 && response.status < 500) throw error;
      lastError = error;
      const retryAfter = Number(response.headers.get("retry-after"));
      if (Number.isFinite(retryAfter) && retryAfter > 0) delay = Math.min(retryAfter * 1000, 3000);
    } catch (error) {
      if (error instanceof HttpError && error.status !== 429 && error.status < 500) throw error;
      lastError = error; // délai dépassé, réseau coupé…
    }
    if (attempt < retries) await sleep(delay);
  }

  throw lastError instanceof Error ? lastError : new Error(`${label} est injoignable`);
}
