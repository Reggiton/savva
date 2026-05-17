import { useEffect, useRef } from 'react'
import { Animated, Image, StyleSheet, Text, View } from 'react-native'
import { Colors } from '../lib/theme'

type AnimatedSplashProps = {
  onFinish: () => void
}

export default function AnimatedSplash({ onFinish }: AnimatedSplashProps) {
  const opacity = useRef(new Animated.Value(1)).current
  const logoOpacity = useRef(new Animated.Value(0)).current
  const logoScale = useRef(new Animated.Value(0.86)).current
  const logoTranslateY = useRef(new Animated.Value(18)).current
  const glowScale = useRef(new Animated.Value(0.7)).current
  const glowOpacity = useRef(new Animated.Value(0)).current

  useEffect(() => {
    Animated.sequence([
      Animated.parallel([
        Animated.timing(logoOpacity, {
          toValue: 1,
          duration: 420,
          useNativeDriver: true,
        }),
        Animated.spring(logoScale, {
          toValue: 1,
          friction: 7,
          tension: 55,
          useNativeDriver: true,
        }),
        Animated.timing(logoTranslateY, {
          toValue: 0,
          duration: 520,
          useNativeDriver: true,
        }),
        Animated.timing(glowOpacity, {
          toValue: 0.34,
          duration: 520,
          useNativeDriver: true,
        }),
        Animated.timing(glowScale, {
          toValue: 1,
          duration: 620,
          useNativeDriver: true,
        }),
      ]),
      Animated.delay(1600),
      Animated.parallel([
        Animated.timing(opacity, {
          toValue: 0,
          duration: 360,
          useNativeDriver: true,
        }),
        Animated.timing(logoScale, {
          toValue: 1.06,
          duration: 360,
          useNativeDriver: true,
        }),
      ]),
    ]).start(onFinish)
  }, [glowOpacity, glowScale, logoOpacity, logoScale, logoTranslateY, onFinish, opacity])

  return (
    <Animated.View pointerEvents="none" style={[styles.container, { opacity }]}>
      <Animated.View
        style={[
          styles.glow,
          {
            opacity: glowOpacity,
            transform: [{ scale: glowScale }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.logoBlock,
          {
          opacity: logoOpacity,
          transform: [{ translateY: logoTranslateY }, { scale: logoScale }],
          },
        ]}
      >
        <Image source={require('../assets/savva-logo.png')} style={styles.logo} resizeMode="contain" />
        <Text style={styles.wordmark}>SAVVA</Text>
      </Animated.View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1000,
    elevation: 1000,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  glow: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primaryLight,
    shadowOpacity: 0.7,
    shadowRadius: 36,
    elevation: 12,
  },
  logo: {
    width: 220,
    height: 220,
  },
  logoBlock: {
    alignItems: 'center',
  },
  wordmark: {
    color: Colors.primaryLight,
    fontSize: 14,
    fontWeight: '900',
    letterSpacing: 3,
    marginTop: -22,
  },
})
