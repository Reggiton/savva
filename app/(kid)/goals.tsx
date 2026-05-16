import { useEffect, useState } from 'react'
import { View, Text, FlatList, StyleSheet, TouchableOpacity, TextInput, Alert, ActivityIndicator, Modal } from 'react-native'
import { supabase } from '../../lib/supabase'
import { useFocusEffect } from 'expo-router'
import { useCallback } from 'react'
import { RefreshControl } from 'react-native'

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
  'OTHER'
]

const CATEGORY_LABELS: { [key: string]: string } = {
  FOOD_AND_DRINK: 'Food & Drink',
  TRANSPORTATION: 'Transportation',
  ENTERTAINMENT: 'Entertainment',
  SHOPPING: 'Shopping',
  OTHER: 'Other'
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
      supabase.auth.getUser().then(async ({ data: { user } }) => {
        if (user) {
          setUserId(user.id)
          await fetchGoals(user.id)
          await fetchSpending(user.id)
          setLoading(false)
        }
      })
    }, [])
  )

  async function onRefresh() {
    setRefreshing(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      await fetchGoals(user.id)
      await fetchSpending(user.id)
    }
    setRefreshing(false)
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
      data.forEach(tx => {
        totals[tx.category] = (totals[tx.category] || 0) + tx.amount
      })
      setSpending(totals)
    }
  }

  function openModal(category: string) {
    const existing = goals.find(g => g.category === category)
    setSelectedCategory(category)
    setLimitInput(existing ? String(existing.monthly_limit) : '')
    setModalVisible(true)
  }

  async function saveGoal() {
    if (!limitInput || isNaN(Number(limitInput))) {
      Alert.alert('Invalid amount', 'Please enter a valid number.')
      return
    }

    const existing = goals.find(g => g.category === selectedCategory)

    if (existing) {
      await supabase.from('goals')
        .update({ monthly_limit: Number(limitInput) })
        .eq('id', existing.id)
    } else {
      await supabase.from('goals')
        .insert({ user_id: userId, category: selectedCategory, monthly_limit: Number(limitInput) })
    }

    setModalVisible(false)
    if (userId) await fetchGoals(userId)

    // check if over limit and notify
    const spent = spending[selectedCategory] || 0
    if (spent > Number(limitInput)) {
      Alert.alert('Over limit!', `You have already spent $${spent.toFixed(2)} in ${CATEGORY_LABELS[selectedCategory]}, which exceeds your new limit.`)
    }
  }

  async function deleteGoal(goalId: string) {
    Alert.alert('Delete goal', 'Are you sure?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          await supabase.from('goals').delete().eq('id', goalId)
          if (userId) await fetchGoals(userId)
        }
      }
    ])
  }

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    )
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Goals</Text>
      <Text style={styles.subtitle}>Set monthly spending limits per category</Text>

      <FlatList
        data={CATEGORIES}
        keyExtractor={item => item}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        renderItem={({ item }) => {
          const goal = goals.find(g => g.category === item)
          const spent = spending[item] || 0
          const limit = goal?.monthly_limit || 0
          const progress = limit > 0 ? Math.min(spent / limit, 1) : 0
          const overLimit = limit > 0 && spent > limit

          return (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.categoryLabel}>{CATEGORY_LABELS[item]}</Text>
                <View style={styles.cardActions}>
                  <TouchableOpacity onPress={() => openModal(item)}>
                    <Text style={styles.editBtn}>{goal ? 'Edit' : 'Set limit'}</Text>
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
                    <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: overLimit ? '#ff3b30' : '#000' }]} />
                  </View>
                  <View style={styles.spendRow}>
                    <Text style={[styles.spentTxt, overLimit && styles.overLimit]}>
                      ${spent.toFixed(2)} spent
                    </Text>
                    <Text style={styles.limitTxt}>${limit.toFixed(2)} limit</Text>
                  </View>
                  {overLimit && <Text style={styles.overLimitMsg}>Over limit!</Text>}
                </>
              ) : (
                <Text style={styles.noGoal}>No limit set — tap to add one</Text>
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
    </View>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '600', marginBottom: 4 },
  subtitle: { fontSize: 14, color: '#999', marginBottom: 16 },
  card: { backgroundColor: '#f5f5f5', borderRadius: 12, padding: 16, marginBottom: 12 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  categoryLabel: { fontSize: 16, fontWeight: '600' },
  cardActions: { flexDirection: 'row', gap: 12 },
  editBtn: { color: '#007AFF', fontSize: 14 },
  deleteBtn: { color: '#ff3b30', fontSize: 14 },
  progressBg: { height: 8, backgroundColor: '#e0e0e0', borderRadius: 4, marginBottom: 8 },
  progressFill: { height: 8, borderRadius: 4 },
  spendRow: { flexDirection: 'row', justifyContent: 'space-between' },
  spentTxt: { fontSize: 13, color: '#333' },
  overLimit: { color: '#ff3b30', fontWeight: '600' },
  limitTxt: { fontSize: 13, color: '#999' },
  overLimitMsg: { fontSize: 12, color: '#ff3b30', fontWeight: '600', marginTop: 4 },
  noGoal: { fontSize: 13, color: '#999' },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: '#fff', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 24 },
  modalTitle: { fontSize: 18, fontWeight: '600', marginBottom: 16 },
  modalInput: { borderWidth: 1, borderColor: '#ccc', borderRadius: 8, padding: 12, fontSize: 16, marginBottom: 16 },
  modalButtons: { flexDirection: 'row', gap: 12 },
  cancelBtn: { flex: 1, padding: 14, borderWidth: 1, borderColor: '#ccc', borderRadius: 8, alignItems: 'center' },
  cancelTxt: { fontSize: 16, color: '#333' },
  saveBtn: { flex: 1, padding: 14, backgroundColor: '#000', borderRadius: 8, alignItems: 'center' },
  saveTxt: { fontSize: 16, color: '#fff', fontWeight: '600' },
})