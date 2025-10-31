export function GlassHeader({ children, className = "" }) {
  return (
    <div className={`glass rounded-2xl border border-glass-border dark:border-glass-borderDark px-5 py-4 md:px-6 md:py-5 shadow-glass ${className}`}>
      {children}
    </div>
  );
}
