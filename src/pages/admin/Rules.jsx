import { useEffect, useState } from 'react'
import Markdown from 'react-markdown'
import { supabase } from '../../lib/supabase'
import { markdownComponents } from '../../lib/markdownComponents'

export default function AdminRules() {
  const [content, setContent] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    supabase.from('rules').select('content').eq('id', 1).single().then(({ data }) => {
      setContent(data?.content ?? '')
      setLoading(false)
    })
  }, [])

  const save = async () => {
    setSaving(true)
    setSaved(false)
    setError('')
    const { error: e } = await supabase
      .from('rules')
      .upsert({ id: 1, content, updated_at: new Date().toISOString() })
    if (e) { setError(e.message) } else { setSaved(true) }
    setSaving(false)
  }

  if (loading) return null

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-slate-500 text-sm">
          Paste markdown from Claude or type directly. Changes are saved when you click Save.
        </p>
        <div className="flex items-center gap-3 shrink-0">
          {saved && <span className="text-green-400 text-xs">Saved</span>}
          {error && <span className="text-red-400 text-xs">{error}</span>}
          <button onClick={save} disabled={saving} className="btn-primary text-sm py-1.5">
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Editor */}
        <div className="space-y-2">
          <p className="text-slate-600 text-xs font-medium uppercase tracking-wider">Editor</p>
          <textarea
            className="w-full h-[600px] input font-mono text-xs leading-relaxed resize-none"
            value={content}
            onChange={e => { setContent(e.target.value); setSaved(false) }}
            placeholder="# 8-Ball Rules&#10;&#10;## The Basics&#10;&#10;Paste your rules here in markdown format..."
            spellCheck={false}
          />
        </div>

        {/* Preview */}
        <div className="space-y-2">
          <p className="text-slate-600 text-xs font-medium uppercase tracking-wider">Preview</p>
          <div className="card p-5 h-[600px] overflow-y-auto">
            {content.trim() ? (
              <Markdown components={markdownComponents}>{content}</Markdown>
            ) : (
              <p className="text-slate-600 text-sm">Preview will appear here…</p>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
