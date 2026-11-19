"use client";

import { useSyncExternalStore } from "react";
import { EMPTY_STORE, type StoreData } from "./types";

/**
 * App data store. Two modes:
 *  - local: data lives in this browser's localStorage (preview, no account)
 *  - cloud: data is loaded from Supabase after sign-in, and every change is
 *    written back through the registered sync function.
 * Pages use the same useStore/updateStore API in both modes.
 */

const KEY = "certipay:v1";
let state: StoreData = EMPTY_STORE;
let loaded = false;
let cloud: ((prev: StoreData, next: StoreData) => Promise<void>) | null = null;
const listeners = new Set<() => void>();

export type SyncStatus = { saving: number; error: string | null };
let syncStatus: SyncStatus = { saving: 0, error: null };
const syncListeners = new Set<() => void>();
function setSync(s: SyncStatus) {
  syncStatus = s;
  syncListeners.forEach((l) => l());
}

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  if (cloud) return;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = { ...EMPTY_STORE, ...JSON.parse(raw) };
  } catch {
    // Private mode or corrupted data: start empty.
  }
}

function saveLocal() {
  if (cloud) return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable: keep working in memory.
  }
}

function emit() {
  listeners.forEach((l) => l());
}

export function updateStore(fn: (s: StoreData) => StoreData) {
  load();
  const prev = state;
  state = fn(state);
  saveLocal();
  emit();
  if (cloud) {
    const sync = cloud;
    setSync({ saving: syncStatus.saving + 1, error: syncStatus.error });
    sync(prev, state)
      .then(() => setSync({ saving: syncStatus.saving - 1, error: null }))
      .catch((e: unknown) =>
        setSync({ saving: syncStatus.saving - 1, error: e instanceof Error ? e.message : String(e) }),
      );
  }
}

/** Switch to cloud mode with data loaded from the server. */
export function startCloudData(data: StoreData, sync: (prev: StoreData, next: StoreData) => Promise<void>) {
  cloud = sync;
  loaded = true;
  state = data;
  emit();
}

/** Leave cloud mode (sign out): clear data from memory. */
export function clearCloudData() {
  cloud = null;
  state = EMPTY_STORE;
  loaded = true;
  emit();
}

function subscribe(l: () => void) {
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useStore(): StoreData {
  return useSyncExternalStore(
    subscribe,
    () => {
      load();
      return state;
    },
    () => EMPTY_STORE,
  );
}

export function useSyncStatus(): SyncStatus {
  return useSyncExternalStore(
    (l) => {
      syncListeners.add(l);
      return () => syncListeners.delete(l);
    },
    () => syncStatus,
    () => syncStatus,
  );
}

export { newId } from "../ids";
