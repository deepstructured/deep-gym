import { createBackendDataClient, type BackendReply } from "./backend-data-client";
import { createBackendStorageClient } from "./backend-storage-client";

export interface BackendSession {
  access_token: string; refresh_token: string; expires_at: number; expires_in: number; token_type: string;
  user: { id: string; email?: string; user_metadata: Record<string, unknown>; app_metadata: Record<string, unknown>; aud: string; created_at: string };
}
type AuthEvent = "INITIAL_SESSION" | "SIGNED_IN" | "SIGNED_OUT" | "TOKEN_REFRESHED" | "USER_UPDATED";
interface ClientOptions {
  origin: string;
  fetcher?: typeof fetch;
  native?: boolean;
  storage?: { getItem(key: string): Promise<string | null>; setItem(key: string, value: string): Promise<void>; removeItem(key: string): Promise<void> };
  createPkce?: () => Promise<{ verifier: string; challenge: string }>;
}

/** Auth and data façade for the application's own HTTP API. Browser refresh
 * credentials stay in HttpOnly cookies; native credentials use secure storage
 * supplied by the host application. No database secrets enter either client. */
export function createBackendClient(options: ClientOptions) {
  const origin = options.origin.replace(/\/$/, "");
  const fetcher = options.fetcher ?? fetch;
  const storageKey = `deepgym-auth:${origin}`;
  let current: BackendSession | null = null;
  let loaded = false;
  let readAt = 0;
  let pending: Promise<BackendSession | null> | undefined;
  let refreshPending: Promise<BackendSession | null> | undefined;
  let generation = 0;
  let pendingGeneration = -1;
  let refreshGeneration = -1;
  let persistence: Promise<void> = Promise.resolve();
  let timer: ReturnType<typeof setInterval> | undefined;
  const listeners = new Set<(event: AuthEvent, session: BackendSession | null) => void>();
  const channel = !options.native && typeof window !== "undefined" && typeof BroadcastChannel !== "undefined"
    ? new BroadcastChannel("deepgym-auth-events") : null;

  async function persist(session: BackendSession | null, attempt = generation) {
    if (options.native && options.storage) {
      persistence = persistence.catch(() => {}).then(async () => {
        if (attempt !== generation) return;
        if (session) await options.storage!.setItem(storageKey, JSON.stringify(session));
        else await options.storage!.removeItem(storageKey);
      });
      await persistence;
    }
  }
  function emit(event: AuthEvent, session: BackendSession | null, broadcast = true) {
    current = session; loaded = true; readAt = Date.now();
    listeners.forEach((listener) => listener(event, session));
    // Never broadcast credentials. Other tabs obtain the session from cookies.
    if (broadcast) channel?.postMessage({ event });
  }
  async function authRequest(operation?: string, input: Record<string, unknown> = {}, explicitToken?: string): Promise<BackendSession | null> {
    const headers: Record<string, string> = {};
    if (options.native) headers["x-deepgym-client"] = "native";
    if (explicitToken ?? (options.native && current?.access_token)) headers.Authorization = `Bearer ${explicitToken ?? current?.access_token}`;
    if (operation) headers["Content-Type"] = "application/json";
    const response = await fetcher(`${origin}/api/auth/session`, { method: operation ? "POST" : "GET", credentials: options.native ? "omit" : "same-origin", headers, body: operation ? JSON.stringify({ operation, ...input }) : undefined });
    const result = await response.json();
    if (!response.ok) {
      const error = new Error(result.error ?? "Authentication unavailable") as Error & { status: number };
      error.status = response.status;
      throw error;
    }
    return result.session ?? null;
  }
  async function rotate(): Promise<BackendSession | null> {
    if (!refreshPending || refreshGeneration !== generation) {
      const attempt = generation;
      refreshGeneration = attempt;
      refreshPending = (async () => {
      const session = await authRequest("refresh", { refresh_token: current?.refresh_token || undefined });
      if (attempt !== generation) return current;
      await persist(session,attempt);
      if (attempt !== generation) return current;
      emit("TOKEN_REFRESHED", session); return session;
      })().catch(async (error: unknown) => {
        if (error instanceof Error && "status" in error && error.status === 401 && attempt === generation) {
          await persist(null,attempt);
          if (attempt === generation) emit("SIGNED_OUT",null);
          return current;
        }
        throw error;
      }).finally(() => { if (refreshGeneration === attempt) refreshPending = undefined; });
    }
    return refreshPending;
  }
  async function load(force = false): Promise<BackendSession | null> {
    if (!force && loaded && Date.now() - readAt < 30_000 && (!current || current.expires_at > Date.now() / 1000 + 30)) return current;
    if (!pending || pendingGeneration !== generation) {
      const attempt = generation;
      pendingGeneration = attempt;
      pending = (async () => {
      if (!loaded && options.native && options.storage) {
        const saved = await options.storage.getItem(storageKey);
        if (attempt !== generation) return current;
        try { current = saved ? JSON.parse(saved) : null; } catch { current = null; }
      }
      if (options.native && current && current.expires_at <= Date.now() / 1000 + 30) return rotate();
      if (options.native && !current) { loaded = true; readAt = Date.now(); return null; }
      const session = await authRequest();
      if (attempt !== generation) return current;
      // Web never receives its refresh credential. Native keeps the one it
      // already owns when GET returns only a fresh short-lived access token.
      if (session && options.native && !session.refresh_token) session.refresh_token = current?.refresh_token ?? "";
      await persist(session,attempt);
      if (attempt !== generation) return current;
      current = session; loaded = true; readAt = Date.now(); return session;
      })().finally(() => { if (pendingGeneration === attempt) pending = undefined; });
    }
    return pending;
  }
  channel?.addEventListener("message", (message) => {
    if (!["SIGNED_IN", "SIGNED_OUT", "TOKEN_REFRESHED", "USER_UPDATED"].includes(message.data?.event)) return;
    const attempt = ++generation;
    if (message.data.event === "SIGNED_OUT") emit("SIGNED_OUT", null, false);
    else void load(true).then((session) => { if (attempt === generation) emit(message.data.event, session, false); }).catch(() => {});
  });

  async function authenticatedFetch(path: string, init: RequestInit = {}) {
    const headers = new Headers(init.headers);
    if (options.native) {
      const session = await load();
      if (session) headers.set("Authorization", `Bearer ${session.access_token}`);
    }
    const attempt = generation;
    const response = await fetcher(`${origin}${path}`, { ...init, headers, credentials: options.native ? "omit" : "same-origin" });
    if (response.status === 401 && attempt === generation) {
      // A server-revoked cookie must clear warm UI caches too. Do not replay a
      // mutation automatically, especially if another account signed in.
      try {
        const before = current?.user.id;
        const session = await load(true);
        if (attempt === generation && (!session || session.user.id !== before)) emit(session ? "SIGNED_IN" : "SIGNED_OUT",session);
      } catch { /* A transient auth outage keeps the explicit request error. */ }
    }
    return response;
  }
  const failed = (error: unknown) => error instanceof Error ? error : new Error("Authentication unavailable");
  const auth = {
    async getSession() {
      try { return { data: { session: await load() }, error: null }; }
      catch (error) { return { data: { session: null }, error: failed(error) }; }
    },
    async getUser(token?: string) {
      try { const session = token ? await authRequest(undefined, {}, token) : await load(true); return { data: { user: session?.user ?? null }, error: null }; }
      catch (error) { return { data: { user: null }, error: failed(error) }; }
    },
    async getClaims() {
      const result = await this.getSession();
      return { data: result.data.session ? { claims: { sub: result.data.session.user.id } } : null, error: result.error };
    },
    onAuthStateChange(callback: (event: AuthEvent, session: BackendSession | null) => void) {
      listeners.add(callback);
      void load().then((session) => { if (listeners.has(callback)) callback("INITIAL_SESSION", session); }).catch(() => { if (listeners.has(callback)) callback("INITIAL_SESSION", null); });
      return { data: { subscription: { unsubscribe: () => { listeners.delete(callback); } } } };
    },
    async signInWithOAuth(input: { provider: string; options?: { redirectTo?: string; skipBrowserRedirect?: boolean } }) {
      try {
        if (input.provider !== "google") throw new Error("Unsupported sign-in provider");
        const url = new URL(`${origin}/api/auth/google/start`);
        if (options.native) {
          if (!options.createPkce || !options.storage) throw new Error("Native PKCE is not configured");
          const pair = await options.createPkce();
          await options.storage.setItem(`${storageKey}:pkce`, pair.verifier);
          url.searchParams.set("redirect_to", "deepgym://auth/callback");
          url.searchParams.set("code_challenge", pair.challenge);
        }
        if (!input.options?.skipBrowserRedirect && typeof window !== "undefined") window.location.assign(url.href);
        return { data: { provider: "google", url: url.href }, error: null };
      } catch (error) { return { data: { provider: "google", url: null }, error: failed(error) }; }
    },
    async exchangeCodeForSession(code: string) {
      const attempt = ++generation;
      try {
        const verifier = await options.storage?.getItem(`${storageKey}:pkce`);
        const session = await authRequest("exchange", { code, verifier });
        if (attempt !== generation) return { data: { session: current, user: current?.user ?? null }, error: null };
        await options.storage?.removeItem(`${storageKey}:pkce`);
        await persist(session,attempt);
        if (attempt === generation) emit("SIGNED_IN", session);
        return { data: { session: current, user: current?.user ?? null }, error: null };
      } catch (error) { return { data: { session: null, user: null }, error: failed(error) }; }
    },
    async setSession(tokens: { access_token: string; refresh_token: string }) {
      const attempt = ++generation;
      try {
        const session = await authRequest("set", { refresh_token: tokens.refresh_token });
        if (attempt !== generation) return { data: { session: current, user: current?.user ?? null }, error: null };
        await persist(session,attempt);
        if (attempt === generation) emit("SIGNED_IN", session);
        return { data: { session: current, user: current?.user ?? null }, error: null };
      } catch (error) { return { data: { session: null, user: null }, error: failed(error) }; }
    },
    async signOut(_options?: { scope?: string }) {
      const attempt = ++generation;
      try { await authRequest("logout", { refresh_token: options.native ? current?.refresh_token : undefined }); await persist(null,attempt); if (attempt === generation) emit("SIGNED_OUT", null); return { error: null }; }
      catch (error) { return { error: failed(error) }; }
    },
    async resetLocalSession() {
      const attempt = ++generation;
      if (options.native) { await persist(null,attempt); if (attempt === generation) emit("SIGNED_OUT", null); return; }
      await authRequest("reset"); if (attempt === generation) emit("SIGNED_OUT", null);
    },
    async refreshSession() {
      try { return { data: { session: await rotate() }, error: null }; }
      catch (error) { return { data: { session: null }, error: failed(error) }; }
    },
    async updateUser(input: { data?: Record<string, unknown> }) {
      const attempt = generation;
      try {
        // A metadata change must not invalidate a rotation that the server has
        // already committed. Wait for that credential before sending a write.
        if (refreshPending && refreshGeneration === attempt) await refreshPending;
        if (attempt !== generation) return { data: { user: current?.user ?? null }, error: null };
        const session = await authRequest("update", { data: input.data });
        if (attempt === generation && session) {
          // Update only metadata: a refresh that completed during this request
          // owns the access/refresh credentials. Native storage is refreshed by
          // login/rotation, and the next startup fetch reloads user metadata.
          const updated = current?.user.id === session.user.id ? { ...current, user: session.user } : session;
          emit("USER_UPDATED", updated);
        }
        return { data: { user: current?.user ?? null }, error: null };
      }
      catch (error) { return { data: { user: null }, error: failed(error) }; }
    },
    async signInWithIdToken() { return { data: { session: null, user: null }, error: new Error("Apple sign-in is not configured on this server") }; },
    startAutoRefresh() {
      if (!timer) timer = setInterval(() => { if (current && current.expires_at < Date.now() / 1000 + 120) void load(true).then((session) => emit("TOKEN_REFRESHED", session)).catch(() => {}); }, 60_000);
    },
    stopAutoRefresh() { if (timer) clearInterval(timer); timer = undefined; },
  };
  const data = createBackendDataClient(async (operation, input, signal): Promise<BackendReply> => {
    const response = await authenticatedFetch("/api/data", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ operation, input }), signal });
    const result = await response.json();
    return result;
  }, () => current?.user.id ?? null);
  return { ...data, auth, storage: createBackendStorageClient(authenticatedFetch, origin), authenticatedFetch };
}
