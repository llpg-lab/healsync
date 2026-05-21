import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface UserProfile {
  gender: string
  age: string
  height: string
  weight: string
  taste: string[]
  allergies: string[]
  conditions: string[]
  fitnessGoal: string
}

export interface User {
  id?: string
  username: string
  email: string
  password?: string
}

interface AppState {
  user: User | null
  userProfile: UserProfile | null
  isLoggedIn: boolean
  onboardingStep: number
  setUser: (user: User) => void
  setUserProfile: (profile: UserProfile) => void
  logout: () => void
  setOnboardingStep: (step: number) => void
  getUserProfilePrompt: () => string
}

export const useAppStore = create<AppState>()(
  persist(
    (set, get) => ({
      user: null,
      userProfile: null,
      isLoggedIn: false,
      onboardingStep: 0,

      setUser: (user) => set({ user, isLoggedIn: true }),
      setUserProfile: (profile) => set({ userProfile: profile }),
      logout: () =>
        set({
          user: null,
          userProfile: null,
          isLoggedIn: false,
          onboardingStep: 0,
        }),
      setOnboardingStep: (step) => set({ onboardingStep: step }),

      getUserProfilePrompt: () => {
        const { userProfile } = get()
        if (!userProfile) return ''

        return [
          `性别：${userProfile.gender || '未填写'}`,
          `年龄：${userProfile.age || '未填写'}`,
          `身高：${userProfile.height || '未填写'} cm`,
          `体重：${userProfile.weight || '未填写'} kg`,
          `口味偏好：${userProfile.taste.join('、') || '未填写'}`,
          `过敏/忌口：${userProfile.allergies.join('、') || '无'}`,
          `健康情况：${userProfile.conditions.join('、') || '未填写'}`,
          `目标：${userProfile.fitnessGoal || '未填写'}`,
        ].join('\n')
      },
    }),
    {
      name: 'healsync-storage',
    }
  )
)
