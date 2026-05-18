export function NeuralBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(102,227,255,0.11),transparent_24rem),radial-gradient(circle_at_22%_20%,rgba(167,139,250,0.14),transparent_22rem),radial-gradient(circle_at_82%_76%,rgba(91,140,255,0.12),transparent_26rem),linear-gradient(180deg,#02040c_0%,#050914_54%,#080416_100%)]" />
      <div className="neural-dust absolute inset-0 opacity-70" />
      <div className="absolute left-1/2 top-1/2 h-[58rem] w-[58rem] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan/10 opacity-50" />
      <div className="absolute left-[10%] top-[12%] h-52 w-52 rounded-full bg-violet/10 blur-3xl" />
      <div className="absolute bottom-[10%] right-[8%] h-64 w-64 rounded-full bg-cyan/10 blur-3xl" />
      <div className="absolute inset-x-0 bottom-0 h-48 bg-gradient-to-t from-bg-deep to-transparent" />
    </div>
  );
}
