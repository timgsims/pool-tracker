import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [roleData, setRoleData] = useState(null) // { role, player_id }
  const [loading, setLoading] = useState(true)

  const fetchRole = useCallback(async (userId) => {
    if (!userId) {
      setRoleData(null)
      return
    }
    const { data } = await supabase
      .from('user_roles')
      .select('role, player_id')
      .eq('user_id', userId)
      .single()
    setRoleData(data ?? null)
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      fetchRole(session?.user?.id).finally(() => setLoading(false))
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
      setUser(session?.user ?? null)
      fetchRole(session?.user?.id)
    })

    return () => subscription.unsubscribe()
  }, [fetchRole])

  const signIn = (email, password) =>
    supabase.auth.signInWithPassword({ email, password })

  const signUp = (email, password) =>
    supabase.auth.signUp({ email, password })

  const signOut = () => supabase.auth.signOut()

  const refreshRole = useCallback(() => fetchRole(user?.id), [fetchRole, user?.id])

  const role = roleData?.role ?? null
  const linkedPlayerId = roleData?.player_id ?? null
  const isAdmin = role === 'admin'
  const isPlayer = role === 'player' || role === 'admin'
  const isAuthenticated = !!session

  return (
    <AuthContext.Provider value={{
      session,
      user,
      role,
      linkedPlayerId,
      loading,
      isAdmin,
      isPlayer,
      isAuthenticated,
      signIn,
      signUp,
      signOut,
      refreshRole,
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export const useAuth = () => {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
