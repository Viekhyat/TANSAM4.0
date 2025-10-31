export default function LiquidBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute -top-24 -left-24 h-80 w-80 rounded-full bg-blue-400/40 dark:bg-blue-500/30 liquid-blob animate-blob"></div>
      <div className="absolute bottom-0 -right-20 h-96 w-96 rounded-full bg-cyan-300/40 dark:bg-indigo-500/25 liquid-blob animate-blob-slow"></div>
    </div>
  );
}
