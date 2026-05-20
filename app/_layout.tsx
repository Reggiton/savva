import { useCallback, useEffect, useRef, useState } from 'react'
import { Slot, usePathname, useRouter } from 'expo-router'
import { supabase } from '../lib/supabase'
import { Session } from '@supabase/supabase-js'
import { View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import AnimatedSplash from '../components/AnimatedSplash'
import { isOnboardingComplete } from '../lib/onboarding'
import { trackEvent } from '../lib/metrics'

export default function RootLayout() {
  const [session, setSession] = useState<Session | null>(null)
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showSplash, setShowSplash] = useState(true)
  const [playFullSplash, setPlayFullSplash] = useState(false)
  const [onboardingComplete, setOnboardingComplete] = useState(true)
  const router = useRouter()
  const pathname = usePathname()
  const lastRedirectRef = useRef<string | null>(null)

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
    let mounted = true
    let subscription: any

    async function init() {
      try {
        const { data } = await supabase.auth.getSession()
        const sessionRes = data?.session ?? null
        if (!mounted) return
        setSession(sessionRes)
        await loadRole(sessionRes)
        setOnboardingComplete(sessionRes ? await isOnboardingComplete() : true)
        await trackEvent('app_open', { signed_in: !!sessionRes })
      } catch (err) {
        console.error('auth init error:', err)
      } finally {
        if (!mounted) return
        setLoading(false)
      }

      try {
        const last = await AsyncStorage.getItem('lastSplashDate')
        const today = new Date().toISOString().slice(0, 10)
        const shouldPlayFull = last !== today
        if (shouldPlayFull) setPlayFullSplash(true)
        setShowSplash(shouldPlayFull)
      } catch (err) {
        console.error('splash storage error:', err)
        // fallback: show splash once
        setShowSplash(true)
        setPlayFullSplash(true)
      }

      try {
        const { data } = supabase.auth.onAuthStateChange((_event: any, session: Session | null) => {
          setSession(session)
          setTimeout(() => {
            loadRole(session)
          }, 0)
          if (!session) {
            setOnboardingComplete(true)
            return
          }

          isOnboardingComplete()
            .then((complete) => setOnboardingComplete(complete))
            .catch((error) => console.error('onboarding state error:', error))
        })
        subscription = data?.subscription
      } catch (err) {
        console.error('auth listener error:', err)
      }
    }

    init()

    return () => {
      mounted = false
      if (subscription && typeof subscription.unsubscribe === 'function') {
        try {
          subscription.unsubscribe()
        } catch (err) {
          console.error('unsubscribe error:', err)
        }
      }
    }
  }, [loadRole])

  useEffect(() => {
    if (loading) return

    const isAuthPath = pathname?.startsWith('/(auth)')
    const isWelcomePath = pathname === '/(auth)/welcome'
    const isKidPath = pathname?.startsWith('/(kid)')
    const isParentPath = pathname?.startsWith('/(parent)')

    const target = !session
      ? (isAuthPath ? null : '/(auth)/login')
      : session && role && !onboardingComplete
        ? (isWelcomePath ? null : '/(auth)/welcome')
        : session && role === 'kid'
          ? (isKidPath ? null : '/(kid)')
          : session && role === 'parent'
            ? (isParentPath ? null : '/(parent)')
            : null

    if (target && lastRedirectRef.current !== target && pathname !== target) {
      lastRedirectRef.current = target
      router.replace(target as any)
    }

    if (!target) {
      lastRedirectRef.current = null
    }
  }, [session, role, loading, pathname, onboardingComplete])

  return (
    <View style={{ flex: 1 }}>
      <Slot />
      {showSplash && (
        <AnimatedSplash
          playFull={playFullSplash}
          onFinish={async () => {
            try {
              if (playFullSplash) {
                const today = new Date().toISOString().slice(0, 10)
                await AsyncStorage.setItem('lastSplashDate', today)
              }
            } catch (err) {
              console.error('splash finish storage error:', err)
            } finally {
              setShowSplash(false)
              setPlayFullSplash(false)
            }
          }}
        />
      )}
    </View>
  )
}
