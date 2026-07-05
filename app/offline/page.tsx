export const metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-3 px-5 text-center">
      <p className="font-dot text-4xl text-lime">Offline</p>
      <p className="text-sm text-muted">
        No connection. Your workout draft is saved locally — reconnect to sync.
      </p>
    </main>
  );
}
