export default function GlassCard({ className = "", children }) {
  return (
    <div className={`glass glass-hover rounded-2xl border border-glass-border dark:border-glass-borderDark p-4 md:p-6 shadow-glass ${className}`}>
      {children}
    </div>
  );
}
