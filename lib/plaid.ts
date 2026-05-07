import { supabase } from './supabase'

export async function createLinkToken(userId: string): Promise<string | null> {
  const { data, error } = await supabase.functions.invoke('create-link-token', {
    body: { user_id: userId },
  })

  if (error || !data?.link_token) {
    console.log('link token error:', error, data)
    return null
  }

  return data.link_token
}