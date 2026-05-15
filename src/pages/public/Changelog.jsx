import changelog from '../../../CHANGELOG.md?raw'

export default function Changelog() {
  return (
    <div className="space-y-4">
      <div>
        <p className="section-header">App Updates</p>
        <h1 className="page-title">Changelog</h1>
      </div>
      <div className="card p-5">
        <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">
          {changelog}
        </pre>
      </div>
    </div>
  )
}
