export const markdownComponents = {
  h1: ({ children }) => <h1 className="text-2xl font-bold text-slate-100 mt-6 mb-3 first:mt-0">{children}</h1>,
  h2: ({ children }) => <h2 className="text-lg font-semibold text-slate-100 mt-5 mb-2 first:mt-0">{children}</h2>,
  h3: ({ children }) => <h3 className="text-base font-semibold text-slate-200 mt-4 mb-1 first:mt-0">{children}</h3>,
  p: ({ children }) => <p className="text-slate-300 leading-relaxed mb-3 last:mb-0">{children}</p>,
  ul: ({ children }) => <ul className="list-disc pl-5 text-slate-300 mb-3 space-y-1">{children}</ul>,
  ol: ({ children }) => <ol className="list-decimal pl-5 text-slate-300 mb-3 space-y-1">{children}</ol>,
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => <strong className="text-slate-100 font-semibold">{children}</strong>,
  em: ({ children }) => <em className="text-slate-300 italic">{children}</em>,
  hr: () => <hr className="border-pool-border my-5" />,
  blockquote: ({ children }) => (
    <blockquote className="border-l-2 border-pool-accent pl-4 text-slate-400 italic my-3">
      {children}
    </blockquote>
  ),
  code: ({ children }) => (
    <code className="bg-pool-elevated text-pool-accent px-1.5 py-0.5 rounded text-sm font-mono">
      {children}
    </code>
  ),
}
