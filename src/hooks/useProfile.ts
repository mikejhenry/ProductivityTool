import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useAuth } from '../contexts/AuthContext'
import { Profile } from '../types'

export function useProfile() {
  const { session } = useAuth()
  const qc = useQueryClient()
  const uid = session?.user.id

  const { data: profile } = useQuery<Profile>({
    queryKey: ['profile', uid],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('*').eq('id', uid!).single()
      if (error) throw error
      return data
    },
    enabled: !!uid,
  })

  const updateTheme = useMutation({
    mutationFn: async (theme: 'light' | 'dark') => {
      localStorage.setItem('theme', theme)
      const { error } = await supabase.from('profiles').update({ theme }).eq('id', uid!)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile', uid] }),
  })

  const updateEmail = useMutation({
    mutationFn: async (email: string) => {
      await supabase.auth.updateUser({ email })
      const { error } = await supabase.from('profiles').update({ email, has_real_email: true }).eq('id', uid!)
      if (error) throw error
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['profile', uid] }),
  })

  return { profile, updateTheme: updateTheme.mutateAsync, updateEmail: updateEmail.mutateAsync }
}
