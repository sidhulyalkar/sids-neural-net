export function NeuralAtlasLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg-deep px-6 text-center">
      <div className="border border-white/10 bg-white/[0.035] p-5 backdrop-blur-xl">
        <p className="font-mono text-xs uppercase tracking-[0.24em] text-cyan/75">initializing atlas</p>
        <p className="mt-3 text-sm text-text-secondary">Preparing the neural tissue renderer...</p>
      </div>
    </div>
  );
}
