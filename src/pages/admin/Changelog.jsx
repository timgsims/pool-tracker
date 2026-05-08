import changelog from '../../../CHANGELOG.md?raw'

export default function AdminChangelog() {
  return (
    <div className="space-y-4">
      <div>
        <p className="section-header">Release History</p>
        <h2 className="text-lg font-semibold text-slate-100">Changelog</h2>
      </div>
      <div className="card p-5">
        <pre className="text-xs text-slate-300 font-mono whitespace-pre-wrap leading-relaxed">
          {changelog}
        </pre>
      </div>
    </div>
  )
}
