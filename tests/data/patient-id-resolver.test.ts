import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { PatientIdResolver } from "../../src/data/patient-id-resolver";

describe("PatientIdResolver", () => {
  const getToken = vi.fn().mockResolvedValue("bearer-tok-123");
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("resolves numeric pid to UUID via Standard API", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ uuid: "90cde167-511f-4f6d-bc97-b65a78cf1995" }),
    });

    const resolver = new PatientIdResolver({
      apiBaseUrl: "https://localhost:9300/apis/default/api",
      getAccessToken: getToken,
    });

    const uuid = await resolver.resolveToUuid("1");

    expect(uuid).toBe("90cde167-511f-4f6d-bc97-b65a78cf1995");
    expect(fetchMock).toHaveBeenCalledWith(
      "https://localhost:9300/apis/default/api/patient?pid=1",
      expect.objectContaining({
        headers: {
          Authorization: "Bearer bearer-tok-123",
          Accept: "application/json",
        },
      })
    );
  });

  it("caches result for repeated calls", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ uuid: "90cde167-511f-4f6d-bc97-b65a78cf1995" }),
    });

    const resolver = new PatientIdResolver({
      apiBaseUrl: "https://localhost:9300/apis/default/api",
      getAccessToken: getToken,
    });

    const u1 = await resolver.resolveToUuid("1");
    const u2 = await resolver.resolveToUuid("1");

    expect(u1).toBe(u2);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("throws when patient not found (404)", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 404,
      text: () => Promise.resolve("Not found"),
    });

    const resolver = new PatientIdResolver({
      apiBaseUrl: "https://localhost:9300/apis/default/api",
      getAccessToken: getToken,
    });

    await expect(resolver.resolveToUuid("99999")).rejects.toThrow(
      "Patient not found: 99999"
    );
  });

  it("throws when response has no uuid", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({}),
    });

    const resolver = new PatientIdResolver({
      apiBaseUrl: "https://localhost:9300/apis/default/api",
      getAccessToken: getToken,
    });

    await expect(resolver.resolveToUuid("1")).rejects.toThrow(
      "Patient 1 has no UUID in response"
    );
  });

  it("accepts uuid from id field when uuid is absent", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ id: "a1b2c3d4-0000-0000-0000-000000000000" }),
    });

    const resolver = new PatientIdResolver({
      apiBaseUrl: "https://localhost:9300/apis/default/api",
      getAccessToken: getToken,
    });

    const uuid = await resolver.resolveToUuid("1");

    expect(uuid).toBe("a1b2c3d4-0000-0000-0000-000000000000");
  });

  describe("cache TTL", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("returns cached UUID within TTL window", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ uuid: "uuid-ttl-test-1" }),
      });

      const resolver = new PatientIdResolver({
        apiBaseUrl: "https://localhost:9300/apis/default/api",
        getAccessToken: getToken,
      });

      await resolver.resolveToUuid("10");
      // Advance time but stay within 5-minute TTL
      vi.advanceTimersByTime(299_999);
      await resolver.resolveToUuid("10");

      // Should have only fetched once — cache hit
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("re-fetches UUID after TTL expires", async () => {
      fetchMock.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({ uuid: "uuid-ttl-test-2" }),
      });

      const resolver = new PatientIdResolver({
        apiBaseUrl: "https://localhost:9300/apis/default/api",
        getAccessToken: getToken,
      });

      await resolver.resolveToUuid("20");
      expect(fetchMock).toHaveBeenCalledTimes(1);

      // Advance past 5-minute TTL (300_000ms)
      vi.advanceTimersByTime(300_001);

      await resolver.resolveToUuid("20");
      // Should have re-fetched
      expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("evicts oldest entry when cache is full", async () => {
      const resolver = new PatientIdResolver({
        apiBaseUrl: "https://localhost:9300/apis/default/api",
        getAccessToken: getToken,
      });

      // Fill cache to max (100 entries)
      for (let i = 1; i <= 100; i++) {
        fetchMock.mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ uuid: `uuid-${i}` }),
        });
        await resolver.resolveToUuid(`${i}`);
      }

      expect(fetchMock).toHaveBeenCalledTimes(100);

      // Add one more — should evict pid "1"
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ uuid: "uuid-101" }),
      });
      await resolver.resolveToUuid("101");
      expect(fetchMock).toHaveBeenCalledTimes(101);

      // Now pid "1" should have been evicted, requiring a re-fetch
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ uuid: "uuid-1-refetch" }),
      });
      const refetched = await resolver.resolveToUuid("1");
      expect(fetchMock).toHaveBeenCalledTimes(102);
      expect(refetched).toBe("uuid-1-refetch");
    });
  });
});
