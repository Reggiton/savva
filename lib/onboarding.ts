import AsyncStorage from '@react-native-async-storage/async-storage'

const ONBOARDING_COMPLETE_KEY = '@savva/onboarding_complete'

export async function isOnboardingComplete() {
  try {
    return (await AsyncStorage.getItem(ONBOARDING_COMPLETE_KEY)) === 'true'
  } catch (error) {
    console.error('isOnboardingComplete error:', error)
    return false
  }
}

export async function markOnboardingComplete() {
  try {
    await AsyncStorage.setItem(ONBOARDING_COMPLETE_KEY, 'true')
  } catch (error) {
    console.error('markOnboardingComplete error:', error)
  }
}
