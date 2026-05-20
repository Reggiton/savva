import { supabase } from './supabase'

export async function createLinkToken(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabase.functions.invoke('create-link-token', {
      body: { user_id: userId },
    })

    if (error || !data?.link_token) {
      console.error('link token error:', error, data)
      return null
    }

    return data.link_token
  } catch (err) {
    console.error('createLinkToken exception:', err)
    return null
  }
}