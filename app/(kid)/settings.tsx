import { useEffect, useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useRouter } from 'expo-router'
import RefreshableScrollView from '../../components/RefreshableScrollView'
import { supabase } from '../../lib/supabase'
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../lib/theme'

type Profile = {
  full_name?: string | null
  username?: string | null
}

export default function KidSettings() {
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [userId, setUserId] = useState<string | null>(null)
  const [initialData, setInitialData] = useState({
    name: '',
    username: '',
    email: '',
    phone: '',
    profilePicUrl: '',
  })
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [profilePicUrl, setProfilePicUrl] = useState('')
  const [newPassword, setNewPassword] = useState('')

  useEffect(() => {
    loadProfile()
  }, [])

  async function loadProfile() {
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (!user) return

      setUserId(user.id)
      setEmail(user.email || '')
      setPhone((user.user_metadata?.phone as string) || user.phone || '')
      setProfilePicUrl((user.user_metadata?.profile_pic_url as string) || '')

      const { data } = await supabase
        .from('users')
        .select('full_name, username')
        .eq('id', user.id)
        .maybeSingle()

      const profile = data as Profile | null
      const userData = {
        name: (user.user_metadata?.full_name as string) || profile?.full_name || '',
        username: (user.user_metadata?.username as string) || profile?.username || '',
        email: user.email || '',
        phone: (user.user_metadata?.phone as string) || user.phone || '',
        profilePicUrl: (user.user_metadata?.profile_pic_url as string) || '',
      }

      setInitialData(userData)
      setName(userData.name)
      setUsername(userData.username)
      setEmail(userData.email)
      setPhone(userData.phone)
      setProfilePicUrl(userData.profilePicUrl)
    } catch (error) {
      console.log('settings load error:', error)
    } finally {
      setLoading(false)
    }
  }

  async function saveProfile() {
    if (!userId) return

    const trimmedName = name.trim()
    const trimmedUsername = username.trim().toLowerCase()
    const trimmedEmail = email.trim().toLowerCase()
    const trimmedPhone = phone.trim()
    const trimmedPicUrl = profilePicUrl.trim()
    const trimmedPassword = newPassword.trim()

    if (!trimmedName || !trimmedUsername || !trimmedEmail) {
      Alert.alert('Missing info', 'Name, username, and email are required.')
      return
    }

    if (trimmedPassword && trimmedPassword.length < 6) {
      Alert.alert('Password too short', 'New password must be at least 6 characters.')
      return
    }

    setSaving(true)
    try {
      if (trimmedUsername !== initialData.username) {
        const { data: existing, error: checkError } = await supabase
          .from('users')
          .select('id')
          .eq('username', trimmedUsername)
          .maybeSingle()

        if (checkError) throw checkError
        if (existing && existing.id !== userId) throw new Error('Username is already taken.')
      }

      const authUpdates: {
        email?: string
        password?: string
        data?: {
          full_name: string
          username: string
          phone: string
          profile_pic_url: string
        }
      } = {
        data: {
          full_name: trimmedName,
          username: trimmedUsername,
          phone: trimmedPhone,
          profile_pic_url: trimmedPicUrl,
        },
      }

      if (trimmedEmail !== initialData.email) authUpdates.email = trimmedEmail
      if (trimmedPassword) authUpdates.password = trimmedPassword

      if (Object.keys(authUpdates).length > 0) {
        const { error } = await supabase.auth.updateUser(authUpdates)
        if (error) throw error
      }

      const { error: profileError } = await supabase
        .from('users')
        .upsert({
          id: userId,
          full_name: trimmedName,
          username: trimmedUsername,
          email: trimmedEmail,
          role: 'kid',
        }, { onConflict: 'id' })

      if (profileError) throw profileError

      setInitialData({
        name: trimmedName,
        username: trimmedUsername,
        email: trimmedEmail,
        phone: trimmedPhone,
        profilePicUrl: trimmedPicUrl,
      })
      setNewPassword('')
      Alert.alert('Saved', 'Your profile was updated.')
    } catch (error: any) {
      Alert.alert('Could not save changes', error.message || 'Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function logOut() {
    await supabase.auth.signOut()
    router.replace('/(auth)/login')
  }

  const initials = (name || username || 'User')
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <RefreshableScrollView onRefresh={loadProfile} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ACCOUNT</Text>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.subtitle}>Manage sign-in details and personal info.</Text>
        </View>

        <View style={styles.avatarCard}>
          {profilePicUrl ? (
            <Image source={{ uri: profilePicUrl }} style={styles.avatarImage} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarText}>{initials}</Text>
            </View>
          )}
          <View style={styles.avatarCopy}>
            <Text style={styles.cardTitle}>Profile picture</Text>
            <Text style={styles.cardText}>Paste an image URL to update your avatar.</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Personal info</Text>
          <Field label="Name" value={name} onChangeText={setName} placeholder="Your name" />
          <Field label="Username" value={username} onChangeText={setUsername} placeholder="username" autoCapitalize="none" />
          <Field label="Profile picture URL" value={profilePicUrl} onChangeText={setProfilePicUrl} placeholder="https://..." autoCapitalize="none" />
          <Field label="Phone number" value={phone} onChangeText={setPhone} placeholder="+1 555 000 0000" keyboardType="phone-pad" />
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Login</Text>
          <Field label="Email" value={email} onChangeText={setEmail} placeholder="you@example.com" autoCapitalize="none" keyboardType="email-address" />
          <Field
            label="New password"
            value={newPassword}
            onChangeText={setNewPassword}
            placeholder="Leave blank to keep current password"
            secureTextEntry
          />
          <Text style={styles.helperText}>
            Email and password changes may require Supabase confirmation depending on your project settings.
          </Text>
        </View>

        <TouchableOpacity style={[styles.saveBtn, saving && styles.disabledBtn]} onPress={saveProfile} disabled={saving}>
          <Text style={styles.saveTxt}>{saving ? 'Saving...' : 'Save changes'}</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={logOut}>
          <Text style={styles.logoutTxt}>Log out</Text>
        </TouchableOpacity>
      </RefreshableScrollView>
    </SafeAreaView>
  )
}

type FieldProps = {
  label: string
  value: string
  onChangeText: (value: string) => void
  placeholder: string
  autoCapitalize?: 'none' | 'sentences' | 'words' | 'characters'
  keyboardType?: 'default' | 'email-address' | 'phone-pad'
  secureTextEntry?: boolean
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  autoCapitalize = 'sentences',
  keyboardType = 'default',
  secureTextEntry,
}: FieldProps) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
        secureTextEntry={secureTextEntry}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  content: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.xxl },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { marginBottom: Spacing.lg },
  eyebrow: { fontSize: Typography.caption, color: Colors.textSecondary, fontWeight: '800', letterSpacing: 1.2 },
  title: { fontSize: Typography.h2, fontWeight: '800', color: Colors.textPrimary, marginTop: Spacing.xs },
  subtitle: { fontSize: Typography.bodySmall, color: Colors.textSecondary, marginTop: Spacing.xs },
  avatarCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.medium,
  },
  avatarImage: { width: 70, height: 70, borderRadius: 35, backgroundColor: Colors.cardBackgroundAlt },
  avatarFallback: {
    width: 70,
    height: 70,
    borderRadius: 35,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: Colors.textPrimary, fontSize: Typography.h3, fontWeight: '900' },
  avatarCopy: { flex: 1, marginLeft: Spacing.md },
  cardTitle: { color: Colors.textPrimary, fontSize: Typography.body, fontWeight: '800' },
  cardText: { color: Colors.textSecondary, fontSize: Typography.bodySmall, marginTop: 4 },
  formCard: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    ...Shadows.medium,
  },
  sectionTitle: { color: Colors.textPrimary, fontSize: Typography.body, fontWeight: '800', marginBottom: Spacing.md },
  field: { marginBottom: Spacing.md },
  label: { color: Colors.textSecondary, fontSize: Typography.caption, fontWeight: '800', marginBottom: Spacing.xs, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: {
    backgroundColor: Colors.cardBackgroundAlt,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 12,
    color: Colors.textPrimary,
    fontSize: Typography.body,
  },
  helperText: { color: Colors.textMuted, fontSize: Typography.caption, lineHeight: 18 },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.sm },
  saveTxt: { color: Colors.textPrimary, fontSize: Typography.body, fontWeight: '900' },
  disabledBtn: { opacity: 0.6 },
  logoutBtn: { borderWidth: 1, borderColor: Colors.error, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.md },
  logoutTxt: { color: Colors.error, fontSize: Typography.body, fontWeight: '900' },
})
