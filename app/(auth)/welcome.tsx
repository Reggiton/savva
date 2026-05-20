import { useEffect, useMemo, useState } from 'react'
import {
  ActivityIndicator,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native'
import { Ionicons } from '@expo/vector-icons'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { markOnboardingComplete } from '../../lib/onboarding'
import { trackEvent } from '../../lib/metrics'
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../lib/theme'

type OnboardingStep = {
  title: string
  body: string
}

export default function Welcome() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userName, setUserName] = useState('')
  const [role, setRole] = useState<'kid' | 'parent' | null>(null)

  useEffect(() => {
    loadProfile()
  }, [])

  const steps = useMemo<OnboardingStep[]>(() => {
    if (role === 'parent') {
      return [
        { title: 'Connect with your kid', body: 'Link the right child account so Savva can show you the right activity.' },
        { title: 'Review recent updates', body: 'Check what changed since your last visit and look for any pattern worth coaching.' },
        { title: 'Choose one coaching move', body: 'Use the recommendation card to decide the next conversation or limit.' },
        { title: 'Come back weekly', body: 'Weekly check-ins keep the app useful and make trends easier to spot.' },
      ]
    }

    return [
      { title: 'Connect your bank account', body: 'Savva turns spending into a clear picture of where money is going.' },
      { title: 'Read the home insight', body: 'The home screen shows your biggest pattern and one useful next step.' },
      { title: 'Open insights', body: 'Insights turn spending into short explanations and quick action ideas.' },
      { title: 'Set your first goal', body: 'Goals help you stay in control of categories that matter most.' },
    ]
  }, [role])

  async function loadProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) {
        router.replace('/(auth)/login')
        return
      }

      const metadataRole = user.user_metadata?.role
      const { data: profile } = await supabase
        .from('users')
        .select('full_name, role')
        .eq('id', user.id)
        .maybeSingle()

      setUserName((user.user_metadata?.full_name as string) || profile?.full_name || 'there')
      setRole((profile?.role as 'kid' | 'parent' | null) || (typeof metadataRole === 'string' ? metadataRole as 'kid' | 'parent' : null))
      await trackEvent('onboarding_viewed', { role: profile?.role || metadataRole || 'unknown' })
    } catch (error) {
      console.error('welcome load error:', error)
    } finally {
      setLoading(false)
    }
  }

  async function finishOnboarding() {
    if (!role) return

    setSaving(true)
    try {
      await markOnboardingComplete()
      await trackEvent('onboarding_completed', { role })
      router.replace(role === 'parent' ? '/(parent)' : '/(kid)')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.screen}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.heroCard}>
          <Text style={styles.eyebrow}>FIRST RUN</Text>
          <Text style={styles.title}>Welcome, {userName}</Text>
          <Text style={styles.subtitle}>
            Here’s the quickest way to get value from Savva. {role === 'parent' ? 'You’ll coach from the parent view.' : 'You’ll start with the kid dashboard.'}
          </Text>
        </View>

        <View style={styles.checklistCard}>
          <Text style={styles.sectionTitle}>WHAT TO DO NEXT</Text>
          {steps.map((step, index) => (
            <View key={step.title} style={styles.stepRow}>
              <View style={styles.stepIndex}>
                <Text style={styles.stepIndexText}>{index + 1}</Text>
              </View>
              <View style={styles.stepBody}>
                <Text style={styles.stepTitle}>{step.title}</Text>
                <Text style={styles.stepText}>{step.body}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.tipCard}>
          <Ionicons name="sparkles-outline" size={18} color={Colors.primary} />
          <Text style={styles.tipText}>
            {role === 'parent'
              ? 'Your home screen will show recent updates and one coaching recommendation right away.'
              : 'Your home screen will show a spending chart, an insight card, and sync status.'}
          </Text>
        </View>

        <TouchableOpacity style={styles.primaryButton} onPress={finishOnboarding} disabled={saving} activeOpacity={0.82}>
          {saving ? <ActivityIndicator color={Colors.textPrimary} /> : <Text style={styles.primaryButtonText}>Continue</Text>}
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryButton}
          onPress={finishOnboarding}
          disabled={saving}
          activeOpacity={0.75}
        >
          <Text style={styles.secondaryText}>Skip checklist</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  content: {
    flexGrow: 1,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  heroCard: {
    backgroundColor: Colors.cardBackgroundAlt,
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.lg,
    ...Shadows.large,
  },
  eyebrow: {
    color: Colors.textSecondary,
    fontSize: Typography.caption,
    fontWeight: '900',
    letterSpacing: 1.2,
    marginBottom: 6,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: Typography.h2,
    fontWeight: '900',
    marginBottom: 6,
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.bodySmall,
    lineHeight: 20,
  },
  checklistCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    marginBottom: Spacing.md,
    ...Shadows.medium,
  },
  sectionTitle: {
    color: Colors.textMuted,
    fontSize: Typography.tiny,
    fontWeight: '900',
    letterSpacing: 1,
    marginBottom: Spacing.md,
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: Spacing.md,
  },
  stepIndex: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: Spacing.sm,
    marginTop: 2,
  },
  stepIndexText: {
    color: Colors.textPrimary,
    fontSize: Typography.caption,
    fontWeight: '900',
  },
  stepBody: { flex: 1 },
  stepTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.bodySmall,
    fontWeight: '800',
    marginBottom: 2,
  },
  stepText: {
    color: Colors.textSecondary,
    fontSize: Typography.caption,
    lineHeight: 18,
  },
  tipCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.cardBackgroundAlt,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  tipText: {
    flex: 1,
    color: Colors.textSecondary,
    fontSize: Typography.bodySmall,
    lineHeight: 20,
  },
  primaryButton: {
    minHeight: 52,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.medium,
  },
  primaryButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.body,
    fontWeight: '900',
  },
  secondaryButton: {
    minHeight: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
  },
  secondaryText: {
    color: Colors.textSecondary,
    fontSize: Typography.bodySmall,
    fontWeight: '700',
  },
})
