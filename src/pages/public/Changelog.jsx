import Markdown from 'react-markdown'
import changelog from '../../../CHANGELOG.md?raw'
import { markdownComponents } from '../../lib/markdownComponents'

export default function Changelog() {
  return (
    <div className="space-y-4">
      <div>
        <p className="section-header">App Updates</p>
        <h1 className="page-title">Changelog</h1>
      </div>
      <div className="card p-5">
        <Markdown components={markdownComponents}>{changelog.replace(/^#[^\n]*\n+/, '')}</Markdown>
      </div>
    </div>
  )
}
