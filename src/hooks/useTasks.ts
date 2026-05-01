import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Task } from '../types'

export function useTasks() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const uid = session?.user.id
  const key = ['tasks', uid]

  const { data: tasks = [] } = useQuery<Task[]>({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .eq('user_id', uid!)
        .order('created_at')
      if (error) throw error
      return data
    },
    enabled: !!uid,
  })

  const createTask = useMutation({
    mutationFn: async (task: Omit<Task, 'id' | 'user_id' | 'created_at'>) => {
      const { data, error } = await supabase
        .from('tasks')
        .insert({ ...task, user_id: uid! })
        .select()
        .single()
      if (error) throw error
      return data as Task
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })

  const updateTask = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Task> & { id: string }) => {
      if (!uid) throw new Error('Not authenticated')
      const { error } = await supabase.from('tasks').update(patch).eq('id', id).eq('user_id', uid!)
      if (error) throw error
      if ('title' in patch) {
        const { error: blockError } = await supabase
          .from('time_blocks')
          .update({ title: patch.title })
          .eq('task_id', id)
          .eq('user_id', uid!)
        if (blockError) throw blockError
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key })
      // Invalidate all week block queries (prefix match) so every view reflects the new title
      qc.invalidateQueries({ queryKey: ['blocks'] })
    },
  })

  const deleteTask = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('tasks').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })

  const toggleTask = useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const patch = { completed_at: done ? new Date().toISOString() : null }
      const { error } = await supabase
        .from('tasks')
        .update(patch)
        .eq('id', id)
        .eq('user_id', uid!)
      if (error) throw error
    },
    onMutate: async ({ id, done }) => {
      await qc.cancelQueries({ queryKey: key })
      const previous = qc.getQueryData<Task[]>(key)
      qc.setQueryData<Task[]>(key, old =>
        old?.map(t =>
          t.id === id
            ? { ...t, completed_at: done ? new Date().toISOString() : null }
            : t
        ) ?? []
      )
      return { previous }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous)
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  })

  return {
    tasks,
    createTask: createTask.mutateAsync,
    updateTask: updateTask.mutateAsync,
    deleteTask: deleteTask.mutateAsync,
    toggleTask: toggleTask.mutateAsync,
  }
}
