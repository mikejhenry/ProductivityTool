import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
  const { signIn } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    try {
      await signIn(email, password)
      navigate('/app/today')
    } catch (err: any) {
      setError(err.message)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-slate-900">
      <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow dark:bg-slate-800 sm:p-8">
        <h1 className="mb-6 text-xl font-bold text-gray-900 dark:text-white sm:text-2xl">Sign in</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <input className="input" placeholder="Email" type="email" value={email} onChange={e => setEmail(e.target.value)} required />
          <input className="input" placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} required />
          {error && <p className="text-sm text-red-500">{error}</p>}
          <button className="btn-primary w-full" type="submit">Sign in</button>
        </form>
        <div className="mt-4 text-sm text-gray-500 dark:text-gray-400">
          <Link to="/signup" className="underline">Create account</Link>
          {' · '}
          <Link to="/reset-password" className="underline">Forgot password?</Link>
        </div>
      </div>
    </div>
  )
}
