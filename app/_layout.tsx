import { useCallback, useEffect, useState } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { supabase } from '../lib/supabase'
import { Session } from '@supabase/supabase-js'
import { View } from 'react-native'
import AnimatedSplash from '../components/AnimatedSplash'

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSplash, setShowSplash] = useState(true)
  const router = useRouter()
  const segments = useSegments()

  const loadRole = useCallback(async (session: Session | null) => {
    if (!session) {
      setRole(null)
      return
    }

    const metadataRole = session.user.user_metadata?.role
    const { data, error } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .maybeSingle()

    if (error) {
      console.warn('role load error:', error)
    }

    setRole(data?.role ?? (typeof metadataRole === 'string' ? metadataRole : null))
  }, [])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }: { data: { session: Session | null } }) => {
      setSession(session)
      await loadRole(session)
      setLoading(false)
    })

    const { data: authListener } = supabase.auth.onAuthStateChange((_event: any, session: Session | null) => {
      setSession(session)
      setTimeout(() => {
        loadRole(session)
      }, 0)
    })

    return () => {
      authListener.subscription.unsubscribe()
    }
  }, [loadRole])

  useEffect(() => {
    if (loading) return

    const inAuthGroup = segments[0] === '(auth)'
    const inKidGroup = segments[0] === '(kid)'
    const inParentGroup = segments[0] === '(parent)'

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login' as any)
    } else if (session && role === 'kid' && !inKidGroup) {
      router.replace('/(kid)')
    } else if (session && role === 'parent' && !inParentGroup) {
      router.replace('/(parent)')
    }
  }, [session, role, loading, segments])

  return (
    <View style={{ flex: 1 }}>
      <Slot />
      {showSplash && <AnimatedSplash onFinish={() => setShowSplash(false)} />}
    </View>
  )
}
