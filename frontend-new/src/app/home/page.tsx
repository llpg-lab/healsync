'use client'

import { useEffect, useMemo, useState } from 'react'
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
  Plus,
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

  const addMealRecord = () => {
    const next = [
      ...mealRecords,
      { id: crypto.randomUUID(), title: `饮食记录 ${mealRecords.length + 1}`, note: '等待上传照片分析' },
    ]
    setMealRecords(next)
    localStorage.setItem('healsync_meal_records', JSON.stringify(next))
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
    void runDecision(next)
  }

  const analyzeDiet = async (files: FileList | null) => {
    if (!files?.length) return

    setIsAnalyzing(true)
    setNotice('')

    const body = new FormData()
    Array.from(files).forEach((file) => body.append('images', file))
    body.append('user_id', user?.username || 'default')

    try {
      const response = await fetch(`${API_BASE_URL}/diet/analyze`, {
        method: 'POST',
        body,
      })

      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const result = (await response.json()) as DietResult
      setDietResult(result)
      persistDietScore(result.score)
      const nextMeals = [
        {
          id: crypto.randomUUID(),
          title: `照片分析 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`,
          score: result.score,
          note: result.food_identification.join('、') || result.analysis.nutrition || '已完成饮食分析',
        },
        ...mealRecords,
      ]
      setMealRecords(nextMeals)
      localStorage.setItem('healsync_meal_records', JSON.stringify(nextMeals))
    } catch {
      const fallbackResult = {
        food_identification: Array.from(files).map((file) => file.name),
        analysis: {
          tcm: '饮食整体偏温和，建议继续观察饱腹感和餐后精神状态。',
          nutrition: '这餐可作为参考记录，建议保证蛋白质、蔬菜和主食搭配。',
          psychology: '记录饮食本身就是一次稳定的自我观察动作。',
        },
        score: 72,
        timestamp: new Date().toISOString(),
      }
      setDietResult(fallbackResult)
      persistDietScore(fallbackResult.score)
      const nextMeals = [
        {
          id: crypto.randomUUID(),
          title: '本地备用分析',
          score: fallbackResult.score,
          note: fallbackResult.food_identification.join('、') || fallbackResult.analysis.nutrition,
        },
        ...mealRecords,
      ]
      setMealRecords(nextMeals)
      localStorage.setItem('healsync_meal_records', JSON.stringify(nextMeals))
      setNotice('后端饮食分析接口暂时不可用，已展示本地备用结果。')
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
          addMealRecord={addMealRecord}
          analyzeDiet={analyzeDiet}
          isAnalyzing={isAnalyzing}
          dietResult={dietResult}
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
  addMealRecord,
  analyzeDiet,
  isAnalyzing,
  dietResult,
}: {
  suggestions: SuggestionRecord[]
  draftSuggestion: SuggestionRecord
  updateDraftSuggestion: (patch: Partial<SuggestionRecord>) => void
  submitSuggestionDecision: () => void
  isDeciding: boolean
  mealRecords: MealRecord[]
  addMealRecord: () => void
  analyzeDiet: (files: FileList | null) => void
  isAnalyzing: boolean
  dietResult: DietResult | null
}) {
  const [activeTab, setActiveTab] = useState<'suggestions' | 'records'>('suggestions')

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
        {activeTab === 'records' && (
          <button
            onClick={addMealRecord}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-900 text-morandi-yellow transition hover:bg-gray-800"
            aria-label="新增饮食记录"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
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
        <PanelHeader title="饮食记录" icon={Camera} onAdd={addMealRecord} />
        <label className="mb-4 flex min-h-28 cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-morandi-yellow bg-cream/70 p-4 text-center transition hover:bg-cream">
          {isAnalyzing ? <Loader2 className="mb-2 h-6 w-6 animate-spin" /> : <Upload className="mb-2 h-6 w-6" />}
          <span className="text-sm font-semibold">上传饮食照片分析打分</span>
          <span className="mt-1 text-xs text-gray-500"></span>
          <input
            type="file"
            multiple
            accept="image/*"
            className="hidden"
            onChange={(event) => analyzeDiet(event.target.files)}
          />
        </label>
        <div className="space-y-3">
          {mealRecords.map((record) => (
            <article key={record.id} className="rounded-2xl bg-cream p-4">
              <div className="mb-2 flex items-center justify-between gap-3">
                <h3 className="text-sm font-bold">{record.title}</h3>
                <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold">
                  {record.score ?? '--'}
                </span>
              </div>
              <p className="line-clamp-2 text-xs leading-5 text-gray-600">{record.note}</p>
            </article>
          ))}
        </div>
        {dietResult && (
          <p className="mt-4 rounded-2xl bg-gray-900 px-4 py-3 text-sm text-white">
            最新分析：{dietResult.score} 分 · {dietResult.analysis.nutrition || '已完成饮食分析'}
          </p>
        )}
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

function PanelHeader({
  title,
  icon: Icon,
  onAdd,
}: {
  title: string
  icon: LucideIcon
  onAdd?: () => void
}) {
  return (
    <div className="mb-4 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-cream">
          <Icon className="h-4 w-4" />
        </span>
        <h2 className="text-lg font-bold">{title}</h2>
      </div>
      {false && onAdd && (
        <button
          onClick={onAdd}
          className="flex h-9 w-9 items-center justify-center rounded-full bg-gray-900 text-morandi-yellow transition hover:bg-gray-800"
          aria-label={`新增${title}`}
        >
          <Plus className="h-4 w-4" />
        </button>
      )}
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
