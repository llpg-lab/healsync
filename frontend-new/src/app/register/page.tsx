'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, Check, Eye, EyeOff, Utensils } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useAppStore, type UserProfile } from '@/store/useAppStore'

const onboardingSteps = [
  { title: '基础信息', subtitle: '这些信息只会保存在你的浏览器本地' },
  { title: '饮食偏好', subtitle: '帮助应用给出更贴近你的建议' },
  { title: '健康情况', subtitle: '记录过敏、忌口和当前状态' },
  { title: '目标设置', subtitle: '选择你现阶段最想关注的方向' },
]

const tasteOptions = ['清淡', '鲜香', '偏辣', '偏甜', '低油', '高蛋白']
const allergyOptions = ['海鲜', '花生', '乳制品', '鸡蛋', '麸质', '无']
const conditionOptions = ['减脂中', '增肌中', '睡眠不足', '肠胃敏感', '压力较大', '状态稳定']
const fitnessGoals = ['控制体重', '改善饮食', '提升精力', '稳定作息', '减少焦虑']

const emptyProfile: UserProfile = {
  gender: '',
  age: '',
  height: '',
  weight: '',
  taste: [],
  allergies: [],
  conditions: [],
  fitnessGoal: '',
}

export default function RegisterPage() {
  const router = useRouter()
  const setUser = useAppStore((state) => state.setUser)
  const setUserProfile = useAppStore((state) => state.setUserProfile)
  const [step, setStep] = useState(0)
  const [username, setUsername] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [profile, setProfile] = useState<UserProfile>(emptyProfile)

  const totalSteps = onboardingSteps.length + 1
  const profileStep = step - 1
  const isAccountStep = step === 0

  const toggleArrayItem = (item: string, field: 'taste' | 'allergies' | 'conditions') => {
    setProfile((current) => ({
      ...current,
      [field]: current[field].includes(item)
        ? current[field].filter((value) => value !== item)
        : [...current[field], item],
    }))
  }

  const handleRegister = () => {
    const name = username.trim()
    const mail = email.trim()

    if (!name) {
      setError('请输入用户名')
      return
    }
    if (!mail) {
      setError('请输入邮箱')
      return
    }
    if (password.length < 6) {
      setError('密码至少需要 6 位')
      return
    }

    localStorage.setItem(
      'healsync_registered_user',
      JSON.stringify({ username: name, email: mail, password })
    )
    setError('')
    setStep(1)
  }

  const finishRegister = () => {
    const user = {
      username: username.trim(),
      email: email.trim(),
    }

    localStorage.setItem('healsync_user', JSON.stringify(user))
    localStorage.setItem('healsync_profile', JSON.stringify(profile))
    setUser(user)
    setUserProfile(profile)
    router.push('/home')
  }

  const handleNext = () => {
    if (step < totalSteps - 1) {
      setStep(step + 1)
      return
    }

    finishRegister()
  }

  const handleBack = () => {
    if (step > 0) setStep(step - 1)
  }

  return (
    <main className="min-h-screen bg-cream flex items-center justify-center px-4 py-10 relative overflow-hidden">
      {step > 0 ? (
        <motion.button
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.95 }}
          onClick={handleBack}
          className="absolute top-8 left-8 p-3 rounded-full glass"
          aria-label="返回上一步"
        >
          <ArrowLeft className="w-5 h-5 text-gray-600" />
        </motion.button>
      ) : (
        <Link href="/" aria-label="返回首页">
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.95 }}
            className="absolute top-8 left-8 p-3 rounded-full glass"
          >
            <ArrowLeft className="w-5 h-5 text-gray-600" />
          </motion.button>
        </Link>
      )}

      <div className="absolute top-8 right-8 flex gap-2">
        {Array.from({ length: totalSteps }).map((_, index) => (
          <div
            key={index}
            className={`w-2 h-2 rounded-full transition-all ${
              index <= step ? 'bg-morandi-purple' : 'bg-gray-300'
            }`}
          />
        ))}
      </div>

      <div key={step} className="w-full max-w-md">
        {isAccountStep ? (
          <>
            <div className="text-center mb-8">
              <div className="w-20 h-20 mx-auto mb-4 rounded-5xl bg-gradient-to-br from-morandi-pink to-morandi-purple flex items-center justify-center shadow-xl">
                <Utensils className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-3xl font-bold text-gray-800">创建本地账号</h1>
              <p className="text-gray-500 mt-2">账号和资料只存放在当前浏览器</p>
            </div>

            <div className="glass rounded-5xl p-8">
              <div className="space-y-5">
                <Field label="用户名">
                  <input
                    type="text"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    placeholder="请输入用户名"
                    className="input"
                  />
                </Field>

                <Field label="邮箱">
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    placeholder="请输入邮箱"
                    className="input"
                  />
                </Field>

                <Field label="密码">
                  <div className="relative">
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      placeholder="至少 6 位"
                      className="input pr-12"
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
                </Field>

                {error && <p className="text-red-500 text-sm text-center">{error}</p>}

                <PrimaryButton onClick={handleRegister}>继续填写资料</PrimaryButton>
              </div>

              <div className="mt-6 text-center">
                <span className="text-gray-500">已经有账号？</span>
                <Link href="/login" className="text-morandi-purple font-medium ml-1 hover:underline">
                  去登录
                </Link>
              </div>
            </div>
          </>
        ) : (
          <>
            <div className="text-center mb-8">
              <h1 className="text-3xl font-bold text-gray-800">{onboardingSteps[profileStep].title}</h1>
              <p className="text-gray-500 mt-2">{onboardingSteps[profileStep].subtitle}</p>
            </div>

            <div className="glass rounded-5xl p-8">
              {profileStep === 0 && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="性别">
                      <select
                        value={profile.gender}
                        onChange={(event) => setProfile({ ...profile, gender: event.target.value })}
                        className="input"
                      >
                        <option value="">请选择</option>
                        <option value="女">女</option>
                        <option value="男">男</option>
                        <option value="其他">其他</option>
                      </select>
                    </Field>
                    <Field label="年龄">
                      <input
                        type="number"
                        value={profile.age}
                        onChange={(event) => setProfile({ ...profile, age: event.target.value })}
                        placeholder="岁"
                        className="input"
                      />
                    </Field>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="身高">
                      <input
                        type="number"
                        value={profile.height}
                        onChange={(event) => setProfile({ ...profile, height: event.target.value })}
                        placeholder="cm"
                        className="input"
                      />
                    </Field>
                    <Field label="体重">
                      <input
                        type="number"
                        value={profile.weight}
                        onChange={(event) => setProfile({ ...profile, weight: event.target.value })}
                        placeholder="kg"
                        className="input"
                      />
                    </Field>
                  </div>
                </div>
              )}

              {profileStep === 1 && (
                <OptionGrid
                  options={tasteOptions}
                  selected={profile.taste}
                  onToggle={(item) => toggleArrayItem(item, 'taste')}
                />
              )}

              {profileStep === 2 && (
                <div className="space-y-6">
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-4">过敏/忌口</p>
                    <OptionGrid
                      options={allergyOptions}
                      selected={profile.allergies}
                      onToggle={(item) => toggleArrayItem(item, 'allergies')}
                    />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-4">健康情况</p>
                    <OptionGrid
                      options={conditionOptions}
                      selected={profile.conditions}
                      onToggle={(item) => toggleArrayItem(item, 'conditions')}
                    />
                  </div>
                </div>
              )}

              {profileStep === 3 && (
                <div className="space-y-3">
                  {fitnessGoals.map((goal) => (
                    <button
                      key={goal}
                      onClick={() => setProfile({ ...profile, fitnessGoal: goal })}
                      className={`w-full py-4 px-6 rounded-4xl border-2 transition-all flex items-center justify-between ${
                        profile.fitnessGoal === goal
                          ? 'border-morandi-blue bg-morandi-blue/10 text-morandi-blue'
                          : 'border-gray-200 bg-white/50 text-gray-600'
                      }`}
                    >
                      <span>{goal}</span>
                      {profile.fitnessGoal === goal && <Check className="w-5 h-5" />}
                    </button>
                  ))}
                </div>
              )}

              <PrimaryButton onClick={handleNext} className="mt-6">
                {profileStep === onboardingSteps.length - 1 ? '完成并进入应用' : '下一步'}
              </PrimaryButton>
            </div>
          </>
        )}
      </div>
    </main>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-sm font-medium text-gray-600 mb-2">{label}</span>
      {children}
    </label>
  )
}

function OptionGrid({
  options,
  selected,
  onToggle,
}: {
  options: string[]
  selected: string[]
  onToggle: (item: string) => void
}) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {options.map((option) => (
        <button
          key={option}
          onClick={() => onToggle(option)}
          className={`min-h-12 px-3 rounded-4xl border-2 transition-all flex items-center justify-center gap-2 text-sm ${
            selected.includes(option)
              ? 'border-morandi-purple bg-morandi-purple/10 text-morandi-purple'
              : 'border-gray-200 bg-white/50 text-gray-600'
          }`}
        >
          {selected.includes(option) && <Check className="w-4 h-4 shrink-0" />}
          <span>{option}</span>
        </button>
      ))}
    </div>
  )
}

function PrimaryButton({
  children,
  onClick,
  className = '',
}: {
  children: React.ReactNode
  onClick: () => void
  className?: string
}) {
  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={onClick}
      className={`w-full py-4 rounded-4xl bg-gradient-to-r from-morandi-pink to-morandi-purple text-white font-semibold text-lg shadow-lg hover:shadow-xl transition-all ${className}`}
    >
      {children}
    </motion.button>
  )
}
