import { useState } from 'react'
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  SafeAreaView,
  ScrollView,
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

export default function Signup() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [username, setUsername] = useState('')
  const [role, setRole] = useState<'kid' | 'parent' | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSignup() {
    if (!role) return setError('Please select a role')
    if (!fullName || !username || !email || !password)
      return setError('Please fill in all fields')

    setLoading(true)
    setError('')
    const normalizedEmail = email.trim().toLowerCase()
    const normalizedUsername = username.trim().toLowerCase()

    const { data, error } = await supabase.auth.signUp({
      email: normalizedEmail,
      password,
      options: {
        data: { full_name: fullName.trim(), username: normalizedUsername, role }
      }
    })

    if (error) setError(error.message)
    else if (data.user) {
      const { error: profileError } = await supabase
        .from('users')
        .upsert({
          id: data.user.id,
          full_name: fullName.trim(),
          username: normalizedUsername,
          email: normalizedEmail,
          role,
        }, { onConflict: 'id' })

      if (profileError) setError(profileError.message)
      else {
        const complete = await isOnboardingComplete()
        await trackEvent('signup_success', { role, onboardingComplete: complete })
        router.replace(complete ? (role === 'kid' ? '/(kid)' : '/(parent)') : '/(auth)/welcome')
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
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandBlock}>
            <View style={styles.logoShell}>
              <Image source={require('../../assets/savva-logo.png')} style={styles.logo} resizeMode="contain" />
            </View>
            <Text style={styles.eyebrow}>SAVVA</Text>
            <Text style={styles.title}>Create account</Text>
            <Text style={styles.subtitle}>Set up your profile and choose how you use Savva.</Text>
          </View>

          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>Before you start</Text>
            <Text style={styles.infoText}>Kids get a clearer view of spending. Parents get coaching and recent updates. Pick the role that matches how you want to use Savva.</Text>
          </View>

          <View style={styles.card}>
            <View style={styles.field}>
              <Text style={styles.label}>Full name</Text>
              <TextInput
                style={styles.input}
                placeholder="Your name"
                placeholderTextColor={Colors.textMuted}
                value={fullName}
                onChangeText={setFullName}
                textContentType="name"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Username</Text>
              <TextInput
                style={styles.input}
                placeholder="choose_username"
                placeholderTextColor={Colors.textMuted}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
              />
            </View>

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
                placeholder="Create a password"
                placeholderTextColor={Colors.textMuted}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                textContentType="newPassword"
              />
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>Account type</Text>
              <View style={styles.roleRow}>
                <RoleButton label="Kid" selected={role === 'kid'} onPress={() => setRole('kid')} />
                <RoleButton label="Parent" selected={role === 'parent'} onPress={() => setRole('parent')} />
              </View>
            </View>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[styles.primaryButton, loading && styles.disabledButton]}
              onPress={handleSignup}
              disabled={loading}
              activeOpacity={0.82}
            >
              {loading ? (
                <ActivityIndicator color={Colors.textPrimary} />
              ) : (
                <Text style={styles.primaryButtonText}>Sign up</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.secondaryButton}
            onPress={() => router.push('/(auth)/login')}
            activeOpacity={0.75}
          >
            <Text style={styles.secondaryText}>Already have an account?</Text>
            <Text style={styles.secondaryAction}>Log in</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  )
}

type RoleButtonProps = {
  label: string
  selected: boolean
  onPress: () => void
}

function RoleButton({ label, selected, onPress }: RoleButtonProps) {
  return (
    <TouchableOpacity
      style={[styles.roleButton, selected && styles.roleButtonSelected]}
      onPress={onPress}
      activeOpacity={0.8}
    >
      <View style={[styles.roleDot, selected && styles.roleDotSelected]} />
      <Text style={[styles.roleText, selected && styles.roleTextSelected]}>{label}</Text>
    </TouchableOpacity>
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
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  brandBlock: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  logoShell: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.lg,
    backgroundColor: Colors.cardBackground,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
    ...Shadows.medium,
  },
  logo: {
    width: 54,
    height: 54,
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
    fontSize: Typography.h3,
    fontWeight: '900',
    textAlign: 'center',
  },
  subtitle: {
    color: Colors.textSecondary,
    fontSize: Typography.bodySmall,
    lineHeight: 20,
    textAlign: 'center',
    marginTop: Spacing.xs,
    maxWidth: 420,
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
    padding: 12,
    ...Shadows.medium,
  },
  field: {
    marginBottom: 6,
  },
  label: {
    color: Colors.textSecondary,
    fontSize: Typography.caption,
    fontWeight: '800',
    letterSpacing: 0.8,
    marginBottom: 3,
    textTransform: 'uppercase',
  },
  input: {
    minHeight: 42,
    backgroundColor: Colors.cardBackgroundAlt,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.textPrimary,
    fontSize: Typography.body,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
  },
  roleRow: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  roleButton: {
    flex: 1,
    minHeight: 42,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.cardBackgroundAlt,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.md,
  },
  roleButtonSelected: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryDark,
  },
  roleDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    borderWidth: 1,
    borderColor: Colors.textMuted,
    marginRight: Spacing.sm,
  },
  roleDotSelected: {
    backgroundColor: Colors.textPrimary,
    borderColor: Colors.textPrimary,
  },
  roleText: {
    color: Colors.textSecondary,
    fontSize: Typography.bodySmall,
    fontWeight: '800',
  },
  roleTextSelected: {
    color: Colors.textPrimary,
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
    minHeight: 46,
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
    minHeight: 44,
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
