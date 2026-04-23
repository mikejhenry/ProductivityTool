import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { TimeBlock } from '../types'
import { getWeekEnd } from '../lib/dateUtils'

export function useTimeBlocks(weekStart: Date) {
  const { session } = useAuth()
  const qc = useQueryClient()
  const uid = session?.user.id
  const weekEnd = getWeekEnd(weekStart)
  const key = ['blocks', weekStart.toISOString()]

  const { data: blocks = [] } = useQuery<TimeBlock[]>({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('time_blocks')
        .select('*')
        .eq('user_id', uid!)
        .gte('start_time', weekStart.toISOString())
        .lte('start_time', weekEnd.toISOString())
        .order('start_time')
      if (error) throw error
      return data
    },
    enabled: !!uid,
  })

  const createBlock = useMutation({
    mutationFn: async (block: Omit<TimeBlock, 'id' | 'user_id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('time_blocks')
        .insert({ ...block, user_id: uid! })
        .select()
        .single()
      if (error) throw error
      return data as TimeBlock
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })

  const updateBlock = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<TimeBlock> & { id: string }) => {
      const { error } = await supabase.from('time_blocks').update(patch).eq('id', id)
      if (error) throw error
    },
    onMutate: async ({ id, ...patch }) => {
      await qc.cancelQueries({ queryKey: key })
      const prev = qc.getQueryData<TimeBlock[]>(key)
      qc.setQueryData<TimeBlock[]>(key, old => old?.map(b => b.id === id ? { ...b, ...patch } : b) ?? [])
      return { prev }
    },
    onError: (_e, _v, ctx) => qc.setQueryData(key, ctx?.prev),
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })

  const deleteBlock = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('time_blocks').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })

  return {
    blocks,
    createBlock: createBlock.mutateAsync,
    updateBlock: updateBlock.mutateAsync,
    deleteBlock: deleteBlock.mutateAsync,
  }
}
