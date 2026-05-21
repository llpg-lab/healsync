'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Apple,
  CalendarDays,
  Camera,
  CheckCircle2,
  ClipboardList,
  Edit3,
  Home,
  Loader2,
  LogOut,
  NotebookPen,
  Save,
  Sparkles,
  Upload,
  Utensils,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAppStore, type User, type UserProfile } from '@/store/useAppStore'

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000'
const SCORE_BUCKETS = [20, 40, 60, 80, 100] as const

type AgentOpinion = {
  agent_name: string
  role: string
  opinion: string
  stance: string
  round_num: number
  search_query?: string | null
}

type DecisionResponse = {
  round1_debate: AgentOpinion[]
  round2_debate: AgentOpinion[]
  final_decision: {
    debate_result: string
    mindset_adjustment: string
    today_good: string
    today_bad: string
    dinner_recommendation: string
    action_index: number
    avatar_state: string
  }
  wellness_score: number
}

type DietResult = {
  food_identification: string[]
  analysis: {
    tcm?: string
    nutrition?: string
    psychology?: string
  }
  score: number
  timestamp?: string
  image_count?: number
  model_used?: string
}

type HistoryRecord = {
  id: string
  input: string
  score: number
  summary: string
  createdAt: string
}

type DietScoreRecord = {
  score: number
  createdAt: string
}

type SuggestionRecord = {
  id: string
  ingredients: string
  mood: string
  note: string
  createdAt?: string
}

type MealRecord = {
  id: string
  title: string
  score?: number
  note: string
  createdAt?: string
  images?: string[]
  result?: DietResult
}

type SelectedDietPhoto = {
  id: string
  file: File
  preview: string
}

type AgentStreamEvent = {
  type: 'agent_complete' | 'final_decision' | 'error' | 'done'
  agent_name?: string
  role?: string
  opinion?: string
  stance?: string
  round_num?: number
  search_query?: string | null
  debate_result?: string
  mindset_adjustment?: string
  today_good?: string
  today_bad?: string
  dinner_recommendation?: string
  action_index?: number
  avatar_state?: string
  wellness_score?: number
  message?: string
}

const ingredientOptions = ['鸡蛋', '青菜', '米饭', '豆腐', '番茄', '牛奶', '燕麦', '鱼肉']
const moodOptions = ['平稳', '疲惫', '焦虑', '开心', '压力大', '想吃甜']
const seededSuggestions: SuggestionRecord[] = [
  { id: 's1', ingredients: '鸡蛋、青菜、米饭', mood: '平稳', note: '晚餐希望清淡但有饱腹感' },
  { id: 's2', ingredients: '豆腐、番茄、燕麦', mood: '疲惫', note: '需要恢复精力，避免太油' },
  { id: 's3', ingredients: '鱼肉、青菜、牛奶', mood: '压力大', note: '想要稳定情绪和睡眠' },
]
const defaultSuggestions: SuggestionRecord[] = []
const emptySuggestion: SuggestionRecord = {
  id: 'draft',
  ingredients: '',
  mood: seededSuggestions[0]?.mood || 'å¹³ç¨³',
  note: '',
}
const defaultMeals: MealRecord[] = [
  { id: 'm1', title: '早餐记录', score: 78, note: '燕麦、牛奶、鸡蛋' },
  { id: 'm2', title: '午餐记录', score: 72, note: '米饭、青菜、豆腐' },
  { id: 'm3', title: '晚餐记录', score: 80, note: '鱼肉、番茄、少量主食' },
]

const fallbackDecision: DecisionResponse = {
  round1_debate: [
    {
      agent_name: '体质 Agent',
      role: 'constitution',
      opinion: '当前状态适合选择温和、易消化、有稳定能量释放的食物。',
      stance: '稳态优先',
      round_num: 1,
    },
    {
      agent_name: '营养 Agent',
      role: 'nutrition',
      opinion: '建议保证蛋白质、蔬菜和主食比例，避免只吃零食或单一碳水。',
      stance: '均衡摄入',
      round_num: 1,
    },
  ],
  round2_debate: [
    {
      agent_name: '执行 Agent',
      role: 'discipline',
      opinion: '把方案压缩成一顿能马上做的饭，比追求完美菜单更重要。',
      stance: '可执行',
      round_num: 2,
    },
    {
      agent_name: '情绪 Agent',
      role: 'pleasure',
      opinion: '保留一点喜欢的口味可以降低补偿性进食的概率。',
      stance: '不过度克制',
      round_num: 2,
    },
  ],
  final_decision: {
    debate_result: '优先选择一份清淡蛋白、一份熟蔬菜和适量主食，控制油盐，同时照顾当下情绪。',
    mindset_adjustment: '不用把这一餐当成考试，先完成一顿稳定的饭。',
    today_good: '有记录和主动决策，就是很好的自我观察。',
    today_bad: '避免因为情绪波动临时改成高糖高油组合。',
    dinner_recommendation: '番茄豆腐蛋汤配半碗米饭，或青菜鱼肉饭，适合今天的状态。',
    action_index: 7,
    avatar_state: 'stable',
  },
  wellness_score: 76,
}

export default function HomePage() {
  const router = useRouter()
  const { user, userProfile, setUser, setUserProfile, logout, getUserProfilePrompt } = useAppStore()
  const [decision, setDecision] = useState<DecisionResponse | null>(null)
  const [dietResult, setDietResult] = useState<DietResult | null>(null)
  const [history, setHistory] = useState<HistoryRecord[]>([])
  const [dietScores, setDietScores] = useState<DietScoreRecord[]>([])
  const [suggestions, setSuggestions] = useState<SuggestionRecord[]>(defaultSuggestions)
  const [draftSuggestion, setDraftSuggestion] = useState<SuggestionRecord>(emptySuggestion)
  const [mealRecords, setMealRecords] = useState<MealRecord[]>(defaultMeals)
  const [isDeciding, setIsDeciding] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [notice, setNotice] = useState('')
  const [showProfileEditor, setShowProfileEditor] = useState(false)
  const [showCalendar, setShowCalendar] = useState(false)
  const [showAgentDialog, setShowAgentDialog] = useState(false)
  const [agentEvents, setAgentEvents] = useState<AgentStreamEvent[]>([])
  const [streamFinal, setStreamFinal] = useState<AgentStreamEvent | null>(null)
  const [streamError, setStreamError] = useState('')
  const [selectedMealRecord, setSelectedMealRecord] = useState<MealRecord | null>(null)

  useEffect(() => {
    const savedUser = localStorage.getItem('healsync_user')
    const savedProfile = localStorage.getItem('healsync_profile')
    const savedHistory = localStorage.getItem('healsync_history')
    const savedDietScores = localStorage.getItem('healsync_diet_scores')
    const savedSuggestions = localStorage.getItem('healsync_suggestions')
    const savedMeals = localStorage.getItem('healsync_meal_records')

    if (!savedUser) {
      router.push('/')
      return
    }

    setUser(JSON.parse(savedUser) as User)
    if (savedProfile) setUserProfile(JSON.parse(savedProfile) as UserProfile)
    if (savedHistory) setHistory(JSON.parse(savedHistory) as HistoryRecord[])
    if (savedDietScores) setDietScores(JSON.parse(savedDietScores) as DietScoreRecord[])
    if (savedSuggestions) {
      const savedSuggestionRecords = (JSON.parse(savedSuggestions) as SuggestionRecord[]).filter(
        (record) => !['s1', 's2', 's3'].includes(record.id),
      )
      setSuggestions(savedSuggestionRecords)
      localStorage.setItem('healsync_suggestions', JSON.stringify(savedSuggestionRecords))
    }
    if (savedMeals) setMealRecords(JSON.parse(savedMeals) as MealRecord[])
  }, [router, setUser, setUserProfile])

  const profileSummary = useMemo(() => {
    if (!userProfile) return '尚未完善长期状态，点击左侧长期状态可编辑'

    return [
      userProfile.gender,
      userProfile.age && `${userProfile.age} 岁`,
      userProfile.height && `${userProfile.height} cm`,
      userProfile.weight && `${userProfile.weight} kg`,
      userProfile.fitnessGoal && userProfile.fitnessGoal,
    ]
      .filter(Boolean)
      .join(' / ')
  }, [userProfile])

  const averageDietScore = useMemo(() => {
    const recentScores = dietScores.slice(0, 7).map((record) => record.score)
    if (recentScores.length === 0) return dietResult?.score ?? 76
    return Math.round(recentScores.reduce((sum, score) => sum + score, 0) / recentScores.length)
  }, [dietResult?.score, dietScores])

  const stateBucket = useMemo(() => {
    return SCORE_BUCKETS.find((bucket) => averageDietScore <= bucket) ?? 100
  }, [averageDietScore])

  const persistHistory = (record: HistoryRecord) => {
    const nextHistory = [record, ...history].slice(0, 8)
    setHistory(nextHistory)
    localStorage.setItem('healsync_history', JSON.stringify(nextHistory))
  }

  const persistDietScore = (score: number) => {
    const nextScores = [{ score, createdAt: new Date().toLocaleString('zh-CN') }, ...dietScores].slice(0, 14)
    setDietScores(nextScores)
    localStorage.setItem('healsync_diet_scores', JSON.stringify(nextScores))
  }

  const runDecision = async (records = suggestions) => {
    const currentContext = records
      .map((item, index) => `${index + 1}. 手边食材：${item.ingredients || '未填写'}；情绪：${item.mood}；备注：${item.note}`)
      .join('\n')

    setIsDeciding(true)
    setNotice('')

    try {
      const response = await fetch(`${API_BASE_URL}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_input: currentContext,
          quick_tabs: records.map((item) => item.mood),
          context: {
            profile: userProfile,
            profile_prompt: getUserProfilePrompt(),
            short_term_state: records,
            time: new Date().toLocaleString('zh-CN'),
            diet_score_window: dietScores.slice(0, 7),
          },
        }),
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)

      const data = (await response.json()) as DecisionResponse
      setDecision(data)
      persistHistory({
        id: crypto.randomUUID(),
        input: '饮食建议决策',
        score: data.wellness_score,
        summary: data.final_decision.dinner_recommendation,
        createdAt: new Date().toLocaleString('zh-CN'),
      })
    } catch {
      setDecision(fallbackDecision)
      persistHistory({
        id: crypto.randomUUID(),
        input: '饮食建议决策',
        score: fallbackDecision.wellness_score,
        summary: fallbackDecision.final_decision.dinner_recommendation,
        createdAt: new Date().toLocaleString('zh-CN'),
      })
      setNotice('后端决策接口暂时不可用，已展示本地备用建议。')
    } finally {
      setIsDeciding(false)
    }
  }

  const runDecisionStream = async (records = suggestions) => {
    const currentContext = records
      .map((item, index) => `${index + 1}. 食材：${item.ingredients || '未填写'}；情绪：${item.mood}；备注：${item.note}`)
      .join('\n')
    const requestBody = {
      user_input: currentContext,
      quick_tabs: records.map((item) => item.mood),
      context: {
        profile: userProfile,
        profile_prompt: getUserProfilePrompt(),
        short_term_state: records,
        time: new Date().toLocaleString('zh-CN'),
        diet_score_window: dietScores.slice(0, 7),
      },
    }

    setIsDeciding(true)
    setNotice('')
    setStreamError('')
    setStreamFinal(null)
    setAgentEvents([])
    setShowAgentDialog(true)

    try {
      const response = await fetch(`${API_BASE_URL}/decide/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      if (!response.body) throw new Error('No stream body')

      const streamedAgents: AgentStreamEvent[] = []
      const decoder = new TextDecoder()
      const reader = response.body.getReader()
      let buffer = ''

      const handleStreamEvent = (event: AgentStreamEvent) => {
        if (event.type === 'agent_complete') {
          streamedAgents.push(event)
          setAgentEvents((current) => [...current, event])
          return
        }

        if (event.type === 'final_decision') {
          setStreamFinal(event)
          const data: DecisionResponse = {
            round1_debate: streamedAgents
              .filter((item) => item.round_num === 1)
              .map((item) => ({
                agent_name: item.agent_name || '',
                role: item.role || '',
                opinion: item.opinion || '',
                stance: item.stance || '',
                round_num: item.round_num || 1,
                search_query: item.search_query,
              })),
            round2_debate: streamedAgents
              .filter((item) => item.round_num === 2)
              .map((item) => ({
                agent_name: item.agent_name || '',
                role: item.role || '',
                opinion: item.opinion || '',
                stance: item.stance || '',
                round_num: item.round_num || 2,
                search_query: item.search_query,
              })),
            final_decision: {
              debate_result: event.debate_result || '',
              mindset_adjustment: event.mindset_adjustment || '',
              today_good: event.today_good || '',
              today_bad: event.today_bad || '',
              dinner_recommendation: event.dinner_recommendation || '',
              action_index: event.action_index || 0,
              avatar_state: event.avatar_state || 'neutral',
            },
            wellness_score: event.wellness_score || 0,
          }

          setDecision(data)
          persistHistory({
            id: crypto.randomUUID(),
            input: '饮食建议决策',
            score: data.wellness_score,
            summary: data.final_decision.dinner_recommendation,
            createdAt: new Date().toLocaleString('zh-CN'),
          })
        }

        if (event.type === 'error') {
          throw new Error(event.message || 'Stream error')
        }
      }

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const chunks = buffer.split('\n\n')
        buffer = chunks.pop() || ''

        for (const chunk of chunks) {
          const dataLine = chunk
            .split('\n')
            .find((line) => line.startsWith('data:'))
            ?.replace(/^data:\s*/, '')

          if (!dataLine) continue
          const event = JSON.parse(dataLine) as AgentStreamEvent
          if (event.type === 'done') continue
          handleStreamEvent(event)
        }
      }
    } catch (error) {
      setDecision(fallbackDecision)
      setStreamError(error instanceof Error ? error.message : '后端流式决策暂时不可用')
      persistHistory({
        id: crypto.randomUUID(),
        input: '饮食建议决策',
        score: fallbackDecision.wellness_score,
        summary: fallbackDecision.final_decision.dinner_recommendation,
        createdAt: new Date().toLocaleString('zh-CN'),
      })
      setNotice('后端流式决策暂时不可用，已展示本地备用建议。')
    } finally {
      setIsDeciding(false)
    }
  }

  const handleGenerateSuggestion = () => {
    const record = {
      ...draftSuggestion,
      id: crypto.randomUUID(),
      createdAt: new Date().toLocaleString('zh-CN', { hour: '2-digit', minute: '2-digit' }),
    }
    const next = [record, ...suggestions]
    setSuggestions(next)
    localStorage.setItem('healsync_suggestions', JSON.stringify(next))
    setDraftSuggestion(emptySuggestion)
    void runDecisionStream(next)
  }

  const analyzeDiet = async (files: FileList | File[] | null, imageUrls: string[] = []) => {
    const imageFiles = Array.from(files || [])
    if (imageFiles.length === 0) return false

    setIsAnalyzing(true)
    setNotice('')

    const body = new FormData()
    imageFiles.forEach((file) => body.append('images', file))
    body.append('user_id', user?.username || 'default')

    try {
      const response = await fetch(`${API_BASE_URL}/diet/analyze`, {
        method: 'POST',
        body,
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null)
        throw new Error(errorBody?.detail || `HTTP ${response.status}`)
      }
      const result = (await response.json()) as DietResult
      setDietResult(result)
      persistDietScore(result.score)
      const createdAt = new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
      const record: MealRecord = {
        id: crypto.randomUUID(),
        title: `照片分析 ${createdAt}`,
        score: result.score,
        note: result.food_identification.join('、') || result.analysis.nutrition || '已完成饮食分析',
        createdAt,
        images: imageUrls,
        result,
      }
      const nextMeals = [
        record,
        ...mealRecords,
      ]
      setMealRecords(nextMeals)
      localStorage.setItem('healsync_meal_records', JSON.stringify(nextMeals))
      setSelectedMealRecord(record)
      return true
    } catch (error) {
      const message = error instanceof Error ? error.message : '未知错误'
      setNotice(`饮食图片分析失败：${message}`)
      return false
    } finally {
      setIsAnalyzing(false)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('healsync_user')
    localStorage.removeItem('healsync_profile')
    localStorage.removeItem('user_profile_prompt')
    logout()
    router.push('/')
  }

  return (
    <main className="min-h-screen bg-cream px-3 py-4 text-gray-900 md:px-6 lg:h-screen lg:overflow-hidden lg:px-8">
      <div className="mx-auto grid max-w-[1680px] gap-5 rounded-[1.5rem] bg-white/45 p-4 shadow-[0_24px_80px_rgba(77,67,54,0.12)] backdrop-blur-xl lg:h-[calc(100vh-2rem)] lg:grid-cols-[260px_minmax(520px,1.35fr)_400px] lg:overflow-hidden xl:grid-cols-[290px_minmax(620px,1.45fr)_430px]">
        <WorkbenchSidebar
          user={user}
          profileSummary={profileSummary}
          userProfile={userProfile}
          scores={dietScores}
          stateScore={averageDietScore}
          onEditProfile={() => setShowProfileEditor(true)}
          onOpenCalendar={() => setShowCalendar(true)}
          onLogout={handleLogout}
        />

        <section className="flex min-h-0 min-w-0 flex-col gap-5">
          <TopBar user={user} profileSummary={profileSummary} />

          {notice && (
            <div className="rounded-2xl border border-morandi-yellow/60 bg-white/80 px-4 py-3 text-sm text-gray-600">
              {notice}
            </div>
          )}

          <StateMachine score={averageDietScore} bucket={stateBucket} />
        </section>

        <RightWorkbench
          suggestions={suggestions}
          draftSuggestion={draftSuggestion}
          updateDraftSuggestion={(patch) => setDraftSuggestion((current) => ({ ...current, ...patch }))}
          submitSuggestionDecision={handleGenerateSuggestion}
          isDeciding={isDeciding}
          mealRecords={mealRecords}
          analyzeDiet={analyzeDiet}
          isAnalyzing={isAnalyzing}
          onOpenMealRecord={setSelectedMealRecord}
        />
      </div>

      {showProfileEditor && (
        <ProfileEditor
          userProfile={userProfile}
          onClose={() => setShowProfileEditor(false)}
          onSave={(profile) => {
            setUserProfile(profile)
            localStorage.setItem('healsync_profile', JSON.stringify(profile))
            setShowProfileEditor(false)
          }}
        />
      )}

      {showCalendar && (
        <CalendarModal scores={dietScores} stateScore={averageDietScore} onClose={() => setShowCalendar(false)} />
      )}

      {showAgentDialog && (
        <AgentDebateModal
          events={agentEvents}
          finalEvent={streamFinal}
          isDeciding={isDeciding}
          error={streamError}
          onClose={() => setShowAgentDialog(false)}
        />
      )}

      {selectedMealRecord && (
        <DietRecordModal record={selectedMealRecord} onClose={() => setSelectedMealRecord(null)} />
      )}
    </main>
  )
}

function WorkbenchSidebar({
  user,
  profileSummary,
  userProfile,
  scores,
  stateScore,
  onEditProfile,
  onOpenCalendar,
  onLogout,
}: {
  user: User | null
  profileSummary: string
  userProfile: UserProfile | null
  scores: DietScoreRecord[]
  stateScore: number
  onEditProfile: () => void
  onOpenCalendar: () => void
  onLogout: () => void
}) {
  return (
    <aside className="flex flex-col gap-4 rounded-[1.25rem] bg-white/75 p-4 shadow-sm">
      <div className="flex items-center gap-3 border-b border-cream pb-4">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gray-900 text-morandi-yellow">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <div className="font-bold">HealSync</div>
          <div className="truncate text-xs text-gray-500">{user?.username || '工作台'}</div>
        </div>
      </div>


      <button
        onClick={onEditProfile}
        className="rounded-2xl bg-cream p-4 text-left transition hover:bg-morandi-yellow/30"
      >
        <div className="mb-2 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold">长期状态</h2>
          <Edit3 className="h-4 w-4 text-gray-600" />
        </div>
        <p className="line-clamp-2 text-xs leading-5 text-gray-600">{profileSummary}</p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
          <span>口味：{userProfile?.taste?.slice(0, 2).join('、') || '待补充'}</span>
          <span>目标：{userProfile?.fitnessGoal || '待补充'}</span>
        </div>
      </button>

      <button
        onClick={onOpenCalendar}
        className="rounded-2xl bg-gray-900 p-4 text-left text-white transition hover:bg-gray-800"
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h2 className="text-sm font-bold">饮食记录</h2>
          <CalendarDays className="h-4 w-4 text-morandi-yellow" />
        </div>
        <MiniCalendar scores={scores} />
        <p className="mt-3 text-xs text-white/70">近 7 次饮食平均分：{stateScore}</p>
      </button>

      <button
        onClick={onLogout}
        className="mt-auto flex h-11 items-center justify-center gap-2 rounded-2xl bg-white text-sm font-semibold text-gray-700 shadow-sm transition hover:bg-cream"
      >
        <LogOut className="h-4 w-4" />
        退出登录
      </button>
    </aside>
  )
}

function SidebarButton({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: LucideIcon
  label: string
  active?: boolean
  onClick?: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-sm font-semibold transition ${
        active ? 'bg-gray-900 text-morandi-yellow' : 'text-gray-600 hover:bg-cream'
      }`}
    >
      <Icon className="h-5 w-5 shrink-0" />
      <span>{label}</span>
    </button>
  )
}

function TopBar({ user, profileSummary }: { user: User | null; profileSummary: string }) {
  return (
    <header className="flex min-h-16 items-center justify-between gap-4 rounded-[1.25rem] bg-white/70 px-5 py-4 shadow-sm">
      <div className="min-w-0">
        <h1 className="text-2xl font-bold tracking-normal md:text-3xl">Hi，{user?.username || '你好'}</h1>
        <p className="mt-1 truncate text-sm text-gray-500">{profileSummary}</p>
      </div>
    </header>
  )
}

function StateMachine({ score, bucket }: { score: number; bucket: number }) {
  const videoSrc = `/video/${bucket}.mp4`

  return (
    <section className="relative min-h-[420px] flex-1 overflow-hidden rounded-[1.25rem] bg-[#d6cebc] shadow-sm lg:min-h-0">
      <video
        key={videoSrc}
        className="absolute inset-0 h-full w-full object-cover"
        src={videoSrc}
        autoPlay
        loop
        muted
        playsInline
      />
      <div className="absolute inset-0 bg-[#d6cebc]/20" />
      <div className="absolute bottom-5 right-5 flex h-24 w-24 items-center justify-center rounded-full bg-white/90 text-center shadow-xl backdrop-blur">
        <div>
          <div className="text-3xl font-black leading-none">{score}</div>
          <div className="mt-1 text-[11px] font-semibold text-gray-500">饮食均分</div>
        </div>
      </div>
    </section>
  )
}

function DecisionResult({ decision, history }: { decision: DecisionResponse | null; history: HistoryRecord[] }) {
  return (
    <section className="rounded-[1.25rem] bg-white/75 p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-lg font-bold">最近决策</h2>
        <ClipboardList className="h-5 w-5 text-gray-500" />
      </div>

      {decision ? (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          <div className="rounded-2xl bg-cream p-4">
            <div className="mb-2 flex items-center gap-2 font-semibold">
              <CheckCircle2 className="h-4 w-4" />
              综合建议 · {decision.wellness_score}
            </div>
            <p className="text-sm leading-6 text-gray-600">{decision.final_decision.dinner_recommendation}</p>
          </div>
          <p className="text-sm leading-6 text-gray-600">{decision.final_decision.debate_result}</p>
        </div>
      ) : history.length > 0 ? (
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {history.slice(0, 3).map((record) => (
            <article key={record.id} className="rounded-2xl bg-cream p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="font-semibold">{record.input}</h3>
                <span className="rounded-full bg-white px-3 py-1 text-sm">{record.score}</span>
              </div>
              <p className="line-clamp-2 text-sm leading-6 text-gray-600">{record.summary}</p>
            </article>
          ))}
        </div>
      ) : (
        <p className="rounded-2xl bg-cream p-4 text-sm text-gray-500">右侧填写短期状态后，可生成饮食建议。</p>
      )}
    </section>
  )
}

function RightWorkbench({
  suggestions,
  draftSuggestion,
  updateDraftSuggestion,
  submitSuggestionDecision,
  isDeciding,
  mealRecords,
  analyzeDiet,
  isAnalyzing,
  onOpenMealRecord,
}: {
  suggestions: SuggestionRecord[]
  draftSuggestion: SuggestionRecord
  updateDraftSuggestion: (patch: Partial<SuggestionRecord>) => void
  submitSuggestionDecision: () => void
  isDeciding: boolean
  mealRecords: MealRecord[]
  analyzeDiet: (files: FileList | File[] | null, imageUrls?: string[]) => Promise<boolean>
  isAnalyzing: boolean
  onOpenMealRecord: (record: MealRecord) => void
}) {
  const [activeTab, setActiveTab] = useState<'suggestions' | 'records'>('suggestions')
  const [selectedDietPhotos, setSelectedDietPhotos] = useState<SelectedDietPhoto[]>([])
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const addDietPhotos = async (files: FileList | null) => {
    const imageFiles = Array.from(files || []).filter((file) => file.type.startsWith('image/'))
    if (imageFiles.length === 0) return

    const nextPhotos = await Promise.all(
      imageFiles.map(
        (file) =>
          new Promise<SelectedDietPhoto>((resolve) => {
            const reader = new FileReader()
            reader.onload = () => {
              resolve({
                id: crypto.randomUUID(),
                file,
                preview: String(reader.result || ''),
              })
            }
            reader.readAsDataURL(file)
          }),
      ),
    )
    setSelectedDietPhotos((current) => [...current, ...nextPhotos])
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const removeDietPhoto = (id: string) => {
    setSelectedDietPhotos((current) => current.filter((photo) => photo.id !== id))
  }

  const submitDietRecord = async () => {
    if (selectedDietPhotos.length === 0 || isAnalyzing) return
    const ok = await analyzeDiet(
      selectedDietPhotos.map((photo) => photo.file),
      selectedDietPhotos.map((photo) => photo.preview),
    )
    if (ok) setSelectedDietPhotos([])
  }

  return (
    <aside className="flex min-h-0 flex-col rounded-[1.25rem] bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div className="flex rounded-2xl bg-cream p-1">
          <WorkbenchTabButton
            active={activeTab === 'suggestions'}
            icon={Apple}
            label="饮食建议"
            onClick={() => setActiveTab('suggestions')}
          />
          <WorkbenchTabButton
            active={activeTab === 'records'}
            icon={Camera}
            label="饮食记录"
            onClick={() => setActiveTab('records')}
          />
        </div>
      </div>

      <section className={`${activeTab === 'suggestions' ? 'flex' : 'hidden'} min-h-0 flex-1 flex-col`}>
        <PanelHeader title="饮食建议" icon={Apple} />
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {suggestions.length > 0 ? (
            suggestions.map((record) => <SuggestionRecordCard key={record.id} record={record} />)
          ) : (
            <p className="rounded-2xl bg-cream p-4 text-sm text-gray-500">当日饮食建议记录会按生成顺序排列在这里。</p>
          )}
        </div>
        <div className="mt-4 rounded-2xl bg-cream p-4">
          <SuggestionEditor record={draftSuggestion} onChange={updateDraftSuggestion} />
        </div>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={submitSuggestionDecision}
          disabled={isDeciding}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-70"
        >
          {isDeciding ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          生成饮食建议
        </motion.button>
      </section>

      <section className={`${activeTab === 'records' ? 'flex' : 'hidden'} min-h-0 flex-1 flex-col`}>
        <PanelHeader title="饮食记录" icon={Camera} />
        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto pr-1">
          {mealRecords.length > 0 ? (
            mealRecords.map((record) => (
              <button
                key={record.id}
                type="button"
                onClick={() => onOpenMealRecord(record)}
                className="w-full rounded-2xl bg-cream p-4 text-left transition hover:bg-morandi-yellow/25"
              >
                <div className="mb-2 flex items-center justify-between gap-3">
                  <h3 className="text-sm font-bold">{record.title}</h3>
                  <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold">
                    {record.score ?? '--'}
                  </span>
                </div>
                {record.images && record.images.length > 0 && (
                  <div className="mb-3 flex gap-2 overflow-hidden">
                    {record.images.slice(0, 4).map((image, index) => (
                      <img
                        key={`${record.id}-${index}`}
                        src={image}
                        alt=""
                        className="h-12 w-12 rounded-xl object-cover"
                      />
                    ))}
                  </div>
                )}
                <p className="line-clamp-2 text-xs leading-5 text-gray-600">{record.note}</p>
              </button>
            ))
          ) : (
            <p className="rounded-2xl bg-cream p-4 text-sm text-gray-500">当日饮食记录会按上传顺序从上往下排列在这里。</p>
          )}
        </div>

        <div className="mt-4 rounded-2xl bg-cream p-4">
          <label className="flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-morandi-yellow bg-white/55 p-4 text-center transition hover:bg-white/80">
            {isAnalyzing ? <Loader2 className="mb-2 h-6 w-6 animate-spin" /> : <Upload className="mb-2 h-6 w-6" />}
            <span className="text-sm font-semibold">选择饮食照片</span>
            <span className="mt-1 text-xs text-gray-500">
              {selectedDietPhotos.length > 0 ? `已选择 ${selectedDietPhotos.length} 张，可继续添加或删除` : '支持分批选择多张图片'}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(event) => void addDietPhotos(event.target.files)}
            />
          </label>
          {selectedDietPhotos.length > 0 && (
            <div className="mt-3 grid grid-cols-4 gap-2">
              {selectedDietPhotos.map((photo) => (
                <div key={photo.id} className="group relative aspect-square overflow-hidden rounded-xl bg-white">
                  <img src={photo.preview} alt={photo.file.name} className="h-full w-full object-cover" />
                  <button
                    type="button"
                    onClick={() => removeDietPhoto(photo.id)}
                    className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full bg-gray-900/80 text-white"
                    aria-label="删除照片"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
          <motion.button
            whileTap={{ scale: 0.98 }}
            onClick={submitDietRecord}
            disabled={isAnalyzing || selectedDietPhotos.length === 0}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {isAnalyzing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
            上传饮食记录
          </motion.button>
        </div>
      </section>
    </aside>
  )
}

function WorkbenchTabButton({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean
  icon: LucideIcon
  label: string
  onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-9 items-center gap-2 rounded-xl px-3 text-sm font-semibold transition ${
        active ? 'bg-gray-900 text-morandi-yellow shadow-sm' : 'text-gray-600 hover:bg-white/70'
      }`}
    >
      <Icon className="h-4 w-4" />
      <span>{label}</span>
    </button>
  )
}

function DietRecordModal({ record, onClose }: { record: MealRecord; onClose: () => void }) {
  const result = record.result
  const foods = result?.food_identification?.length ? result.food_identification.join('、') : record.note

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/45 p-4 backdrop-blur-sm">
      <section className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-[1.25rem] bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-cream px-5 py-4">
          <div>
            <h2 className="text-lg font-bold">{record.title}</h2>
            <p className="mt-1 text-sm text-gray-500">{record.createdAt || '饮食记录详情'}</p>
          </div>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-cream">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {record.images && record.images.length > 0 && (
            <div className="mb-5 grid grid-cols-2 gap-3 md:grid-cols-3">
              {record.images.map((image, index) => (
                <img
                  key={`${record.id}-detail-${index}`}
                  src={image}
                  alt={`饮食照片 ${index + 1}`}
                  className="aspect-square w-full rounded-2xl object-cover"
                />
              ))}
            </div>
          )}

          <div className="mb-4 flex items-center justify-between gap-3 rounded-2xl bg-gray-900 p-4 text-white">
            <div>
              <div className="text-xs text-white/60">识别结果</div>
              <div className="mt-1 text-sm font-semibold">{foods || '暂无识别结果'}</div>
            </div>
            <div className="shrink-0 text-right">
              <div className="text-3xl font-black leading-none">{record.score ?? result?.score ?? '--'}</div>
              <div className="mt-1 text-xs text-white/60">饮食分值</div>
            </div>
          </div>

          {result ? (
            <div className="grid gap-3 md:grid-cols-3">
              <AnalysisBlock title="中医分析" text={result.analysis.tcm} />
              <AnalysisBlock title="营养分析" text={result.analysis.nutrition} />
              <AnalysisBlock title="心理分析" text={result.analysis.psychology} />
            </div>
          ) : (
            <p className="rounded-2xl bg-cream p-4 text-sm leading-6 text-gray-600">{record.note}</p>
          )}
        </div>
      </section>
    </div>
  )
}

function AnalysisBlock({ title, text }: { title: string; text?: string }) {
  return (
    <article className="rounded-2xl bg-cream p-4">
      <h3 className="text-sm font-bold">{title}</h3>
      <p className="mt-2 text-sm leading-6 text-gray-600">{text || '暂无分析'}</p>
    </article>
  )
}

function AgentDebateModal({
  events,
  finalEvent,
  isDeciding,
  error,
  onClose,
}: {
  events: AgentStreamEvent[]
  finalEvent: AgentStreamEvent | null
  isDeciding: boolean
  error: string
  onClose: () => void
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [events.length, finalEvent, error])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/45 p-4 backdrop-blur-sm">
      <section className="flex max-h-[86vh] w-full max-w-4xl flex-col rounded-[1.25rem] bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-cream px-5 py-4">
          <div>
            <h2 className="text-lg font-bold">Agent 实时讨论</h2>
            <p className="mt-1 text-sm text-gray-500">
              {isDeciding ? '正在生成饮食状态建议，各个 agent 会陆续发言。' : '讨论已结束，可以关闭窗口。'}
            </p>
          </div>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-cream">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto px-5 py-4">
          {events.length === 0 && !error && (
            <div className="flex items-center gap-3 rounded-2xl bg-cream p-4 text-sm text-gray-600">
              <Loader2 className="h-4 w-4 animate-spin" />
              等待第一个 agent 发言...
            </div>
          )}

          {events.map((event, index) => (
            <article key={`${event.agent_name}-${event.round_num}-${index}`} className="rounded-2xl bg-cream p-4">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="rounded-full bg-gray-900 px-3 py-1 text-xs font-semibold text-morandi-yellow">
                    第 {event.round_num || '-'} 轮
                  </span>
                  <h3 className="text-sm font-bold">{event.agent_name || 'Agent'}</h3>
                  {event.stance && <span className="text-xs text-gray-500">{event.stance}</span>}
                </div>
                {event.search_query && <span className="text-xs text-gray-500">检索：{event.search_query}</span>}
              </div>
              <p className="whitespace-pre-wrap text-sm leading-6 text-gray-700">{event.opinion}</p>
            </article>
          ))}

          {finalEvent && (
            <article className="rounded-2xl bg-gray-900 p-4 text-white">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="font-bold">最终综合建议</h3>
                <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-gray-900">
                  {finalEvent.wellness_score ?? '--'}
                </span>
              </div>
              <p className="text-sm leading-6 text-white/85">{finalEvent.dinner_recommendation}</p>
              {finalEvent.debate_result && (
                <p className="mt-3 text-sm leading-6 text-white/70">{finalEvent.debate_result}</p>
              )}
            </article>
          )}

          {error && (
            <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              流式决策失败：{error}
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function PanelHeader({
  title,
  icon: Icon,
}: {
  title: string
  icon: LucideIcon
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-cream">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
    </div>
  )
}

function SuggestionEditor({
  record,
  onChange,
}: {
  record: SuggestionRecord
  onChange: (patch: Partial<SuggestionRecord>) => void
}) {
  return (
    <article>
      <label className="block text-xs font-semibold text-gray-500">手边食材</label>
      <input
        value={record.ingredients}
        onChange={(event) => onChange({ ingredients: event.target.value })}
        className="mt-1 w-full rounded-xl bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-morandi-yellow"
        placeholder="例如：鸡蛋、青菜、米饭"
      />
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="block text-xs font-semibold text-gray-500">
          情绪状态
          <select
            value={record.mood}
            onChange={(event) => onChange({ mood: event.target.value })}
            className="mt-1 w-full rounded-xl bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-morandi-yellow"
          >
            {moodOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-semibold text-gray-500">
          快速食材
          <select
            value=""
            onChange={(event) => {
              if (!event.target.value) return
              onChange({
                ingredients: [record.ingredients, event.target.value].filter(Boolean).join('、'),
              })
            }}
            className="mt-1 w-full rounded-xl bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-morandi-yellow"
          >
            <option value="">添加</option>
            {ingredientOptions.map((option) => (
              <option key={option}>{option}</option>
            ))}
          </select>
        </label>
      </div>
      <textarea
        value={record.note}
        onChange={(event) => onChange({ note: event.target.value })}
        rows={2}
        className="mt-3 w-full resize-none rounded-xl bg-white px-3 py-2 text-sm leading-5 outline-none focus:ring-2 focus:ring-morandi-yellow"
        placeholder="补充短期状态"
      />
    </article>
  )
}

function SuggestionRecordCard({ record }: { record: SuggestionRecord }) {
  return (
    <article className="rounded-2xl bg-cream p-4">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold">{record.ingredients || '未填写食材'}</h3>
          <p className="mt-1 text-xs text-gray-500">{record.mood}</p>
        </div>
        {record.createdAt && <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs text-gray-500">{record.createdAt}</span>}
      </div>
      <p className="text-sm leading-6 text-gray-600">{record.note || '未补充短期状态'}</p>
    </article>
  )
}

function MiniCalendar({ scores }: { scores: DietScoreRecord[] }) {
  const doneDays = new Set(scores.slice(0, 7).map((_, index) => index + 1))

  return (
    <div className="grid grid-cols-7 gap-1 text-center text-[10px]">
      {Array.from({ length: 14 }, (_, index) => index + 1).map((day) => (
        <span
          key={day}
          className={`flex h-6 items-center justify-center rounded-full ${
            doneDays.has(day) ? 'bg-morandi-yellow text-gray-900' : 'bg-white/10 text-white/70'
          }`}
        >
          {day}
        </span>
      ))}
    </div>
  )
}

function CalendarModal({
  scores,
  stateScore,
  onClose,
}: {
  scores: DietScoreRecord[]
  stateScore: number
  onClose: () => void
}) {
  const days = Array.from({ length: 30 }, (_, index) => index + 1)
  const doneDays = new Set(scores.slice(0, 7).map((_, index) => index + 1))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm">
      <section className="w-full max-w-xl rounded-[1.25rem] bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">饮食日历</h2>
            <p className="mt-1 text-sm text-gray-500">近 7 次平均分：{stateScore}</p>
          </div>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-cream">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mb-4 grid grid-cols-7 text-center text-xs text-gray-500">
          {['一', '二', '三', '四', '五', '六', '日'].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-3 text-center text-sm">
          {days.map((day) => (
            <div
              key={day}
              className={`mx-auto flex h-11 w-11 items-center justify-center rounded-full ${
                doneDays.has(day) ? 'bg-gray-900 text-morandi-yellow' : 'bg-cream text-gray-700'
              }`}
            >
              {day}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function ProfileEditor({
  userProfile,
  onClose,
  onSave,
}: {
  userProfile: UserProfile | null
  onClose: () => void
  onSave: (profile: UserProfile) => void
}) {
  const [draft, setDraft] = useState<UserProfile>(
    userProfile || {
      gender: '',
      age: '',
      height: '',
      weight: '',
      taste: [],
      allergies: [],
      conditions: [],
      fitnessGoal: '',
    }
  )

  const setList = (key: 'taste' | 'allergies' | 'conditions', value: string) => {
    setDraft((current) => ({
      ...current,
      [key]: value
        .split(/[、,，]/)
        .map((item) => item.trim())
        .filter(Boolean),
    }))
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/40 p-4 backdrop-blur-sm">
      <section className="w-full max-w-2xl rounded-[1.25rem] bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">编辑长期状态</h2>
            <p className="mt-1 text-sm text-gray-500">这些信息会作为长期画像进入后续建议。</p>
          </div>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-cream">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid gap-3 md:grid-cols-2">
          <ProfileInput label="性别" value={draft.gender} onChange={(gender) => setDraft({ ...draft, gender })} />
          <ProfileInput label="年龄" value={draft.age} onChange={(age) => setDraft({ ...draft, age })} />
          <ProfileInput label="身高 cm" value={draft.height} onChange={(height) => setDraft({ ...draft, height })} />
          <ProfileInput label="体重 kg" value={draft.weight} onChange={(weight) => setDraft({ ...draft, weight })} />
          <ProfileInput label="饮食目标" value={draft.fitnessGoal} onChange={(fitnessGoal) => setDraft({ ...draft, fitnessGoal })} />
          <ProfileInput label="口味偏好" value={draft.taste.join('、')} onChange={(value) => setList('taste', value)} />
          <ProfileInput label="过敏/忌口" value={draft.allergies.join('、')} onChange={(value) => setList('allergies', value)} />
          <ProfileInput label="长期状况" value={draft.conditions.join('、')} onChange={(value) => setList('conditions', value)} />
        </div>

        <button
          onClick={() => onSave(draft)}
          className="mt-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-gray-900 px-5 py-3 text-sm font-semibold text-white"
        >
          <Save className="h-4 w-4" />
          保存长期状态
        </button>
      </section>
    </div>
  )
}

function ProfileInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (value: string) => void
}) {
  return (
    <label className="block text-xs font-semibold text-gray-500">
      {label}
      <input
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-1 w-full rounded-2xl bg-cream px-4 py-3 text-sm text-gray-900 outline-none focus:ring-2 focus:ring-morandi-yellow"
      />
    </label>
  )
}
