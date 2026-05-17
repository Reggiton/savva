import React, { useEffect, useState, useRef } from 'react'
import {
  ActivityIndicator,
  Alert,
  Image,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useRouter } from 'expo-router'
import RefreshableScrollView from '../../components/RefreshableScrollView'
import { supabase } from '../../lib/supabase'
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../lib/theme'

export default function ParentSettings() {
  const router = useRouter()
  const isMounted = useRef(true)
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
    isMounted.current = true
    loadProfile()
    return () => { isMounted.current = false }
  }, [])

  async function loadProfile() {
    try {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) throw userError || new Error('No active session.')

      // Fetch fresh data from public.users table
      const { data: dbProfile, error: dbError } = await supabase
        .from('users')
        .select('full_name, username')
        .eq('id', user.id)
        .maybeSingle()

      if (dbError) console.warn('DB profile fetch error:', dbError)

      const userData = {
        name: user.user_metadata?.full_name || dbProfile?.full_name || '',
        username: user.user_metadata?.username || dbProfile?.username || '',
        email: user.email || '',
        phone: user.user_metadata?.phone || user.phone || '',
        profilePicUrl: user.user_metadata?.profile_pic_url || '',
      }

      if (isMounted.current) {
        setUserId(user.id)
        setInitialData(userData)
        setName(userData.name)
        setUsername(userData.username)
        setEmail(userData.email)
        setPhone(userData.phone)
        setProfilePicUrl(userData.profilePicUrl)
      }
    } catch (error: any) {
      console.error('Load error:', error)
      Alert.alert('Load Error', 'Could not load your profile.')
    } finally {
      if (isMounted.current) setLoading(false)
    }
  }

  async function saveProfile() {
    if (!userId || saving) return

    const trimmedName = name.trim()
    const trimmedUsername = username.trim().toLowerCase()
    const trimmedEmail = email.trim().toLowerCase()
    const trimmedPhone = phone.trim()
    const trimmedPicUrl = profilePicUrl.trim()

    if (!trimmedName || !trimmedUsername || !trimmedEmail) {
      Alert.alert('Missing Info', 'Full name, username, and email are required.')
      return
    }

    if (newPassword.trim() && newPassword.trim().length < 6) {
      Alert.alert('Password Too Short', 'New password must be at least 6 characters.')
      return
    }

    // 1. Determine exactly what changed
    const profileTableChanged = trimmedName !== initialData.name || trimmedUsername !== initialData.username
    const metadataChanged = profileTableChanged || trimmedPhone !== initialData.phone || trimmedPicUrl !== initialData.profilePicUrl
    const emailChanged = trimmedEmail !== initialData.email
    const passwordChanged = newPassword.trim().length >= 6

    if (!metadataChanged && !emailChanged && !passwordChanged) {
      Alert.alert('No Changes', 'Nothing to update.')
      return
    }

    setSaving(true)

    try {
      // 2. If username changed, verify uniqueness
      if (trimmedUsername !== initialData.username) {
        const { data: existing, error: checkError } = await supabase
          .from('users')
          .select('id')
          .eq('username', trimmedUsername)
          .maybeSingle()

        if (checkError) throw checkError
        if (existing && existing.id !== userId) {
          throw new Error('Username is already taken.')
        }
      }

      // 3. Update public.users first (Database Source of Truth)
      if (profileTableChanged) {
        const { error: dbError } = await supabase
          .from('users')
          .upsert({
            id: userId,
            full_name: trimmedName,
            username: trimmedUsername,
            email: trimmedEmail,
            role: 'parent',
          }, { onConflict: 'id' })

        if (dbError) throw dbError
      }

      // 4. Update Auth metadata and credentials
      const authUpdates: any = { data: {} }
      if (trimmedName !== initialData.name) authUpdates.data.full_name = trimmedName
      if (trimmedUsername !== initialData.username) authUpdates.data.username = trimmedUsername
      if (trimmedPhone !== initialData.phone) authUpdates.data.phone = trimmedPhone
      if (trimmedPicUrl !== initialData.profilePicUrl) authUpdates.data.profile_pic_url = trimmedPicUrl

      if (emailChanged) authUpdates.email = trimmedEmail
      if (passwordChanged) authUpdates.password = newPassword.trim()

      if (Object.keys(authUpdates.data).length > 0 || authUpdates.email || authUpdates.password) {
        const { error: authError } = await supabase.auth.updateUser(authUpdates)
        if (authError) throw authError
      }

      // 5. Finalize
      if (isMounted.current) {
        setInitialData({
          name: trimmedName,
          username: trimmedUsername,
          email: trimmedEmail,
          phone: trimmedPhone,
          profilePicUrl: trimmedPicUrl,
        })
        setNewPassword('')
        setSaving(false)
        Alert.alert(
          'Success',
          'Your profile has been updated.',
          [{ text: 'OK', onPress: () => router.replace('/(parent)') }]
        )
      }

    } catch (error: any) {
      console.error('Save error:', error)
      if (isMounted.current) {
        setSaving(false)
        Alert.alert('Save Failed', error.message || 'An error occurred during save.')
      }
    }
  }

  const logOut = async () => {
    await supabase.auth.signOut()
    router.replace('/(auth)/login' as any)
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  const initials = (name || username || 'U').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <RefreshableScrollView onRefresh={loadProfile} contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <Text style={styles.eyebrow}>ACCOUNT</Text>
          <Text style={styles.title}>Profile</Text>
          <Text style={styles.subtitle}>Manage your personal and login details.</Text>
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
            <Text style={styles.cardText}>Use a URL for your profile image.</Text>
          </View>
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Personal Info</Text>
          <Field label="Full Name" value={name} onChangeText={setName} placeholder="Enter your name" />
          <Field label="Username" value={username} onChangeText={setUsername} placeholder="Choose a username" autoCapitalize="none" />
          <Field label="Phone" value={phone} onChangeText={setPhone} placeholder="Phone number" keyboardType="phone-pad" />
          <Field label="Avatar URL" value={profilePicUrl} onChangeText={setProfilePicUrl} placeholder="https://..." autoCapitalize="none" />
        </View>

        <View style={styles.formCard}>
          <Text style={styles.sectionTitle}>Security</Text>
          <Field label="Email Address" value={email} onChangeText={setEmail} placeholder="Email" autoCapitalize="none" keyboardType="email-address" />
          <Field label="New Password" value={newPassword} onChangeText={setNewPassword} placeholder="Min. 6 characters" secureTextEntry />
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, (saving || loading) && styles.disabledBtn]}
          onPress={saveProfile}
          disabled={saving || loading}
        >
          {saving ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text style={styles.saveTxt}>Save Changes</Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity style={styles.logoutBtn} onPress={logOut} disabled={saving}>
          <Text style={styles.logoutTxt}>Sign Out</Text>
        </TouchableOpacity>
      </RefreshableScrollView>
    </SafeAreaView>
  )
}

function Field({ label, value, onChangeText, placeholder, ...props }: any) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={Colors.textMuted}
        {...props}
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
  avatarCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: Colors.cardBackground, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, marginBottom: Spacing.md, ...Shadows.medium },
  avatarImage: { width: 70, height: 70, borderRadius: 35, backgroundColor: Colors.cardBackgroundAlt },
  avatarFallback: { width: 70, height: 70, borderRadius: 35, backgroundColor: Colors.primary, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: Colors.textPrimary, fontSize: Typography.h3, fontWeight: '900' },
  avatarCopy: { flex: 1, marginLeft: Spacing.md },
  cardTitle: { color: Colors.textPrimary, fontSize: Typography.body, fontWeight: '800' },
  cardText: { color: Colors.textSecondary, fontSize: Typography.bodySmall, marginTop: 4 },
  formCard: { backgroundColor: Colors.cardBackground, borderRadius: BorderRadius.lg, borderWidth: 1, borderColor: Colors.border, padding: Spacing.lg, marginBottom: Spacing.md, ...Shadows.medium },
  sectionTitle: { color: Colors.textPrimary, fontSize: Typography.body, fontWeight: '800', marginBottom: Spacing.md },
  field: { marginBottom: Spacing.md },
  label: { color: Colors.textSecondary, fontSize: Typography.caption, fontWeight: '800', marginBottom: Spacing.xs, textTransform: 'uppercase', letterSpacing: 0.8 },
  input: { backgroundColor: Colors.cardBackgroundAlt, borderRadius: BorderRadius.md, borderWidth: 1, borderColor: Colors.border, paddingHorizontal: Spacing.md, paddingVertical: 12, color: Colors.textPrimary, fontSize: Typography.body },
  saveBtn: { backgroundColor: Colors.primary, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.sm, minHeight: 52, justifyContent: 'center', ...Shadows.medium },
  saveTxt: { color: Colors.textPrimary, fontSize: Typography.body, fontWeight: '900' },
  disabledBtn: { opacity: 0.6 },
  logoutBtn: { borderWidth: 1, borderColor: Colors.error, borderRadius: BorderRadius.md, padding: Spacing.md, alignItems: 'center', marginTop: Spacing.md },
  logoutTxt: { color: Colors.error, fontSize: Typography.body, fontWeight: '900' },
})
