import { useState } from 'react'
import { View, TextInput, Text, StyleSheet, TouchableOpacity, Button } from 'react-native'
import { useRouter } from 'expo-router'
import { supabase } from '../../lib/supabase'

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

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName, username, role }
      }
    })

    if (error) setError(error.message)
    setLoading(false)
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create account</Text>

      <TextInput style={styles.input} placeholder="Full name" value={fullName} onChangeText={setFullName} />
      <TextInput style={styles.input} placeholder="Username" value={username} onChangeText={setUsername} autoCapitalize="none" />
      <TextInput style={styles.input} placeholder="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <TextInput style={styles.input} placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry />

      <Text style={styles.label}>I am a:</Text>
      <View style={styles.roleRow}>
        <TouchableOpacity style={[styles.roleBtn, role === 'kid' && styles.roleSelected]} onPress={() => setRole('kid')}>
          <Text style={[styles.roleTxt, role === 'kid' && styles.roleSelectedTxt]}>Kid</Text>
        </TouchableOpacity>
        <TouchableOpacity style={[styles.roleBtn, role === 'parent' && styles.roleSelected]} onPress={() => setRole('parent')}>
          <Text style={[styles.roleTxt, role === 'parent' && styles.roleSelectedTxt]}>Parent</Text>
        </TouchableOpacity>
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title={loading ? 'Creating account...' : 'Sign up'} onPress={handleSignup} disabled={loading} />
      <Button title="Already have an account? Log in" onPress={() => router.push('/(auth)/login')} />
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, justifyContent: 'center' },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 24 },
  input: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, marginBottom: 12 },
  label: { fontSize: 16, marginBottom: 8 },
  roleRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  roleBtn: { flex: 1, padding: 12, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, alignItems: 'center' },
  roleSelected: { backgroundColor: '#000', borderColor: '#000' },
  roleTxt: { fontSize: 16 },
  roleSelectedTxt: { color: '#fff' },
  error: { color: 'red', marginBottom: 12 },
})