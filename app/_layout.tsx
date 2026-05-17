import { useEffect, useState } from 'react'
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

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }: { data: { session: Session | null } }) => {
      setSession(session)
      if (session) {
        const { data } = await supabase
          .from('users')
          .select('role')
          .eq('id', session.user.id)
          .single()
        setRole(data?.role ?? null)
      }
      setLoading(false)
    })

    supabase.auth.onAuthStateChange(async (_event: any, session: Session | null) => {
  setSession(session)
  if (session) {
    const { data } = await supabase
      .from('users')
      .select('role')
      .eq('id', session.user.id)
      .single()
    setRole(data?.role ?? null)
  } else {
    setRole(null)
  }
})
  }, [])

  useEffect(() => {
    if (loading) return

    const inAuthGroup = segments[0] === '(auth)'
    const inKidGroup = segments[0] === '(kid)'
    const inParentGroup = segments[0] === '(parent)'

    if (!session && !inAuthGroup) {
      router.replace('/login' as any)
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
