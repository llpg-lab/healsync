'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Eye, EyeOff, Utensils } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAppStore } from '@/store/useAppStore'
import { apiFetch } from '@/lib/api'

export default function LoginPage() {
  const router = useRouter()
  const setUser = useAppStore((state) => state.setUser)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')

  const handleLogin = async () => {
    const name = username.trim()

    if (!name) {
      setError('请输入用户名')
      return
    }
    if (!password.trim()) {
      setError('请输入密码')
      return
    }

    try {
      const session = await apiFetch<{
        token: string
        user: { id: string; username: string; email: string }
        profile: unknown
      }>('/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: name, password }),
      })

      localStorage.setItem('healsync_auth_token', session.token)
      localStorage.setItem('healsync_user', JSON.stringify(session.user))
      if (session.profile) localStorage.setItem('healsync_profile', JSON.stringify(session.profile))
      setUser(session.user)
      router.push('/home')
    } catch (error) {
      setError(error instanceof Error ? error.message : '登录失败')
    }
  }

  return (
    <main className="min-h-screen bg-cream flex items-center justify-center px-4 relative overflow-hidden">
      <Link href="/" aria-label="返回首页">
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          className="absolute top-8 left-8 p-3 rounded-full glass"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </motion.button>
      </Link>

      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-20 h-20 mx-auto mb-4 rounded-5xl bg-gradient-to-br from-morandi-pink to-morandi-purple flex items-center justify-center shadow-xl">
            <Utensils className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-800">欢迎回来</h1>
          <p className="text-gray-500 mt-2">登录本地 HealSync 账号</p>
        </div>

        <div className="glass rounded-5xl p-8">
          <div className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">用户名</label>
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="请输入用户名"
                className="w-full px-5 py-4 rounded-4xl bg-white/50 border border-white/50 focus:outline-none focus:border-morandi-purple transition-colors"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-600 mb-2">密码</label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="请输入密码"
                  className="w-full px-5 py-4 rounded-4xl bg-white/50 border border-white/50 focus:outline-none focus:border-morandi-purple transition-colors pr-12"
                />
                <button
                  type="button"
                  aria-label={showPassword ? '隐藏密码' : '显示密码'}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {error && <p className="text-red-500 text-sm text-center">{error}</p>}

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleLogin}
              className="w-full py-4 rounded-4xl bg-gradient-to-r from-morandi-pink to-morandi-purple text-white font-semibold text-lg shadow-lg hover:shadow-xl transition-all"
            >
              登录
            </motion.button>
          </div>

          <div className="mt-6 text-center">
            <span className="text-gray-500">还没有账号？</span>
            <Link href="/register" className="text-morandi-purple font-medium ml-1 hover:underline">
              创建本地账号
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
