import { useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function ResetPasswordPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/login`,
    })
    if (error) setError(error.message)
    else setSent(true)
  }

  if (sent) return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-slate-900">
      <div className="max-w-sm text-center">
        <p className="text-gray-700 dark:text-gray-300">Check your email for a reset link.</p>
        <Link to="/login" className="mt-4 block text-sm underline text-indigo-600">Back to login</Link>
      </div>
    </div>
  )

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-slate-900">
      <div className="w-full max-w-sm rounded-xl bg-white p-8 shadow dark:bg-slate-800">
        <h1 className="mb-2 text-2xl font-bold text-gray-900 dark:text-white">Reset password</h1>
        <p className="mb-4 text-sm text-gray-500">Enter the email linked to your account.</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input className="input" placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button className="btn-primary w-full" type="submit">Send reset link</button>
        </form>
        <Link to="/login" className="mt-4 block text-sm underline text-gray-500">Back to login</Link>
      </div>
    </div>
  )
}
