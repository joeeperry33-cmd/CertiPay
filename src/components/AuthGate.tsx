"use client";

import { useEffect, useState, type ReactNode } from "react";
import type { Session } from "@supabase/supabase-js";
import { Button, Card, Field, Input } from "./ui";
import { cloudEnabled, supabase } from "@/lib/supabase";
import { loadCompany, syncChanges } from "@/lib/store/remote";
import { clearCloudData, startCloudData, useSyncStatus } from "@/lib/store/store";

type Phase =
  | { kind: "checking" }
  | { kind: "signedOut" }
  | { kind: "noCompany"; session: Session }
  | { kind: "loading" }
  | { kind: "ready"; session: Session; companyId: string }
  | { kind: "error"; message: string };

/**
 * With Supabase configured, requires sign-in and a company before showing the
 * app, then loads that company's data. Without it, shows the app as-is
 * (browser-only preview).
 */
export function AuthGate({ children }: { children: ReactNode }) {
  if (!cloudEnabled) return <>{children}</>;
  return <CloudGate>{children}</CloudGate>;
}

function CloudGate({ children }: { children: ReactNode }) {
  const [phase, setPhase] = useState<Phase>({ kind: "checking" });

  useEffect(() => {
    const sb = supabase();
    let cancelled = false;

    async function start(session: Session | null) {
      if (cancelled) return;
      if (!session) {
        clearCloudData();
        setPhase({ kind: "signedOut" });
        return;
      }
      setPhase({ kind: "loading" });
      const { data, error } = await sb
        .from("company_members")
        .select("company_id")
        .eq("user_id", session.user.id)
        .limit(1);
      if (cancelled) return;
      if (error) return setPhase({ kind: "error", message: error.message });
      const companyId = data?.[0]?.company_id as string | undefined;
      if (!companyId) return setPhase({ kind: "noCompany", session });
      try {
        const loaded = await loadCompany(sb, companyId);
        if (cancelled) return;
        startCloudData(loaded, (prev, next) => syncChanges(sb, companyId, prev, next));
        setPhase({ kind: "ready", session, companyId });
      } catch (e) {
        setPhase({ kind: "error", message: e instanceof Error ? e.message : String(e) });
      }
    }

    sb.auth.getSession().then(({ data }) => start(data.session));
    const { data: sub } = sb.auth.onAuthStateChange((event, session) => {
      if (event === "SIGNED_IN" || event === "SIGNED_OUT") start(session);
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  switch (phase.kind) {
    case "checking":
    case "loading":
      return <p className="py-12 text-center text-slate-500">Loading…</p>;
    case "signedOut":
      return <SignIn />;
    case "noCompany":
      return <CreateCompany onCreated={() => window.location.reload()} />;
    case "error":
      return (
        <Card className="mx-auto max-w-md">
          <p className="text-red-700">Couldn&apos;t load your data: {phase.message}</p>
          <Button className="mt-4" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </Card>
      );
    case "ready":
      return (
        <>
          <AccountBar email={phase.session.user.email ?? ""} />
          {children}
        </>
      );
  }
}

function AccountBar({ email }: { email: string }) {
  const sync = useSyncStatus();
  return (
    <div className="mb-4 flex flex-wrap items-center justify-end gap-3 text-xs text-slate-500 print:hidden">
      {sync.error ? (
        <span className="rounded bg-red-50 px-2 py-1 text-red-800">Not saved: {sync.error}. Reload to see saved data.</span>
      ) : sync.saving > 0 ? (
        <span>Saving…</span>
      ) : (
        <span>All changes saved</span>
      )}
      <span>{email}</span>
      <button className="text-blue-700 hover:underline" onClick={() => supabase().auth.signOut()}>
        Sign out
      </button>
    </div>
  );
}

function SignIn() {
  const [mode, setMode] = useState<"signIn" | "signUp">("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    setMessage(null);
    const sb = supabase();
    const { data, error } =
      mode === "signIn"
        ? await sb.auth.signInWithPassword({ email, password })
        : await sb.auth.signUp({ email, password, options: { emailRedirectTo: window.location.origin } });
    setBusy(false);
    if (error) return setMessage({ ok: false, text: error.message });
    if (mode === "signUp" && !data.session) {
      setMessage({ ok: true, text: "Check your email to confirm your account, then sign in." });
    }
  };

  return (
    <Card className="mx-auto max-w-md">
      <h1 className="text-xl font-bold text-slate-900">{mode === "signIn" ? "Sign in to CertiPay" : "Create your account"}</h1>
      <form
        className="mt-4 space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <Field label="Email">
          <Input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </Field>
        <Field label="Password" hint={mode === "signUp" ? "At least 8 characters." : undefined}>
          <Input
            type="password"
            autoComplete={mode === "signIn" ? "current-password" : "new-password"}
            minLength={mode === "signUp" ? 8 : undefined}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </Field>
        {message && <p className={`text-sm ${message.ok ? "text-green-700" : "text-red-700"}`}>{message.text}</p>}
        <Button type="submit" disabled={busy} className="w-full">
          {mode === "signIn" ? "Sign in" : "Create account"}
        </Button>
      </form>
      <button
        className="mt-4 text-sm text-blue-700 hover:underline"
        onClick={() => {
          setMode(mode === "signIn" ? "signUp" : "signIn");
          setMessage(null);
        }}
      >
        {mode === "signIn" ? "New to CertiPay? Create an account" : "Already have an account? Sign in"}
      </button>
    </Card>
  );
}

function CreateCompany({ onCreated }: { onCreated: () => void }) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <Card className="mx-auto max-w-md">
      <h1 className="text-xl font-bold text-slate-900">Set up your company</h1>
      <p className="mt-1 text-sm text-slate-600">You can add your license and DIR numbers on the Company page next.</p>
      <form
        className="mt-4 space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setBusy(true);
          const { error } = await supabase().rpc("create_company", { company_name: name.trim() });
          setBusy(false);
          if (error) setError(error.message);
          else onCreated();
        }}
      >
        <Field label="Company name">
          <Input required value={name} onChange={(e) => setName(e.target.value)} />
        </Field>
        {error && <p className="text-sm text-red-700">{error}</p>}
        <Button type="submit" disabled={busy || !name.trim()} className="w-full">
          Continue
        </Button>
      </form>
    </Card>
  );
}
