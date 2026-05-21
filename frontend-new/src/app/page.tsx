'use client'

import { motion } from 'framer-motion'
import { Sparkles, Heart, Brain } from 'lucide-react'
import { useRouter } from 'next/navigation'

export default function LandingPage() {
  const router = useRouter()

  const features = [
    { icon: Brain, title: '智能分析', desc: '多维健康判断' },
    { icon: Heart, title: '实时建议', desc: '动态调整策略' },
    { icon: Sparkles, title: '个性定制', desc: '专属饮食方案' },
  ]

  return (
    <main className="min-h-screen bg-cream relative overflow-hidden">
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{
          backgroundImage: 'url(/start.png)',
        }}
      >
        <div className="absolute inset-0 bg-gradient-to-br from-cream/90 via-cream/80 to-morandi-green/30" />
      </div>

      <div className="absolute top-20 left-20 w-64 h-64 bg-morandi-pink/20 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-morandi-blue/20 rounded-full blur-3xl" />
      <div className="absolute top-1/2 left-1/3 w-48 h-48 bg-morandi-yellow/20 rounded-full blur-3xl" />

      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4">
        <div className="flex flex-wrap justify-center gap-4 mb-12">
          {features.map((feature, index) => (
            <div
              key={feature.title}
              className="glass rounded-4xl px-6 py-4 flex items-center gap-3"
            >
              <feature.icon className="w-5 h-5 text-morandi-purple" />
              <div>
                <div className="font-medium text-gray-800">{feature.title}</div>
                <div className="text-sm text-gray-500">{feature.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-4">
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push('/login')}
            className="px-12 py-4 rounded-4xl bg-white/80 backdrop-blur-xl text-gray-800 font-semibold text-lg shadow-lg hover:shadow-xl transition-all border border-white/50"
          >
            登录
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.push('/register')}
            className="px-12 py-4 rounded-4xl bg-gradient-to-r from-morandi-pink to-morandi-purple text-white font-semibold text-lg shadow-lg hover:shadow-xl transition-all"
          >
            注册
          </motion.button>
        </div>
      </div>

      <div className="absolute bottom-8 left-0 right-0 text-center text-gray-400 text-sm">
        © 2024 HealSync
      </div>
    </main>
  )
}
