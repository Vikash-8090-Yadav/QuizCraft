"use client"

import { Card, CardContent } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { 
  Target, 
  Clock, 
  Trophy, 
  Users, 
  Zap,
  CheckCircle,
  Timer
} from "lucide-react"

interface QuizProgressProps {
  currentQuestion: number
  totalQuestions: number
  playerScore: number
  timeRemaining: number
  questionDuration: number
  playersFinished: number
  totalPlayers: number
  isLastQuestion?: boolean
}

export default function QuizProgress({
  currentQuestion,
  totalQuestions,
  playerScore,
  timeRemaining,
  questionDuration,
  playersFinished,
  totalPlayers,
  isLastQuestion = false
}: QuizProgressProps) {
  const progressPercentage = (currentQuestion / totalQuestions) * 100
  const timePercentage = (timeRemaining / questionDuration) * 100
  const isTimeRunningLow = timeRemaining <= 5

  return (
    <div className="sticky top-20 z-40 w-full mb-6 px-4 animate-in slide-in-from-top-4 duration-500">
      <Card className="border-0 shadow-2xl bg-gradient-to-r from-white via-blue-50/30 to-purple-50/30 backdrop-blur-xl hover:shadow-3xl transition-all duration-300">
        <CardContent className="p-4">
          {/* Horizontal Layout */}
          <div className="flex items-center justify-between gap-6">
            
            {/* Left: Question Progress */}
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Target className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <div className="text-sm font-medium text-gray-700">Question</div>
                  <div className="text-lg font-bold text-blue-600">
                    {currentQuestion}/{totalQuestions}
                  </div>
                </div>
              </div>
              
              <div className="w-24">
                <Progress 
                  value={progressPercentage} 
                  className="h-2 bg-gray-200"
                />
                <div className="text-xs text-center text-gray-600 mt-1">
                  {Math.round(progressPercentage)}%
                </div>
              </div>
            </div>

            {/* Center: Score & Time */}
            <div className="flex items-center gap-8">
              {/* Score */}
              <div className="text-center">
                <div className="flex items-center gap-1 mb-1">
                  <Trophy className="h-4 w-4 text-green-600" />
                  <span className="text-sm font-medium text-gray-700">Score</span>
                </div>
                <div className="text-2xl font-bold text-green-600">
                  {playerScore.toLocaleString()}
                </div>
              </div>

              {/* Time */}
              <div className="text-center">
                <div className="flex items-center gap-1 mb-1">
                  <Clock className={`h-4 w-4 ${isTimeRunningLow ? 'text-red-600' : 'text-orange-600'}`} />
                  <span className="text-sm font-medium text-gray-700">Time</span>
                </div>
                <div className={`text-2xl font-bold ${isTimeRunningLow ? 'text-red-600' : 'text-orange-600'}`}>
                  {timeRemaining}s
                </div>
                {isTimeRunningLow && (
                  <div className="text-xs text-red-600 font-medium animate-pulse">
                    ⚠️ Hurry!
                  </div>
                )}
              </div>
            </div>

            {/* Right: Lobby Status */}
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="flex items-center gap-1 mb-1">
                  <Users className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-gray-700">Players</span>
                </div>
                <div className="text-lg font-bold text-blue-600">
                  {playersFinished}/{totalPlayers}
                </div>
                <div className="text-xs text-gray-600">
                  {playersFinished === totalPlayers ? 'All done!' : 'playing'}
                </div>
              </div>

              {/* Final Question Badge */}
              {isLastQuestion && (
                <div className="px-3 py-1 bg-gradient-to-r from-yellow-400 to-orange-500 text-white rounded-full text-sm font-bold animate-pulse">
                  🎉 Final Q!
                </div>
              )}
            </div>

          </div>

          {/* Bottom: Time Progress Bar */}
          <div className="mt-4">
            <div className="relative">
              <Progress 
                value={timePercentage} 
                className={`h-1 ${isTimeRunningLow ? 'bg-red-200' : 'bg-orange-200'}`}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-xs font-bold text-white drop-shadow-lg">
                  {Math.round(timePercentage)}% time left
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}