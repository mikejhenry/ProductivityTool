import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { ShoppingItem } from '../types'
import { reorderByIds } from '../lib/reorderUtils'

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
        .order('sort_order')
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

  const reorderItems = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      if (!uid) throw new Error('Not authenticated')
      const results = await Promise.all(
        orderedIds.map((id, index) =>
          supabase
            .from('shopping_items')
            .update({ sort_order: index })
            .eq('id', id)
            .eq('user_id', uid!)
        )
      )
      const failed = results.find(r => r.error)
      if (failed?.error) throw failed.error
    },
    onMutate: async (orderedIds) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<ShoppingItem[]>(key)
      qc.setQueryData<ShoppingItem[]>(key, old => {
        if (!old) return []
        const reordered = reorderByIds(old, orderedIds)
        const untouched = old.filter(i => !orderedIds.includes(i.id))
        return [...reordered, ...untouched]
      })
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })

  return {
    items,
    loadError,
    addItem: addItem.mutateAsync,
    toggleItem: toggleItem.mutateAsync,
    deleteItem: deleteItem.mutateAsync,
    clearDone: clearDone.mutateAsync,
    reorderItems: reorderItems.mutateAsync,
  }
}
