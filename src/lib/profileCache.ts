import { useEffect, useState } from "react";
import { readProfile, toProfile, Profile } from "./chain";

const cache = new Map<string, Profile>();
const inflight = new Map<string, Promise<Profile>>();

async function fetchOne(addr: string): Promise<Profile> {
  const key = addr.toLowerCase();
  if (cache.has(key)) return cache.get(key)!;
  if (inflight.has(key)) return inflight.get(key)!;
  const p = readProfile().getProfile(addr).then((raw: any) => {
    const prof = toProfile(raw);
    cache.set(key, prof);
    inflight.delete(key);
    return prof;
  }).catch(() => {
    const empty = toProfile({ username: "", displayName: "", bio: "", avatarURI: "", coverURI: "", createdAt: 0, updatedAt: 0, exists: false });
    inflight.delete(key);
    return empty;
  });
  inflight.set(key, p);
  return p;
}

/** Resolve profiles for a set of addresses; re-renders as they arrive. */
export function useProfiles(addresses: string[]): Record<string, Profile> {
  const [map, setMap] = useState<Record<string, Profile>>({});
  const keySig = addresses.map((a) => a.toLowerCase()).sort().join(",");
  useEffect(() => {
    let live = true;
    const uniq = Array.from(new Set(addresses.map((a) => a.toLowerCase())));
    Promise.all(uniq.map(async (a) => [a, await fetchOne(a)] as const)).then((pairs) => {
      if (!live) return;
      setMap((prev) => {
        const next = { ...prev };
        for (const [a, p] of pairs) next[a] = p;
        return next;
      });
    });
    return () => { live = false; };
  }, [keySig]);
  return map;
}
