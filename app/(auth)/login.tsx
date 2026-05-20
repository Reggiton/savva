import { useState } from 'react'
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'
import { isOnboardingComplete } from '../../lib/onboarding'
import { trackEvent } from '../../lib/metrics'
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../lib/theme'

export default function Login() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    const user = data.user
    if (user) {
      const metadataRole = user.user_metadata?.role
      const role = typeof metadataRole === 'string' ? metadataRole : null
      const userEmail = user.email ?? email.trim().toLowerCase()

      const { data: profile, error: profileError } = await supabase
        .from('users')
        .select('role')
        .eq('id', user.id)
        .maybeSingle()

      if (profileError) {
        setError(profileError.message)
        setLoading(false)
        return
      }

      const resolvedRole = profile?.role ?? role

      if (!profile && resolvedRole) {
        await supabase
          .from('users')
          .upsert({
            id: user.id,
            full_name: user.user_metadata?.full_name ?? '',
            username: user.user_metadata?.username ?? '',
            email: userEmail,
            role: resolvedRole,
          }, { onConflict: 'id' })
      }

      if (resolvedRole === 'kid' || resolvedRole === 'parent') {
        const complete = await isOnboardingComplete()
        await trackEvent('login_success', { role: resolvedRole, onboardingComplete: complete })
        router.replace(complete ? (resolvedRole === 'kid' ? '/(kid)' : '/(parent)') : '/(auth)/welcome')
      } else {
        setError('Your account is missing a role. Please contact support.')
      }
    }
    setLoading(false)
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={styles.keyboardView}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <View style={styles.brandBlock}>
            <View style={styles.logoShell}>
              <Image source={require('../../assets/savva-logo.png')} style={styles.logo} resizeMode="contain" />
            </View>
            <Text style={styles.eyebrow}>SAVVA</Text>
            <Text style={styles.title}>Welcome back</Text>
            <Text style={styles.subtitle}>Sign in to see your money, goals, and connections.</Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>What Savva does</Text>
            <Text style={styles.infoText}>Kids see spending patterns and goal nudges. Parents see coaching signals and recent updates.</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.label}>Email</Text>
              <TextInput
                style={styles.input}
                placeholder="you@example.com"
                placeholderTextColor={Colors.textMuted}
                value={email}
                onChangeText={setEmail}
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="email-address"
                textContentType="emailAddress"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="password"
              />
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.disabledButton]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.82}
            >
              {loading ? (
                <ActivityIndicator color={Colors.textPrimary} />
              ) : (
                <Text style={styles.primaryButtonText}>Log in</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/(auth)/signup')}
            activeOpacity={0.75}
          >
            <Text style={styles.secondaryText}>New to Savva?</Text>
            <Text style={styles.secondaryAction}>Create an account</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  keyboardView: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },
  logoShell: {
    width: 116,
    height: 116,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    ...Shadows.medium,
  },
  logo: {
    width: 88,
    height: 88,
  },
  eyebrow: {
    color: Colors.primaryLight,
    fontSize: Typography.caption,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: Spacing.xs,
  },
  title: {
    color: Colors.textPrimary,
    fontSize: Typography.h2,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.bodySmall,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: Spacing.xs,
    maxWidth: 280,
  },
  infoCard: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    backgroundColor: Colors.cardBackgroundAlt,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  infoTitle: {
    color: Colors.textPrimary,
    fontSize: Typography.bodySmall,
    fontWeight: '900',
    marginBottom: 4,
  },
  infoText: {
    color: Colors.textSecondary,
    fontSize: Typography.bodySmall,
    lineHeight: 20,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    ...Shadows.medium,
  },
  field: {
    marginBottom: Spacing.md,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: Typography.caption,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: Spacing.xs,
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 52,
    backgroundColor: Colors.cardBackgroundAlt,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
    fontSize: Typography.body,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  errorBox: {
    backgroundColor: 'rgba(239, 83, 80, 0.12)',
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.error,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  errorText: {
    color: Colors.error,
    fontSize: Typography.bodySmall,
    fontWeight: '700',
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
  disabledButton: {
    opacity: 0.65,
  },
  primaryButtonText: {
    color: Colors.textPrimary,
    fontSize: Typography.body,
    fontWeight: '900',
  },
  secondaryButton: {
    width: '100%',
    maxWidth: 460,
    alignSelf: 'center',
    minHeight: 52,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: Spacing.md,
    backgroundColor: Colors.cardBackground,
  },
  secondaryText: {
    color: Colors.textSecondary,
    fontSize: Typography.caption,
    fontWeight: '700',
  },
  secondaryAction: {
    color: Colors.primaryLight,
    fontSize: Typography.bodySmall,
    fontWeight: '900',
    marginTop: 2,
  },
})
