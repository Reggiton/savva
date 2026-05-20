import AsyncStorage from '@react-native-async-storage/async-storage'

const METRICS_QUEUE_KEY = '@savva/metrics_queue'

export type MetricEventName =
  | 'app_open'
  | 'login_success'
  | 'signup_success'
  | 'onboarding_viewed'
  | 'onboarding_completed'
  | 'dashboard_viewed'
  | 'bank_link_started'
  | 'bank_link_completed'
  | 'insights_opened'
  | 'goal_created'
  | 'refresh_requested'
  | 'refresh_completed'
  | 'connection_request_sent'
  | 'notifications_viewed'

export type MetricProperties = Record<string, string | number | boolean | null | undefined>

type MetricRecord = {
  event: MetricEventName
  properties: MetricProperties
  occurredAt: string
}

export async function trackEvent(event: MetricEventName, properties: MetricProperties = {}) {
  const record: MetricRecord = {
    event,
    properties,
    occurredAt: new Date().toISOString(),
  }

  try {
    const existingRaw = await AsyncStorage.getItem(METRICS_QUEUE_KEY)
    const existing: MetricRecord[] = existingRaw ? JSON.parse(existingRaw) : []
    const next = [...existing, record].slice(-250)
    await AsyncStorage.setItem(METRICS_QUEUE_KEY, JSON.stringify(next))
  } catch (error) {
    console.error('trackEvent storage error:', error)
  }

  console.log('[metrics]', event, properties)
}
