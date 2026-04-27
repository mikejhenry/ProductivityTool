import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { ShoppingItem } from '../types'

export function useShoppingItems() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const uid = session?.user.id
  const key = ['shopping_items', uid]

  const { data: items = [], error: loadError } = useQuery<ShoppingItem[]>({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('shopping_items')
        .select('*')
        .eq('user_id', uid!)
        .order('created_at', { ascending: true })
      if (error) throw error
      return data
    },
    enabled: !!uid,
  })

  const addItem = useMutation({
    mutationFn: async (name: string) => {
      const { error } = await supabase
        .from('shopping_items')
        .insert({ user_id: uid!, name, checked: false })
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })

  const toggleItem = useMutation({
    mutationFn: async ({ id, checked }: { id: string; checked: boolean }) => {
      const { error } = await supabase
        .from('shopping_items')
        .update({ checked })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })

  const deleteItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('shopping_items')
        .delete()
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })

  const clearDone = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('shopping_items')
        .delete()
        .eq('user_id', uid!)
        .eq('checked', true)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })

  return {
    items,
    loadError,
    addItem: addItem.mutateAsync,
    toggleItem: toggleItem.mutateAsync,
    deleteItem: deleteItem.mutateAsync,
    clearDone: clearDone.mutateAsync,
  }
}
