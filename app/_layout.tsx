import { useEffect, useState } from 'react'
import { Slot, useRouter, useSegments } from 'expo-router'
import { supabase } from '../lib/supabase'
import { Session } from '@supabase/supabase-js'

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
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

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/login')
    } else if (session && role === 'kid') {
      router.replace('/(kid)')
    } else if (session && role === 'parent') {
      router.replace('/(parent)')
    }
  }, [session, role, loading])

  return <Slot />
}