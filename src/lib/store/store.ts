"use client";

import { useSyncExternalStore } from "react";
import { EMPTY_STORE, type StoreData } from "./types";

/**
 * Local data store for trying CertiPay before the Supabase backend is
 * connected. Data lives in this browser only. The shape matches the
 * database tables so the swap to Supabase is a data-layer change.
 */

const KEY = "certipay:v1";
let state: StoreData = EMPTY_STORE;
let loaded = false;
const listeners = new Set<() => void>();

function load() {
  if (loaded || typeof window === "undefined") return;
  loaded = true;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) state = { ...EMPTY_STORE, ...JSON.parse(raw) };
  } catch {
    // Private mode or corrupted data: start empty.
  }
}

function save() {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable: keep working in memory.
  }
}

export function updateStore(fn: (s: StoreData) => StoreData) {
  load();
  state = fn(state);
  save();
  listeners.forEach((l) => l());
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

export const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
