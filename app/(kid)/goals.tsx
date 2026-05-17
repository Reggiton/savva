import { useState } from 'react'
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  RefreshControl,
  SafeAreaView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native'
import { useFocusEffect } from 'expo-router'
import { useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { BorderRadius, Colors, Shadows, Spacing, Typography } from '../../lib/theme'

type Goal = {
  id: string
  category: string
  monthly_limit: number
}

type SpendingByCategory = {
  [key: string]: number
}

const CATEGORIES = [
  'FOOD_AND_DRINK',
  'TRANSPORTATION',
  'ENTERTAINMENT',
  'SHOPPING',
  'OTHER',
]

const CATEGORY_LABELS: { [key: string]: string } = {
  FOOD_AND_DRINK: 'Food & Drink',
  TRANSPORTATION: 'Transportation',
  ENTERTAINMENT: 'Entertainment',
  SHOPPING: 'Shopping',
  OTHER: 'Other',
}

export default function Goals() {
  const [goals, setGoals] = useState<Goal[]>([])
  const [spending, setSpending] = useState<SpendingByCategory>({})
  const [loading, setLoading] = useState(true)
  const [modalVisible, setModalVisible] = useState(false)
  const [selectedCategory, setSelectedCategory] = useState('')
  const [limitInput, setLimitInput] = useState('')
  const [userId, setUserId] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)

  useFocusEffect(
    useCallback(() => {
      async function loadGoalsScreen() {
        try {
          const { data: { user } } = await supabase.auth.getUser()

          if (!user) return

          setUserId(user.id)
          await fetchGoals(user.id)
          await fetchSpending(user.id)
        } catch (error) {
          console.log('goals load error:', error)
        } finally {
          setLoading(false)
        }
      }

      loadGoalsScreen()
    }, [])
  )

  async function onRefresh() {
    setRefreshing(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      if (user) {
        await fetchGoals(user.id)
        await fetchSpending(user.id)
      }
    } finally {
      setRefreshing(false)
    }
  }

  async function fetchGoals(uid: string) {
    const { data } = await supabase
      .from('goals')
      .select('id, category, monthly_limit')
      .eq('user_id', uid)

    if (data) setGoals(data)
  }

  async function fetchSpending(uid: string) {
    const now = new Date()
    const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`

    const { data } = await supabase
      .from('transactions')
      .select('category, amount')
      .eq('user_id', uid)
      .gte('transaction_date', startOfMonth)

    if (data) {
      const totals: SpendingByCategory = {}

      data.forEach((tx) => {
        const amount = Number(tx.amount)
        if (amount > 0) totals[tx.category] = (totals[tx.category] || 0) + amount
      })

      setSpending(totals)
    }
  }

  function openModal(category: string) {
    const existing = goals.find((goal) => goal.category === category)
    setSelectedCategory(category)
    setLimitInput(existing ? String(existing.monthly_limit) : '')
    setModalVisible(true)
  }

  async function saveGoal() {
    if (!limitInput || isNaN(Number(limitInput))) {
      Alert.alert('Invalid amount', 'Please enter a valid number.')
      return
    }

    const existing = goals.find((goal) => goal.category === selectedCategory)

    if (existing) {
      await supabase
        .from('goals')
        .update({ monthly_limit: Number(limitInput) })
        .eq('id', existing.id)
    } else {
      await supabase
        .from('goals')
        .insert({ user_id: userId, category: selectedCategory, monthly_limit: Number(limitInput) })
    }

    setModalVisible(false)
    if (userId) await fetchGoals(userId)

    const spent = spending[selectedCategory] || 0
    if (spent > Number(limitInput)) {
      Alert.alert(
        'Over limit!',
        `You have already spent $${spent.toFixed(2)} in ${CATEGORY_LABELS[selectedCategory]}, which exceeds your new limit.`
      )
    }
  }

  async function deleteGoal(goalId: string) {
    Alert.alert('Delete goal', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await supabase.from('goals').delete().eq('id', goalId)
          if (userId) await fetchGoals(userId)
        },
      },
    ])
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    )
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>BUDGET GOALS</Text>
        <Text style={styles.title}>Goals</Text>
        <Text style={styles.subtitle}>Set monthly spending limits per category</Text>
      </View>

      <FlatList
        data={CATEGORIES}
        keyExtractor={(item) => item}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
            progressBackgroundColor={Colors.cardBackground}
          />
        }
        renderItem={({ item }) => {
          const goal = goals.find((candidate) => candidate.category === item)
          const spent = spending[item] || 0
          const limit = goal?.monthly_limit || 0
          const progress = limit > 0 ? Math.min(spent / limit, 1) : 0
          const overLimit = limit > 0 && spent > limit

          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View>
                  <Text style={styles.categoryLabel}>{CATEGORY_LABELS[item]}</Text>
                  <Text style={styles.categoryMeta}>
                    {goal ? `$${limit.toFixed(2)} monthly limit` : 'No limit set'}
                  </Text>
                </View>

                <View style={styles.cardActions}>
                  <TouchableOpacity onPress={() => openModal(item)}>
                    <Text style={styles.editBtn}>{goal ? 'Edit' : 'Set'}</Text>
                  </TouchableOpacity>
                  {goal && (
                    <TouchableOpacity onPress={() => deleteGoal(goal.id)}>
                      <Text style={styles.deleteBtn}>Delete</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {goal ? (
                <>
                  <View style={styles.progressBg}>
                    <View
                      style={[
                        styles.progressFill,
                        { width: `${progress * 100}%`, backgroundColor: overLimit ? Colors.error : Colors.primary },
                      ]}
                    />
                  </View>
                  <View style={styles.spendRow}>
                    <Text style={[styles.spentTxt, overLimit && styles.overLimit]}>
                      ${spent.toFixed(2)} spent
                    </Text>
                    <Text style={styles.limitTxt}>{Math.round(progress * 100)}% used</Text>
                  </View>
                  {overLimit && <Text style={styles.overLimitMsg}>Over limit</Text>}
                </>
              ) : (
                <Text style={styles.noGoal}>Tap Set to create a limit for this category.</Text>
              )}
            </View>
          )
        }}
      />

      <Modal visible={modalVisible} transparent animationType="slide">
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Set limit for {CATEGORY_LABELS[selectedCategory]}</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="Monthly limit ($)"
              placeholderTextColor={Colors.textMuted}
              value={limitInput}
              onChangeText={setLimitInput}
              keyboardType="numeric"
            />
            <View style={styles.modalButtons}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalVisible(false)}>
                <Text style={styles.cancelTxt}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.saveBtn} onPress={saveGoal}>
                <Text style={styles.saveTxt}>Save</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  header: { paddingHorizontal: Spacing.lg, paddingTop: Spacing.xl, paddingBottom: Spacing.md },
  eyebrow: { fontSize: Typography.caption, color: Colors.textSecondary, fontWeight: '800', letterSpacing: 1.2 },
  title: { fontSize: Typography.h2, fontWeight: '800', color: Colors.textPrimary, marginTop: Spacing.xs },
  subtitle: { fontSize: Typography.bodySmall, color: Colors.textSecondary, marginTop: Spacing.xs },
  listContent: { paddingHorizontal: Spacing.lg, paddingBottom: Spacing.xl },
  card: {
    backgroundColor: Colors.cardBackground,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.border,
    ...Shadows.medium,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.md },
  categoryLabel: { fontSize: Typography.body, fontWeight: '800', color: Colors.textPrimary },
  categoryMeta: { fontSize: Typography.caption, color: Colors.textMuted, marginTop: 3 },
  cardActions: { flexDirection: 'row', gap: 12 },
  editBtn: { color: Colors.primary, fontSize: Typography.bodySmall, fontWeight: '800' },
  deleteBtn: { color: Colors.error, fontSize: Typography.bodySmall, fontWeight: '800' },
  progressBg: { height: 8, backgroundColor: Colors.progressBackground, borderRadius: BorderRadius.full, marginBottom: Spacing.sm, overflow: 'hidden' },
  progressFill: { height: 8, borderRadius: BorderRadius.full },
  spendRow: { flexDirection: 'row', justifyContent: 'space-between' },
  spentTxt: { fontSize: Typography.caption, color: Colors.textSecondary },
  overLimit: { color: Colors.error, fontWeight: '800' },
  limitTxt: { fontSize: Typography.caption, color: Colors.textMuted },
  overLimitMsg: { fontSize: Typography.caption, color: Colors.error, fontWeight: '800', marginTop: 4 },
  noGoal: { fontSize: Typography.bodySmall, color: Colors.textMuted },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: Colors.cardBackground, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle: { fontSize: Typography.body, fontWeight: '800', color: Colors.textPrimary, marginBottom: 16 },
  modalInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: 12,
    fontSize: Typography.body,
    marginBottom: 16,
    color: Colors.textPrimary,
    backgroundColor: Colors.cardBackgroundAlt,
  },
  modalButtons: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, padding: 14, borderWidth: 1, borderColor: Colors.border, borderRadius: BorderRadius.md, alignItems: 'center' },
  cancelTxt: { fontSize: Typography.body, color: Colors.textSecondary },
  saveBtn: { flex: 1, padding: 14, backgroundColor: Colors.primary, borderRadius: BorderRadius.md, alignItems: 'center' },
  saveTxt: { fontSize: Typography.body, color: Colors.textPrimary, fontWeight: '800' },
})
