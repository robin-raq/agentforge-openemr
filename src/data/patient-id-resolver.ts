import { TtlCache } from "../cache";

export interface PatientIdResolverConfig {
  apiBaseUrl: string;
  getAccessToken: () => Promise<string>;
}

interface PatientApiResponse {
  uuid?: string;
  id?: string;
}

export class PatientIdResolver {
  private apiBaseUrl: string;
  private getAccessToken: () => Promise<string>;
  private cache = new TtlCache<string>({ ttlMs: 300_000, maxEntries: 100 });

  constructor(config: PatientIdResolverConfig) {
    this.apiBaseUrl = config.apiBaseUrl.replace(/\/$/, "");
    this.getAccessToken = config.getAccessToken;
  }

  async resolveToUuid(pid: string): Promise<string> {
    const cached = this.cache.get(pid);
    if (cached) return cached;

    const token = await this.getAccessToken();
    const url = `${this.apiBaseUrl}/patient?pid=${encodeURIComponent(pid)}`;

    const res = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(`Patient not found: ${pid}`);
      }
      const text = await res.text();
      throw new Error(`Patient lookup failed: ${res.status} ${text}`);
    }

    const data = (await res.json()) as PatientApiResponse;
    const uuid = data.uuid ?? data.id;

    if (!uuid) {
      throw new Error(`Patient ${pid} has no UUID in response`);
    }

    this.cache.set(pid, uuid);
    return uuid;
  }
}
