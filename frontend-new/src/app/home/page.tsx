'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import {
  Apple,
  Camera,
  CheckCircle2,
  ClipboardList,
  Edit3,
  Loader2,
  LogOut,
  Save,
  Sparkles,
  Upload,
  X,
  type LucideIcon,
} from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useAppStore, type User, type UserProfile } from '@/store/useAppStore'
import { API_BASE_URL, apiFetch, authHeaders, getAuthToken } from '@/lib/api'

const SCORE_BUCKETS = [20, 40, 60, 80, 100] as const

const resolveAssetUrl = (url: string) => {
  if (!url) return url
  if (url.startsWith('http') || url.startsWith('data:')) return url
  return `${API_BASE_URL}${url}`
}

const localDateKey = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const localTimestampKey = (date = new Date()) => {
  return `${localDateKey(date)}T${date.toTimeString().slice(0, 8)}`
}

const normalizeMealRecord = (record: MealRecord): MealRecord => ({
  ...record,
  images: record.images?.map(resolveAssetUrl),
})

const isMealRecord = (value: DietResult | MealRecord): value is MealRecord => {
  return typeof value === 'object' && value !== null && 'result' in value
}

const scoreToGreen = (score?: number | null) => {
  if (typeof score !== 'number') return '#ffffff'
  const ratio = Math.max(0, Math.min(100, score)) / 100
  const start = [255, 255, 255]
  const end = [21, 128, 61]
  const channel = (index: number) => Math.round(start[index] + (end[index] - start[index]) * ratio)
  return `rgb(${channel(0)}, ${channel(1)}, ${channel(2)})`
}

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
    summary_reason?: string
    recommended_menu?: {
      title: string
      servings: string
      estimated_time: string
      dishes: {
        name: string
        reason: string
        ingredients: string[]
        steps: string[]
        time: string
      }[]
    } | null
    prep_plan?: string[] | null
    nutrition_note?: string
    mindset_note?: string
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

type CalendarDaySummary = {
  date: string
  record_count: number
  suggestion_count: number
  avg_score?: number | null
}

type CalendarDayDetail = {
  date: string
  suggestions: SuggestionRecord[]
  records: MealRecord[]
}

type SuggestionRecord = {
  id: string
  ingredients: string
  mood: string
  note: string
  createdAt?: string
  decision?: DecisionResponse | null
  score?: number | null
  requestPayload?: CookingRequest | null
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
  summary_reason?: string
  recommended_menu?: {
    title: string
    servings: string
    estimated_time: string
    dishes: {
      name: string
      reason: string
      ingredients: string[]
      steps: string[]
      time: string
    }[]
  } | null
  prep_plan?: string[] | null
  nutrition_note?: string
  mindset_note?: string
}

const ingredientOptions = ['鸡蛋', '青菜', '米饭', '豆腐', '番茄', '牛奶', '燕麦', '鱼肉', '鸡胸肉', '土豆', '面条', '虾', '蘑菇']
const moodOptions = ['疲惫', '压力大', '想吃热乎的', '想吃清淡', '想吃重口', '没胃口', '想被安慰', '开心']
const goalOptions = ['一人晚餐', '两人两菜一汤', '三人便当', '快速早餐', '一人午餐', '加班宵夜']
const timeBudgetOptions = ['10分钟', '20分钟', '30分钟', '45分钟以上']
const toolOptions = ['炒锅', '电饭煲', '空气炸锅', '微波炉', '蒸锅']

type CookingRequest = {
  goal: string
  ingredients: string[]
  ingredientNote: string
  moodTags: string[]
  moodNote: string
  timeBudget: string
  craving: string
  constraints: string
  tools: string[]
}

const emptyCookingRequest: CookingRequest = {
  goal: '',
  ingredients: [],
  ingredientNote: '',
  moodTags: [],
  moodNote: '',
  timeBudget: '',
  craving: '',
  constraints: '',
  tools: [],
}
const defaultSuggestions: SuggestionRecord[] = []
const emptySuggestion: SuggestionRecord = {
  id: 'draft',
  ingredients: '',
  mood: '',
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
      agent_name: '老中医',
      role: 'constitution',
      opinion: '依老夫之见，当前疲惫状态宜食温热之物，推荐番茄豆腐蛋汤，性味平和，补中益气，适合养胃安神。',
      stance: '中医养生',
      round_num: 1,
    },
    {
      agent_name: '营养师',
      role: 'nutrition',
      opinion: '从营养角度，推荐番茄豆腐蛋汤搭配清炒青菜，蛋白质充足，膳食纤维丰富，热量约350千卡。',
      stance: '均衡摄入',
      round_num: 1,
    },
  ],
  round2_debate: [
    {
      agent_name: '自律分身',
      role: 'discipline',
      opinion: '这套菜单简单高效，30分钟内可完成，不需要复杂厨具，符合时间预算。',
      stance: '可执行',
      round_num: 2,
    },
    {
      agent_name: '情绪疗愈师',
      role: 'pleasure',
      opinion: '热乎的番茄豆腐蛋汤能带来情绪上的安慰，加上青菜的清新感，既满足又不放纵。',
      stance: '情绪关怀',
      round_num: 2,
    },
  ],
  final_decision: {
    debate_result: '优先选择一份清淡蛋白、一份熟蔬菜和适量主食，控制油盐，同时照顾当下情绪。',
    mindset_adjustment: '不用把这一餐当成考试，先完成一顿稳定的饭。',
    today_good: '有记录和主动决策，就是很好的自我观察。',
    today_bad: '避免因为情绪波动临时改成高糖高油组合。',
    dinner_recommendation: '30分钟两菜一汤：番茄豆腐蛋汤、清炒青菜',
    action_index: 7,
    avatar_state: 'stable',
    summary_reason: '当前疲惫状态需要温热易消化的食物，番茄豆腐蛋汤补蛋白且暖胃，搭配青菜营养均衡。',
    recommended_menu: {
      title: '30分钟两菜一汤',
      servings: '2人',
      estimated_time: '30分钟',
      dishes: [
        {
          name: '番茄豆腐蛋汤',
          reason: '热乎、补蛋白、符合疲惫状态',
          ingredients: ['番茄', '豆腐', '鸡蛋', '葱'],
          steps: ['番茄切块，豆腐切小块，鸡蛋打散', '锅中少油炒番茄出汁', '加水煮开后放豆腐', '淋入蛋液，调盐，撒葱花'],
          time: '12分钟',
        },
        {
          name: '清炒青菜',
          reason: '补充膳食纤维，简单快炒',
          ingredients: ['青菜', '蒜', '盐'],
          steps: ['青菜洗净，蒜切末', '热锅少油爆香蒜末', '大火快炒青菜至断生', '调盐出锅'],
          time: '8分钟',
        },
      ],
    },
    prep_plan: ['先煮汤底', '汤煮开时处理青菜', '最后快炒青菜'],
    nutrition_note: '蛋白质和蔬菜足够，主食按饥饿程度补半碗米饭',
    mindset_note: '疲惫时先吃热乎稳定的一餐，不追求复杂',
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
  const [calendarDays, setCalendarDays] = useState<CalendarDaySummary[]>([])
  const [suggestions, setSuggestions] = useState<SuggestionRecord[]>(defaultSuggestions)
  const [draftSuggestion, setDraftSuggestion] = useState<SuggestionRecord>(emptySuggestion)
  const [draftCookingRequest, setDraftCookingRequest] = useState<CookingRequest>(emptyCookingRequest)
  const [mealRecords, setMealRecords] = useState<MealRecord[]>(defaultMeals)
  const [isDeciding, setIsDeciding] = useState(false)
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [notice, setNotice] = useState('')
  const [showProfileEditor, setShowProfileEditor] = useState(false)
  const [showAgentDialog, setShowAgentDialog] = useState(false)
  const [agentEvents, setAgentEvents] = useState<AgentStreamEvent[]>([])
  const [streamFinal, setStreamFinal] = useState<AgentStreamEvent | null>(null)
  const [streamError, setStreamError] = useState('')
  const [selectedMealRecord, setSelectedMealRecord] = useState<MealRecord | null>(null)
  const [selectedSuggestion, setSelectedSuggestion] = useState<SuggestionRecord | null>(null)
  const [calendarDayDetail, setCalendarDayDetail] = useState<CalendarDayDetail | null>(null)

  useEffect(() => {
    const token = getAuthToken()
    const savedUser = localStorage.getItem('healsync_user')
    const savedProfile = localStorage.getItem('healsync_profile')
    const savedHistory = localStorage.getItem('healsync_history')

    if (!token || !savedUser) {
      router.push('/')
      return
    }

    setUser(JSON.parse(savedUser) as User)
    if (savedProfile) setUserProfile(JSON.parse(savedProfile) as UserProfile)
    if (savedHistory) setHistory(JSON.parse(savedHistory) as HistoryRecord[])

    apiFetch<{
      suggestions: SuggestionRecord[]
      records: MealRecord[]
      calendar: { days: CalendarDaySummary[] }
    }>(`/workbench?date=${localDateKey()}`)
      .then((data) => {
        setSuggestions(data.suggestions)
        setMealRecords(data.records.map(normalizeMealRecord))
        setCalendarDays(data.calendar.days)
        setDietScores(
          data.calendar.days
            .filter((day) => typeof day.avg_score === 'number')
            .map((day) => ({ score: day.avg_score || 0, createdAt: day.date })),
        )
      })
      .catch((error) => {
        setNotice(error instanceof Error ? `加载数据库记录失败：${error.message}` : '加载数据库记录失败')
      })
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
  }

  const refreshCalendar = async () => {
    const data = await apiFetch<{ days: CalendarDaySummary[] }>('/calendar/summary')
    setCalendarDays(data.days)
    setDietScores(
      data.days
        .filter((day) => typeof day.avg_score === 'number')
        .map((day) => ({ score: day.avg_score || 0, createdAt: day.date })),
    )
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

  const runDecisionStream = async (records = suggestions, overrideUserInput?: string, cookingRequest?: CookingRequest) => {
    const currentContext = overrideUserInput || records
      .map((item, index) => `${index + 1}. 食材：${item.ingredients || '未填写'}；情绪：${item.mood}；备注：${item.note}`)
      .join('\n')
    const requestBody = {
      user_input: currentContext,
      quick_tabs: records.map((item) => item.mood),
      context: {
        profile: userProfile,
        profile_prompt: getUserProfilePrompt(),
        short_term_state: cookingRequest ? {
          goal: cookingRequest.goal,
          ingredients: cookingRequest.ingredients,
          ingredientNote: cookingRequest.ingredientNote,
          moodTags: cookingRequest.moodTags,
          moodNote: cookingRequest.moodNote,
          timeBudget: cookingRequest.timeBudget,
          craving: cookingRequest.craving,
          constraints: cookingRequest.constraints,
          tools: cookingRequest.tools,
        } : records,
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
              summary_reason: event.summary_reason,
              recommended_menu: event.recommended_menu || null,
              prep_plan: event.prep_plan || null,
              nutrition_note: event.nutrition_note,
              mindset_note: event.mindset_note,
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
    const cr = draftCookingRequest
    const ingredientsText = cr.ingredients.join('、')
    const moodText = cr.moodTags.join('、')
    const noteText = [cr.ingredientNote, cr.moodNote, cr.craving, cr.constraints].filter(Boolean).join('；')

    const record: SuggestionRecord = {
      ...draftSuggestion,
      id: crypto.randomUUID(),
      createdAt: localTimestampKey(),
      ingredients: ingredientsText,
      mood: moodText,
      note: noteText,
      requestPayload: { ...cr },
    }

    const next = [record, ...suggestions]
    setSuggestions(next)
    setDraftSuggestion(emptySuggestion)
    setDraftCookingRequest(emptyCookingRequest)

    apiFetch<SuggestionRecord>('/diet/suggestions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(record),
    })
      .then((saved) => {
        setSuggestions((current) => current.map((item) => (item.id === record.id ? saved : item)))
        void refreshCalendar().catch(() => undefined)
      })
      .catch((error) => {
        setNotice(error instanceof Error ? `饮食建议保存失败：${error.message}` : '饮食建议保存失败')
      })

    const user_input = [
      `做饭目标：${cr.goal}`,
      `现有食材：${ingredientsText}${cr.ingredientNote ? `（${cr.ingredientNote}）` : ''}`,
      moodText ? `心情：${moodText}${cr.moodNote ? `（${cr.moodNote}）` : ''}` : '',
      cr.timeBudget ? `时间预算：${cr.timeBudget}` : '',
      cr.craving ? `特别想吃：${cr.craving}` : '',
      cr.constraints ? `限制：${cr.constraints}` : '',
      cr.tools.length > 0 ? `厨具：${cr.tools.join('、')}` : '',
    ].filter(Boolean).join('\n')

    void runDecisionStream(next, user_input, cr)
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
        headers: authHeaders(),
        body,
      })

      if (!response.ok) {
        const errorBody = await response.json().catch(() => null)
        throw new Error(errorBody?.detail || `HTTP ${response.status}`)
      }
      const result = (await response.json()) as DietResult | MealRecord
      const record = normalizeMealRecord(
        isMealRecord(result)
          ? result
          : {
              id: crypto.randomUUID(),
              title: `照片分析 ${new Date().toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}`,
              score: result.score,
              note: result.food_identification.join('、') || result.analysis.nutrition || '已完成饮食分析',
              createdAt: result.timestamp,
              images: imageUrls,
              result,
            },
      )
      setDietResult(record.result || (isMealRecord(result) ? null : result))
      persistDietScore(record.score || 0)
      const nextMeals = [
        record,
        ...mealRecords,
      ]
      setMealRecords(nextMeals)
      setSelectedMealRecord(record)
      void refreshCalendar().catch(() => undefined)
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
    void apiFetch('/auth/logout', { method: 'POST' }).catch(() => undefined)
    localStorage.removeItem('healsync_auth_token')
    localStorage.removeItem('healsync_user')
    localStorage.removeItem('healsync_profile')
    localStorage.removeItem('user_profile_prompt')
    logout()
    router.push('/')
  }

  const openCalendarDate = async (date: string) => {
    try {
      const data = await apiFetch<{
        date: string
        suggestions: SuggestionRecord[]
        records: MealRecord[]
        calendar: { days: CalendarDaySummary[] }
      }>(`/workbench?date=${date}`)
      setCalendarDayDetail({
        date,
        suggestions: data.suggestions,
        records: data.records.map(normalizeMealRecord),
      })
      setCalendarDays(data.calendar.days)
    } catch (error) {
      setNotice(error instanceof Error ? `加载当日详情失败：${error.message}` : '加载当日详情失败')
    }
  }

  return (
    <main className="min-h-screen bg-cream px-3 py-4 text-gray-900 md:px-6 lg:h-screen lg:overflow-hidden lg:px-8">
      <div className="mx-auto grid max-w-[1680px] gap-5 rounded-[1.5rem] bg-white/45 p-4 shadow-[0_24px_80px_rgba(77,67,54,0.12)] backdrop-blur-xl lg:h-[calc(100vh-2rem)] lg:grid-cols-[260px_minmax(520px,1.35fr)_400px] lg:overflow-hidden xl:grid-cols-[290px_minmax(620px,1.45fr)_430px]">
        <WorkbenchSidebar
          user={user}
          profileSummary={profileSummary}
          userProfile={userProfile}
          scores={dietScores}
          days={calendarDays}
          stateScore={averageDietScore}
          onEditProfile={() => setShowProfileEditor(true)}
          onSelectDate={(date) => void openCalendarDate(date)}
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
          draftCookingRequest={draftCookingRequest}
          updateDraftCookingRequest={(patch) => setDraftCookingRequest((current) => ({ ...current, ...patch }))}
          updateDraftSuggestion={(patch) => setDraftSuggestion((current) => ({ ...current, ...patch }))}
          submitSuggestionDecision={handleGenerateSuggestion}
          isDeciding={isDeciding}
          mealRecords={mealRecords}
          analyzeDiet={analyzeDiet}
          isAnalyzing={isAnalyzing}
          onOpenMealRecord={setSelectedMealRecord}
          onOpenSuggestion={setSelectedSuggestion}
        />
      </div>

      {showProfileEditor && (
        <ProfileEditor
          userProfile={userProfile}
          onClose={() => setShowProfileEditor(false)}
          onSave={(profile) => {
            setUserProfile(profile)
            localStorage.setItem('healsync_profile', JSON.stringify(profile))
            void apiFetch('/me/profile', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ profile }),
            }).catch((error) => {
              setNotice(error instanceof Error ? `长期状态保存失败：${error.message}` : '长期状态保存失败')
            })
            setShowProfileEditor(false)
          }}
        />
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

      {selectedSuggestion && (
        <SuggestionDetailModal record={selectedSuggestion} onClose={() => setSelectedSuggestion(null)} />
      )}

      {calendarDayDetail && (
        <CalendarDayDetailModal
          detail={calendarDayDetail}
          onClose={() => setCalendarDayDetail(null)}
          onOpenRecord={setSelectedMealRecord}
          onOpenSuggestion={setSelectedSuggestion}
        />
      )}
    </main>
  )
}

function WorkbenchSidebar({
  user,
  profileSummary,
  userProfile,
  scores,
  days,
  stateScore,
  onEditProfile,
  onSelectDate,
  onLogout,
}: {
  user: User | null
  profileSummary: string
  userProfile: UserProfile | null
  scores: DietScoreRecord[]
  days: CalendarDaySummary[]
  stateScore: number
  onEditProfile: () => void
  onSelectDate: (date: string) => void
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

      <div className="rounded-2xl bg-gray-900 p-4 text-white">
        <MiniCalendar scores={scores} days={days} onSelectDate={onSelectDate} />
        <p className="mt-3 text-xs text-white/70">近 7 次饮食平均分：{stateScore}</p>
      </div>

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
  draftCookingRequest,
  updateDraftSuggestion,
  updateDraftCookingRequest,
  submitSuggestionDecision,
  isDeciding,
  mealRecords,
  analyzeDiet,
  isAnalyzing,
  onOpenMealRecord,
  onOpenSuggestion,
}: {
  suggestions: SuggestionRecord[]
  draftSuggestion: SuggestionRecord
  draftCookingRequest: CookingRequest
  updateDraftSuggestion: (patch: Partial<SuggestionRecord>) => void
  updateDraftCookingRequest: (patch: Partial<CookingRequest>) => void
  submitSuggestionDecision: () => void
  isDeciding: boolean
  mealRecords: MealRecord[]
  analyzeDiet: (files: FileList | File[] | null, imageUrls?: string[]) => Promise<boolean>
  isAnalyzing: boolean
  onOpenMealRecord: (record: MealRecord) => void
  onOpenSuggestion: (record: SuggestionRecord) => void
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
            suggestions.map((record) => (
              <SuggestionRecordCard key={record.id} record={record} onClick={() => onOpenSuggestion?.(record)} />
            ))
          ) : (
            <p className="rounded-2xl bg-cream p-4 text-sm text-gray-500">当日饮食建议记录会按生成顺序排列在这里。</p>
          )}
        </div>
        <div className="mt-4 rounded-2xl bg-cream p-4">
          <CookingRequestForm request={draftCookingRequest} onChange={updateDraftCookingRequest} />
        </div>
        <motion.button
          whileTap={{ scale: 0.98 }}
          onClick={submitSuggestionDecision}
          disabled={isDeciding || !draftCookingRequest.goal || draftCookingRequest.ingredients.length === 0}
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-900/45 p-4 backdrop-blur-sm">
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
                <h3 className="font-bold">{finalEvent.recommended_menu?.title || '最终综合建议'}</h3>
                <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-gray-900">
                  {finalEvent.wellness_score ?? '--'}
                </span>
              </div>
              {finalEvent.summary_reason && (
                <p className="mb-2 text-sm leading-6 text-white/70">{finalEvent.summary_reason}</p>
              )}
              {finalEvent.recommended_menu?.dishes && finalEvent.recommended_menu.dishes.length > 0 ? (
                <div className="space-y-2">
                  {finalEvent.recommended_menu.dishes.map((dish, i) => (
                    <div key={i} className="rounded-xl bg-white/10 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold">{dish.name}</span>
                        <span className="text-xs text-white/60">{dish.time}</span>
                      </div>
                      <p className="mt-1 text-xs text-white/70">{dish.reason}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm leading-6 text-white/85">{finalEvent.dinner_recommendation}</p>
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

function CookingRequestForm({
  request,
  onChange,
}: {
  request: CookingRequest
  onChange: (patch: Partial<CookingRequest>) => void
}) {
  const toggleItem = (field: 'ingredients' | 'moodTags' | 'tools', item: string) => {
    const current = request[field]
    onChange({
      [field]: current.includes(item) ? current.filter((v) => v !== item) : [...current, item],
    })
  }

  return (
    <article className="space-y-3">
      <div>
        <label className="block text-xs font-semibold text-gray-500">
          做饭目标 <span className="text-red-400">*</span>
        </label>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {goalOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => onChange({ goal: request.goal === option ? '' : option })}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                request.goal === option
                  ? 'bg-gray-900 text-morandi-yellow'
                  : 'bg-white text-gray-600 hover:bg-white/80'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
        <input
          value={request.goal}
          onChange={(e) => onChange({ goal: e.target.value })}
          className="mt-2 w-full rounded-xl bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-morandi-yellow"
          placeholder="或自定义目标，如：两人两菜一汤"
        />
      </div>

      <div>
        <label className="block text-xs font-semibold text-gray-500">
          现有食材 <span className="text-red-400">*</span>
        </label>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {ingredientOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => toggleItem('ingredients', option)}
              className={`rounded-full px-2.5 py-1 text-xs font-medium transition ${
                request.ingredients.includes(option)
                  ? 'bg-morandi-yellow/40 text-gray-800'
                  : 'bg-white text-gray-600 hover:bg-white/80'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
        <input
          value={request.ingredientNote}
          onChange={(e) => onChange({ ingredientNote: e.target.value })}
          className="mt-2 w-full rounded-xl bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-morandi-yellow"
          placeholder="补充食材说明，如：还有半盒豆腐、一点葱"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500">心情</label>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {moodOptions.slice(0, 4).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => toggleItem('moodTags', option)}
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition ${
                  request.moodTags.includes(option)
                    ? 'bg-morandi-pink/30 text-gray-800'
                    : 'bg-white text-gray-600 hover:bg-white/80'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500">留给做饭的时间</label>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {timeBudgetOptions.map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => onChange({ timeBudget: request.timeBudget === option ? '' : option })}
                className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition ${
                  request.timeBudget === option
                    ? 'bg-gray-900 text-morandi-yellow'
                    : 'bg-white text-gray-600 hover:bg-white/80'
                }`}
              >
                {option}
              </button>
            ))}
          </div>
        </div>
      </div>

      <input
        value={request.craving}
        onChange={(e) => onChange({ craving: e.target.value })}
        className="w-full rounded-xl bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-morandi-yellow"
        placeholder="特别想吃的，如：番茄味、想吃面"
      />
      <input
        value={request.constraints}
        onChange={(e) => onChange({ constraints: e.target.value })}
        className="w-full rounded-xl bg-white px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-morandi-yellow"
        placeholder="饮食限制，如：不要辣、少油、不想洗太多锅"
      />

      <div>
        <label className="block text-xs font-semibold text-gray-500">厨具条件</label>
        <div className="mt-1 flex flex-wrap gap-1.5">
          {toolOptions.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => toggleItem('tools', option)}
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium transition ${
                request.tools.includes(option)
                  ? 'bg-morandi-green/25 text-gray-800'
                  : 'bg-white text-gray-600 hover:bg-white/80'
              }`}
            >
              {option}
            </button>
          ))}
        </div>
      </div>
    </article>
  )
}

function SuggestionRecordCard({ record, onClick }: { record: SuggestionRecord; onClick?: () => void }) {
  const menu = record.decision?.final_decision?.recommended_menu
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full rounded-2xl bg-cream p-4 text-left transition hover:bg-morandi-yellow/25"
    >
      <div className="mb-2 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-bold">{menu?.title || record.requestPayload?.goal || record.ingredients || '未填写食材'}</h3>
          <p className="mt-1 text-xs text-gray-500">{record.mood}{record.requestPayload?.timeBudget ? ` · ${record.requestPayload.timeBudget}` : ''}</p>
        </div>
        {record.createdAt && <span className="shrink-0 rounded-full bg-white px-3 py-1 text-xs text-gray-500">{record.createdAt}</span>}
      </div>
      <p className="text-sm leading-6 text-gray-600">{menu ? menu.dishes.map((d) => d.name).join('、') : record.note || '未补充短期状态'}</p>
    </button>
  )
}

function MiniCalendar({
  scores,
  days,
  onSelectDate,
}: {
  scores: DietScoreRecord[]
  days: CalendarDaySummary[]
  onSelectDate: (date: string) => void
}) {
  const summaryByDate = new Map(days.map((day) => [day.date, day]))
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth()
  const firstDay = new Date(year, month, 1)
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const leadingBlanks = (firstDay.getDay() + 6) % 7
  const weekdays = ['一', '二', '三', '四', '五', '六', '日']
  const cells = [
    ...Array.from({ length: leadingBlanks }, (_, index) => ({ key: `blank-${index}`, label: '', date: '' })),
    ...Array.from({ length: daysInMonth }, (_, index) => {
      const date = new Date(year, month, index + 1)
      const key = localDateKey(date)
      return { key, label: String(index + 1), date: key }
    }),
  ]

  return (
    <div>
      <div className="mb-2 grid grid-cols-7 text-center text-[10px] text-white/50">
        {weekdays.map((day) => (
          <span key={day}>{day}</span>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1 text-center text-[10px]">
        {cells.map((day) => {
          if (!day.date) return <span key={day.key} className="h-7" />
          const summary = summaryByDate.get(day.date)
          const hasRecord = Boolean(summary?.record_count)
          const hasSuggestionOnly = !hasRecord && Boolean(summary?.suggestion_count)
          const fill = hasRecord ? scoreToGreen(summary?.avg_score) : 'transparent'
          const textColor = hasRecord && (summary?.avg_score || 0) >= 68 ? '#ffffff' : undefined

          return (
            <button
              key={day.key}
              type="button"
              onClick={() => onSelectDate(day.date)}
              title={`${day.date} 饮食记录 ${summary?.record_count || 0} 条，建议 ${summary?.suggestion_count || 0} 条`}
              className={`mx-auto flex h-7 w-7 items-center justify-center rounded-full transition hover:ring-2 hover:ring-morandi-yellow ${
                hasSuggestionOnly ? 'border border-morandi-yellow text-white' : 'text-white/75'
              }`}
              style={{ backgroundColor: fill, color: textColor }}
            >
              {day.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function CalendarDayDetailModal({
  detail,
  onClose,
  onOpenRecord,
  onOpenSuggestion,
}: {
  detail: CalendarDayDetail
  onClose: () => void
  onOpenRecord: (record: MealRecord) => void
  onOpenSuggestion: (record: SuggestionRecord) => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/45 p-4 backdrop-blur-sm">
      <section className="flex max-h-[86vh] w-full max-w-5xl flex-col overflow-hidden rounded-[1.25rem] bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-cream px-5 py-4">
          <div>
            <h2 className="text-lg font-bold">{detail.date}</h2>
            <p className="mt-1 text-sm text-gray-500">当日饮食记录与饮食建议</p>
          </div>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-cream">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto p-5 md:grid-cols-2">
          <section>
            <h3 className="mb-3 text-sm font-bold">饮食记录</h3>
            <div className="space-y-3">
              {detail.records.length > 0 ? (
                detail.records.map((record) => (
                  <button
                    key={record.id}
                    type="button"
                    onClick={() => onOpenRecord(record)}
                    className="w-full rounded-2xl bg-cream p-4 text-left transition hover:bg-morandi-yellow/25"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-sm font-bold">{record.title}</span>
                      <span className="rounded-full bg-white px-3 py-1 text-sm font-semibold">{record.score ?? '--'}</span>
                    </div>
                    {record.images && record.images.length > 0 && (
                      <div className="mb-3 flex gap-2 overflow-hidden">
                        {record.images.slice(0, 3).map((image, index) => (
                          <img key={`${record.id}-${index}`} src={image} alt="" className="h-12 w-12 rounded-xl object-cover" />
                        ))}
                      </div>
                    )}
                    <p className="line-clamp-2 text-xs leading-5 text-gray-600">{record.note}</p>
                  </button>
                ))
              ) : (
                <p className="rounded-2xl bg-cream p-4 text-sm text-gray-500">这一天还没有饮食记录。</p>
              )}
            </div>
          </section>

          <section>
            <h3 className="mb-3 text-sm font-bold">饮食建议</h3>
            <div className="space-y-3">
              {detail.suggestions.length > 0 ? (
                detail.suggestions.map((record) => (
                  <button
                    key={record.id}
                    type="button"
                    onClick={() => onOpenSuggestion(record)}
                    className="w-full rounded-2xl bg-cream p-4 text-left transition hover:bg-morandi-yellow/25"
                  >
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <span className="text-sm font-bold">{record.ingredients || '未填写食材'}</span>
                      <span className="rounded-full bg-white px-3 py-1 text-xs text-gray-500">{record.mood || '未填写'}</span>
                    </div>
                    <p className="line-clamp-2 text-xs leading-5 text-gray-600">{record.note || '未补充短期状态'}</p>
                  </button>
                ))
              ) : (
                <p className="rounded-2xl bg-cream p-4 text-sm text-gray-500">这一天还没有饮食建议。</p>
              )}
            </div>
          </section>
        </div>
      </section>
    </div>
  )
}

function SuggestionDetailModal({ record, onClose }: { record: SuggestionRecord; onClose: () => void }) {
  const menu = record.decision?.final_decision?.recommended_menu
  const dishes = menu?.dishes || []

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-gray-900/45 p-4 backdrop-blur-sm">
      <section className="max-h-[86vh] w-full max-w-3xl overflow-hidden rounded-[1.25rem] bg-white shadow-2xl">
        <div className="flex items-center justify-between gap-4 border-b border-cream px-5 py-4">
          <div>
            <h2 className="text-lg font-bold">{menu?.title || '饮食建议详情'}</h2>
            <p className="mt-1 text-sm text-gray-500">
              {record.createdAt || '建议记录'}
              {menu?.servings && ` · ${menu.servings}`}
              {menu?.estimated_time && ` · ${menu.estimated_time}`}
            </p>
          </div>
          <button onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-cream">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="space-y-3 overflow-y-auto p-5">
          {record.decision?.final_decision?.summary_reason && (
            <article className="rounded-2xl bg-cream p-4">
              <h3 className="text-sm font-bold">推荐理由</h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">{record.decision.final_decision.summary_reason}</p>
            </article>
          )}

          {dishes.length > 0 ? (
            <section>
              <h3 className="mb-3 text-sm font-bold">推荐菜单</h3>
              <div className="space-y-3">
                {dishes.map((dish, index) => (
                  <article key={index} className="rounded-2xl border border-cream bg-white p-4">
                    <div className="mb-2 flex items-center justify-between gap-3">
                      <h4 className="font-bold">{dish.name}</h4>
                      <span className="shrink-0 rounded-full bg-cream px-3 py-1 text-xs font-medium text-gray-600">{dish.time}</span>
                    </div>
                    <p className="mb-2 text-sm text-gray-600">{dish.reason}</p>
                    <div className="mb-2 flex flex-wrap gap-1.5">
                      {dish.ingredients.map((ing) => (
                        <span key={ing} className="rounded-full bg-morandi-yellow/25 px-2 py-0.5 text-xs text-gray-700">{ing}</span>
                      ))}
                    </div>
                    <ol className="space-y-1">
                      {dish.steps.map((step, si) => (
                        <li key={si} className="text-sm leading-5 text-gray-600">
                          <span className="mr-1.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gray-900 text-[10px] font-bold text-morandi-yellow">{si + 1}</span>
                          {step}
                        </li>
                      ))}
                    </ol>
                  </article>
                ))}
              </div>
            </section>
          ) : (
            <>
              <article className="rounded-2xl bg-cream p-4">
                <h3 className="text-sm font-bold">手边食材</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">{record.ingredients || '未填写'}</p>
              </article>
              <article className="rounded-2xl bg-cream p-4">
                <h3 className="text-sm font-bold">情绪状态</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">{record.mood || '未填写'}</p>
              </article>
              <article className="rounded-2xl bg-cream p-4">
                <h3 className="text-sm font-bold">补充说明</h3>
                <p className="mt-2 text-sm leading-6 text-gray-600">{record.note || '未补充短期状态'}</p>
              </article>
            </>
          )}

          {record.decision?.final_decision?.prep_plan && record.decision.final_decision.prep_plan.length > 0 && (
            <article className="rounded-2xl bg-cream p-4">
              <h3 className="text-sm font-bold">备菜顺序</h3>
              <ol className="mt-2 space-y-1">
                {record.decision.final_decision.prep_plan.map((step, index) => (
                  <li key={index} className="text-sm leading-6 text-gray-600">
                    <span className="mr-1.5 font-bold text-morandi-purple">{index + 1}.</span> {step}
                  </li>
                ))}
              </ol>
            </article>
          )}

          {record.decision?.final_decision?.nutrition_note && (
            <article className="rounded-2xl bg-cream p-4">
              <h3 className="text-sm font-bold">营养提示</h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">{record.decision.final_decision.nutrition_note}</p>
            </article>
          )}

          {record.decision?.final_decision?.mindset_note && (
            <article className="rounded-2xl bg-cream p-4">
              <h3 className="text-sm font-bold">心态提示</h3>
              <p className="mt-2 text-sm leading-6 text-gray-600">{record.decision.final_decision.mindset_note}</p>
            </article>
          )}

          {record.decision && !menu && (
            <article className="rounded-2xl bg-gray-900 p-4 text-white">
              <h3 className="text-sm font-bold">综合建议</h3>
              <p className="mt-2 text-sm leading-6 text-white/80">
                {record.decision.final_decision?.dinner_recommendation || record.decision.final_decision?.debate_result}
              </p>
            </article>
          )}
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
