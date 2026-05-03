import { useRef, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../contexts/AuthContext'
import Avatar from '../../components/ui/Avatar'

export default function AccountSettings() {
  const { linkedPlayerId, linkedPlayerName, linkedPlayerAvatar, refreshRole } = useAuth()

  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwdSaving, setPwdSaving] = useState(false)
  const [pwdSuccess, setPwdSuccess] = useState(false)
  const [pwdError, setPwdError] = useState('')

  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  const [avatarError, setAvatarError] = useState('')
  const fileInputRef = useRef(null)

  const handlePasswordChange = async (e) => {
    e.preventDefault()
    if (newPassword !== confirmPassword) { setPwdError('Passwords do not match'); return }
    if (newPassword.length < 6) { setPwdError('Password must be at least 6 characters'); return }
    setPwdSaving(true)
    setPwdError('')
    setPwdSuccess(false)
    const { error } = await supabase.auth.updateUser({ password: newPassword })
    if (error) {
      setPwdError(error.message)
    } else {
      setPwdSuccess(true)
      setNewPassword('')
      setConfirmPassword('')
    }
    setPwdSaving(false)
  }

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file || !linkedPlayerId) return
    setUploadingAvatar(true)
    setAvatarError('')
    try {
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(linkedPlayerId, file, { upsert: true, contentType: file.type })
      if (uploadError) throw uploadError
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(linkedPlayerId)
      const bustedUrl = `${publicUrl}?t=${Date.now()}`
      await supabase.from('players').update({ avatar_url: bustedUrl }).eq('id', linkedPlayerId)
      await refreshRole()
    } catch (err) {
      setAvatarError(err.message || 'Upload failed — check the avatars bucket exists and is public.')
    } finally {
      setUploadingAvatar(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  return (
    <div className="max-w-lg mx-auto space-y-6">
      <div>
        <p className="section-header">Settings</p>
        <h1 className="page-title">Account</h1>
      </div>

      {linkedPlayerId && (
        <div className="card p-5 space-y-4">
          <p className="section-header mb-0">Profile Picture</p>
          <div className="flex items-center gap-4">
            <Avatar name={linkedPlayerName} src={linkedPlayerAvatar} size="xl" />
            <div>
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="btn-primary text-sm py-1.5"
              >
                {uploadingAvatar ? 'Uploading…' : 'Upload new photo'}
              </button>
              <p className="text-slate-600 text-xs mt-1.5">JPG, PNG or GIF · max 2 MB recommended</p>
              {avatarError && <p className="text-red-400 text-xs mt-1.5">{avatarError}</p>}
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="absolute opacity-0 w-0 h-0 pointer-events-none"
            onChange={handleAvatarUpload}
          />
        </div>
      )}

      <div className="card p-5 space-y-4">
        <p className="section-header mb-0">Change Password</p>
        <form onSubmit={handlePasswordChange} className="space-y-3">
          <div>
            <label className="label">New password</label>
            <input
              type="password"
              className="input"
              value={newPassword}
              onChange={e => setNewPassword(e.target.value)}
              autoComplete="new-password"
              required
              minLength={6}
            />
          </div>
          <div>
            <label className="label">Confirm new password</label>
            <input
              type="password"
              className="input"
              value={confirmPassword}
              onChange={e => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              required
            />
          </div>
          {pwdError && <p className="text-red-400 text-sm">{pwdError}</p>}
          {pwdSuccess && <p className="text-green-400 text-sm">Password updated successfully.</p>}
          <button
            type="submit"
            disabled={pwdSaving || !newPassword || !confirmPassword}
            className="btn-primary text-sm py-1.5"
          >
            {pwdSaving ? 'Saving…' : 'Update Password'}
          </button>
        </form>
      </div>
    </div>
  )
}
