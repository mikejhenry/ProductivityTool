import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Note } from '../types'

export function useNotes() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const uid = session?.user.id
  const key = ['notes', uid]

  const { data: notes = [], error: loadError } = useQuery<Note[]>({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notes')
        .select('*')
        .eq('user_id', uid!)
        .order('updated_at', { ascending: false })
      if (error) throw error
      return data
    },
    enabled: !!uid,
  })

  const createNote = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('notes')
        .insert({ user_id: uid!, title: 'Untitled', body: '' })
        .select()
        .single()
      if (error) throw error
      return data as Note
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })

  const updateNote = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Note> & { id: string }) => {
      const { error } = await supabase
        .from('notes')
        .update({ ...patch, updated_at: new Date().toISOString() })
        .eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })

  const deleteNote = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notes').delete().eq('id', id)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  })

  return {
    notes,
    loadError,
    createNote: createNote.mutateAsync,
    updateNote: updateNote.mutateAsync,
    deleteNote: deleteNote.mutateAsync,
  }
}
