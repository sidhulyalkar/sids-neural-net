export function NeuralAtlasLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-black px-6 text-center">
      <div className="h-2 w-2 animate-pulse rounded-full bg-cyan shadow-[0_0_32px_rgba(102,227,255,0.75)]" />
      <div className="sr-only">Initializing neural atlas</div>
    </div>
  );
}
