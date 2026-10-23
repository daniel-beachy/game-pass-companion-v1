import { chunk, fetchJson } from "./util.ts";

// Public Game Pass list ids ("sigls") used by xbox.com. Verified Oct 2026.
export const LISTS = {
  console: "f6f1f99f-9b49-4ccd-b3bf-4d9767a77f5e",
  pc: "fdd9e2a7-0fee-49f6-ad69-4354098401ff",
  pcAll: "609d944c-d395-4c0a-9ea4-e9f39b52c1ad",
  cloud: "29a81209-df6f-41fd-a528-2ae6b91f719c",
  eaConsole: "b8900d09-a491-44cc-916e-32b5acae621b",
  eaPc: "1d33fbb9-b895-4732-a8ca-a55c8b99fa2c",
  comingConsole: "095bda36-f5cd-43f2-9ee1-0a72f371fb96",
  comingPc: "4165f752-d702-49c8-886b-fb57936f6bae",
  leavingConsole: "393f05bf-e596-4ef6-9487-6d4fa0eab987",
  leavingPc: "cc7fc951-d00f-410e-9e02-5e4628e04163",
  recentConsole: "f13cf6b4-57e6-4459-89df-6aec18cf0538",
  recentPc: "163cdff5-442e-4957-97f5-1050a3546511",
} as const;
export type ListName = keyof typeof LISTS;

// Pass product ids seen in PassMetadataByPassProductId.
export const PASS_EA_PLAY = "CFQ7TTC0K5DH";

export async function fetchList(id: string): Promise<string[]> {
  const data = await fetchJson<any[]>(`https://catalog.gamepass.com/sigls/v2?id=${id}&language=en-us&market=US`);
  return data.slice(1).map((x) => x.id as string);
}

export async function fetchAllLists(): Promise<Record<ListName, string[]>> {
  const out = {} as Record<ListName, string[]>;
  for (const [name, id] of Object.entries(LISTS) as [ListName, string][]) out[name] = await fetchList(id);
  return out;
}

export async function fetchProducts(ids: string[]): Promise<Record<string, any>> {
  const out: Record<string, any> = {};
  for (const batch of chunk(ids, 100)) {
    const res = await fetchJson<{ Products: Record<string, any> }>(
      "https://catalog.gamepass.com/v3/products?market=US&language=en-US&hydration=RemoteHighSapphire0",
      {
        method: "POST",
        body: JSON.stringify({ Products: batch }),
        headers: { "Content-Type": "application/json", "ms-cv": "gpc.1", "calling-app-name": "GamePassCompanion", "calling-app-version": "1.0" },
      },
    );
    Object.assign(out, res.Products);
  }
  return out;
}

export const img = (u?: { URL?: string }) => (u?.URL ? (u.URL.startsWith("//") ? "https:" + u.URL : u.URL) : undefined);

/** "Xbox local co-op (2-4)" -> 4, "(2)" -> 2 */
export function attrMax(localized: string): number | null {
  const m = localized.match(/\((\d+)(?:\s*-\s*(\d+))?\)/);
  if (!m) return null;
  return Number(m[2] ?? m[1]);
}
