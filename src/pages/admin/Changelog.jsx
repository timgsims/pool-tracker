import Markdown from 'react-markdown'
import changelog from '../../../CHANGELOG.md?raw'
import { markdownComponents } from '../../lib/markdownComponents'

export default function AdminChangelog() {
  return (
    <div className="space-y-4">
      <div>
        <p className="section-header">Release History</p>
        <h2 className="text-lg font-semibold text-slate-100">Changelog</h2>
      </div>
      <div className="card p-5">
        <Markdown components={markdownComponents}>{changelog.replace(/^#[^\n]*\n+/, '')}</Markdown>
      </div>
    </div>
  )
}
