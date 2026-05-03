import { useEffect, useState } from 'react'
import Markdown from 'react-markdown'
import { supabase } from '../../lib/supabase'
import { markdownComponents } from '../../lib/markdownComponents'
import LoadingSpinner from '../../components/ui/LoadingSpinner'
import EmptyState from '../../components/ui/EmptyState'

export default function Rules() {
  const [content, setContent] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('rules').select('content').eq('id', 1).single().then(({ data }) => {
      setContent(data?.content ?? '')
      setLoading(false)
    })
  }, [])

  if (loading) return <LoadingSpinner />

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-center gap-4 py-2">
        <img
          src={`${import.meta.env.BASE_URL}logo-white-v2.png`}
          alt="Pool Tracker"
          className="h-16 w-auto"
        />
        <div className="text-center">
          <p className="section-header">Reference</p>
          <h1 className="page-title">Rules</h1>
        </div>
      </div>

      <div className="card p-5">
        {content?.trim() ? (
          <Markdown components={markdownComponents}>{content}</Markdown>
        ) : (
          <EmptyState
            title="No rules posted yet"
            message="The admin hasn't uploaded the rules yet."
          />
        )}
      </div>
    </div>
  )
}
