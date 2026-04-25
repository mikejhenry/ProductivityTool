import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function SignupPage() {
  const { signUp } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await signUp(password, email || undefined)
      navigate('/app/today')
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-slate-900">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow dark:bg-slate-800 sm:p-8">
        <h1 className="mb-6 text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">Create account</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input className="input" placeholder="Email (optional)" type="email" value={email} onChange={e => setEmail(e.target.value)} />
            {!email && <p className="mt-1 text-xs text-amber-600">Without an email you won't be able to recover your account.</p>}
          </div>
          <input className="input" placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button className="btn-primary w-full" type="submit">Create account</button>
        </form>
        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          <Link to="/login" className="underline">Already have an account?</Link>
        </div>
      </div>
    </div>
  )
}
