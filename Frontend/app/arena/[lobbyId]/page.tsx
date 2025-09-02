"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { useWeb3 } from "@/components/Web3Provider"
import type { Quiz } from "@/types"
import {
  Users,
  Clock,
  Trophy,
  CheckCircle,
  XCircle,
  Zap,
  Shield,
  Target,
  Flame,
  Star,
  Crown,
  Sword,
  Heart,
  Brain,
  CloudLightning as Lightning,
} from "lucide-react"

interface LobbyData {
  id: string
  mode: string
  entryFee: string
  players: string[]
  maxPlayers: number
  isActive: boolean
  gameStarted: boolean
}

interface PlayerStats {
  address: string
  health: number
  streak: number
  powerUps: string[]
  score: number
  rank: number
}

export default function LobbyPage() {
  const params = useParams()
  const lobbyId = params.lobbyId as string
  const { signer, account, isConnected } = useWeb3()

  const [lobbyData, setLobbyData] = useState<LobbyData | null>(null)
  const [gameState, setGameState] = useState<"waiting" | "playing" | "finished">("waiting")
  const [countdown, setCountdown] = useState(10)
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [timeLeft, setTimeLeft] = useState(30)
  const [eliminatedPlayers, setEliminatedPlayers] = useState<string[]>([])
  const [winner, setWinner] = useState<string | null>(null)
  const [playerStats, setPlayerStats] = useState<PlayerStats[]>([])
  const [currentStreak, setCurrentStreak] = useState(0)
  const [powerUps, setPowerUps] = useState<string[]>([])
  const [battleMode, setBattleMode] = useState<"elimination" | "survival" | "blitz">("elimination")
  const [spectatorMode, setSpectatorMode] = useState(false)
  const [chatMessages, setChatMessages] = useState<Array<{ player: string; message: string; timestamp: number }>>([])

  useEffect(() => {
    const fetchLobbyData = async () => {
      try {
        console.log("[v0] Fetching lobby data for lobby:", lobbyId)

        const mockLobbyData: LobbyData = {
          id: lobbyId,
          mode: "⚔️ Battle Royale",
          entryFee: "5",
          players: [
            "0x742d35Cc6634C0532925a3b8D4C9db96590c4C87",
            account || "0x8ba1f109551bD432803012645Hac136c22C177ec",
            "0x2546BcD3c84621e976D8185a91A922aE77ECEc30",
            "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
          ],
          maxPlayers: 8,
          isActive: true,
          gameStarted: false,
        }

        setLobbyData(mockLobbyData)

        const initialStats: PlayerStats[] = mockLobbyData.players.map((player, index) => ({
          address: player,
          health: 100,
          streak: 0,
          powerUps: [],
          score: 0,
          rank: index + 1,
        }))
        setPlayerStats(initialStats)

        if (mockLobbyData.players.length >= 2) {
          console.log("[v0] Starting countdown with", mockLobbyData.players.length, "players")
          startCountdown()
        }
      } catch (error) {
        console.error("Error fetching lobby data:", error)
      }
    }

    fetchLobbyData()
  }, [lobbyId, account])

  const startCountdown = () => {
    console.log("[v0] Battle countdown initiated")
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          console.log("[v0] Countdown finished, starting game")
          startGame()
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const startGame = async () => {
    console.log("[v0] Starting battle game")
    setGameState("playing")

    try {
      const response = await fetch("/api/generate-quiz", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category: "Mixed", difficulty: "hard" }),
      })

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      const quizData: Quiz = await response.json()
      console.log("[v0] Quiz loaded with", quizData.questions.length, "questions")
      setQuiz(quizData)
      setTimeLeft(30)

      startQuestionTimer()
    } catch (error) {
      console.error("Error starting game:", error)
      const fallbackQuiz: Quiz = {
        id: "fallback",
        category: "Mixed",
        questions: [
          {
            id: "1",
            question: "What blockchain does QuizCraft AI run on?",
            options: ["Ethereum", "Conflux", "Polygon", "Binance Smart Chain"],
            correctAnswer: 1,
            timeLimit: 30,
          },
        ],
      }
      setQuiz(fallbackQuiz)
      setTimeLeft(30)
      startQuestionTimer()
    }
  }

  const startQuestionTimer = () => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(timer)
          handleAnswer(-1)
          return 0
        }
        return prev - 1
      })
    }, 1000)
  }

  const handleAnswer = (answerIndex: number) => {
    if (!quiz || selectedAnswer !== null) return

    setSelectedAnswer(answerIndex)
    const currentQuestion = quiz.questions[currentQuestionIndex]
    const isCorrect = answerIndex === currentQuestion.correctAnswer

    if (isCorrect) {
      setCurrentStreak((prev) => prev + 1)
      if (currentStreak > 0 && currentStreak % 3 === 0) {
        const newPowerUp = ["⚡ Speed Boost", "🛡️ Shield", "🎯 Double Points", "🔥 Fire Strike"][
          Math.floor(Math.random() * 4)
        ]
        setPowerUps((prev) => [...prev, newPowerUp])
      }
    } else {
      setCurrentStreak(0)
      if (account && !eliminatedPlayers.includes(account)) {
        setEliminatedPlayers([...eliminatedPlayers, account])
      }
    }

    setTimeout(() => {
      if (currentQuestionIndex < quiz.questions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1)
        setSelectedAnswer(null)
        setTimeLeft(30)
        startQuestionTimer()
      } else {
        finishGame()
      }
    }, 2000)
  }

  const finishGame = () => {
    setGameState("finished")

    const remainingPlayers = lobbyData?.players.filter((player) => !eliminatedPlayers.includes(player)) || []

    if (remainingPlayers.length > 0) {
      setWinner(remainingPlayers[0])
    }
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  if (!isConnected) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-purple-500/20 bg-slate-900/50 backdrop-blur-xl">
          <CardContent className="py-12 text-center">
            <Shield className="h-16 w-16 text-purple-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-white mb-2">Access Denied</h2>
            <p className="text-slate-400">Connect your wallet to enter the arena</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!lobbyData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-md w-full border-purple-500/20 bg-slate-900/50 backdrop-blur-xl">
          <CardContent className="py-12 text-center">
            <div className="relative">
              <div className="animate-spin rounded-full h-16 w-16 border-4 border-purple-500/20 border-t-purple-400 mx-auto mb-4"></div>
              <Lightning className="h-6 w-6 text-purple-400 absolute top-5 left-1/2 transform -translate-x-1/2" />
            </div>
            <p className="text-white font-medium">Entering the Arena...</p>
            <p className="text-slate-400 text-sm mt-1">Preparing battle systems</p>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (gameState === "waiting") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-8">
            <div className="relative inline-block">
              <h1 className="text-4xl md:text-6xl font-bold bg-gradient-to-r from-purple-400 via-pink-400 to-orange-400 bg-clip-text text-transparent mb-2">
                BATTLE ARENA
              </h1>
              <div className="absolute -top-2 -right-2">
                <Flame className="h-8 w-8 text-orange-400 animate-pulse" />
              </div>
            </div>
            <p className="text-slate-300 text-lg">Lobby #{lobbyId}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6">
            <Card className="border-purple-500/20 bg-slate-900/50 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-lg">
                    <Sword className="h-6 w-6" />
                  </div>
                  Battle Configuration
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                  <span className="text-slate-300">Game Mode:</span>
                  <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white border-0">
                    {lobbyData.mode}
                  </Badge>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                  <span className="text-slate-300">Entry Stake:</span>
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-yellow-400" />
                    <Badge variant="outline" className="border-yellow-400 text-yellow-400">
                      {lobbyData.entryFee} CFX
                    </Badge>
                  </div>
                </div>

                <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
                  <span className="text-slate-300">Prize Pool:</span>
                  <div className="flex items-center gap-2">
                    <Crown className="h-4 w-4 text-yellow-400" />
                    <span className="text-yellow-400 font-bold">
                      {(Number.parseFloat(lobbyData.entryFee) * lobbyData.players.length).toFixed(1)} CFX
                    </span>
                  </div>
                </div>

                <div className="p-3 bg-gradient-to-r from-purple-500/10 to-pink-500/10 rounded-lg border border-purple-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <Brain className="h-4 w-4 text-purple-400" />
                    <span className="text-purple-400 font-medium">Battle Rules</span>
                  </div>
                  <ul className="text-sm text-slate-300 space-y-1">
                    <li>• Wrong answers eliminate players</li>
                    <li>• Streak bonuses unlock power-ups</li>
                    <li>• Last player standing wins all</li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            <Card className="border-purple-500/20 bg-slate-900/50 backdrop-blur-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-white">
                  <div className="p-2 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg">
                    <Users className="h-6 w-6" />
                  </div>
                  Warriors ({lobbyData.players.length}/{lobbyData.maxPlayers})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {playerStats.map((player, index) => (
                    <div key={player.address} className="relative">
                      <div className="flex items-center justify-between p-4 bg-slate-800/50 rounded-lg border border-slate-700/50 hover:border-purple-500/30 transition-colors">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div
                              className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${
                                player.address === account
                                  ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white"
                                  : "bg-slate-700 text-slate-300"
                              }`}
                            >
                              {index + 1}
                            </div>
                            {player.address === account && (
                              <Crown className="h-4 w-4 text-yellow-400 absolute -top-1 -right-1" />
                            )}
                          </div>
                          <div>
                            <div className="font-medium text-white">
                              {player.address === account ? "You" : `Player ${index + 1}`}
                            </div>
                            <div className="text-xs text-slate-400">
                              {player.address.slice(0, 6)}...{player.address.slice(-4)}
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-1">
                            <Heart className="h-4 w-4 text-red-400" />
                            <span className="text-sm text-slate-300">{player.health}</span>
                          </div>
                          <Badge variant="outline" className="border-slate-600 text-slate-300">
                            Ready
                          </Badge>
                        </div>
                      </div>
                    </div>
                  ))}

                  {Array.from({ length: lobbyData.maxPlayers - lobbyData.players.length }).map((_, index) => (
                    <div
                      key={`empty-${index}`}
                      className="flex items-center justify-between p-4 bg-slate-800/20 rounded-lg border border-dashed border-slate-600"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-slate-700/50 flex items-center justify-center">
                          <Users className="h-4 w-4 text-slate-500" />
                        </div>
                        <span className="text-slate-500">Waiting for warrior...</span>
                      </div>
                      <div className="animate-pulse">
                        <div className="w-16 h-6 bg-slate-700/50 rounded"></div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="mt-8">
            <Card className="border-purple-500/20 bg-slate-900/50 backdrop-blur-xl">
              <CardContent className="py-8">
                {lobbyData.players.length >= 2 ? (
                  <div className="text-center">
                    <div className="relative mb-6">
                      <div className="text-8xl font-bold bg-gradient-to-r from-red-400 via-yellow-400 to-orange-400 bg-clip-text text-transparent animate-pulse">
                        {countdown}
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-32 h-32 border-4 border-orange-400/20 rounded-full animate-ping"></div>
                      </div>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">BATTLE COMMENCING</h2>
                    <p className="text-slate-400">Prepare for intellectual warfare...</p>

                    <div className="flex justify-center gap-4 mt-6">
                      <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-lg">
                        <Zap className="h-4 w-4 text-yellow-400" />
                        <span className="text-sm text-slate-300">Power-ups Active</span>
                      </div>
                      <div className="flex items-center gap-2 px-4 py-2 bg-slate-800/50 rounded-lg">
                        <Target className="h-4 w-4 text-red-400" />
                        <span className="text-sm text-slate-300">Elimination Mode</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="relative mb-6">
                      <Clock className="h-16 w-16 text-purple-400 mx-auto animate-bounce" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-20 h-20 border-2 border-purple-400/20 rounded-full animate-pulse"></div>
                      </div>
                    </div>
                    <h2 className="text-2xl font-bold text-white mb-2">Assembling Warriors</h2>
                    <p className="text-slate-400 mb-4">
                      Need {2 - lobbyData.players.length} more brave souls to start the battle
                    </p>

                    <div className="max-w-md mx-auto">
                      <Progress value={(lobbyData.players.length / 2) * 100} className="h-3 bg-slate-800" />
                      <p className="text-xs text-slate-500 mt-2">{lobbyData.players.length}/2 minimum players</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    )
  }

  if (gameState === "finished") {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 flex items-center justify-center p-4">
        <Card className="max-w-2xl w-full border-purple-500/20 bg-slate-900/50 backdrop-blur-xl">
          <CardHeader>
            <CardTitle className="text-center text-white text-2xl">⚔️ BATTLE CONCLUDED ⚔️</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-6">
            {winner === account ? (
              <div>
                <div className="relative mb-6">
                  <Trophy className="h-24 w-24 text-yellow-400 mx-auto animate-bounce" />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-32 h-32 border-4 border-yellow-400/20 rounded-full animate-ping"></div>
                  </div>
                </div>
                <h2 className="text-4xl font-bold bg-gradient-to-r from-yellow-400 to-orange-400 bg-clip-text text-transparent mb-4">
                  VICTORY ROYALE!
                </h2>
                <div className="p-6 bg-gradient-to-r from-yellow-500/10 to-orange-500/10 rounded-lg border border-yellow-500/20">
                  <p className="text-white text-lg mb-2">🏆 Champion's Reward</p>
                  <p className="text-2xl font-bold text-yellow-400">
                    {(Number.parseFloat(lobbyData.entryFee) * lobbyData.players.length).toFixed(2)} CFX
                  </p>
                  <p className="text-slate-400 text-sm mt-2">+ Exclusive Victory NFT</p>
                </div>
              </div>
            ) : (
              <div>
                <div className="text-6xl mb-4">💀</div>
                <h2 className="text-3xl font-bold text-red-400 mb-4">ELIMINATED</h2>
                <div className="p-4 bg-slate-800/50 rounded-lg">
                  <p className="text-slate-300 mb-2">Champion:</p>
                  <p className="text-yellow-400 font-bold">
                    {winner ? `${winner.slice(0, 6)}...${winner.slice(-4)}` : "Unknown Warrior"}
                  </p>
                </div>
              </div>
            )}

            <div className="flex gap-4 justify-center">
              <Button
                onClick={() => (window.location.href = "/arena")}
                size="lg"
                className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600"
              >
                <Sword className="h-4 w-4 mr-2" />
                Return to Arena
              </Button>
              <Button
                variant="outline"
                size="lg"
                className="border-slate-600 text-slate-300 hover:bg-slate-800 bg-transparent"
              >
                <Star className="h-4 w-4 mr-2" />
                View Stats
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!quiz) return null

  const currentQuestion = quiz.questions[currentQuestionIndex]
  const progress = ((currentQuestionIndex + 1) / quiz.questions.length) * 100

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <Card className="border-purple-500/20 bg-slate-900/50 backdrop-blur-xl">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    <Brain className="h-5 w-5 text-purple-400" />
                    <span className="text-white font-medium">
                      Question {currentQuestionIndex + 1}/{quiz.questions.length}
                    </span>
                  </div>
                  {currentStreak > 0 && (
                    <div className="flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-orange-500/20 to-red-500/20 rounded-full border border-orange-500/30">
                      <Flame className="h-4 w-4 text-orange-400" />
                      <span className="text-orange-400 font-bold">{currentStreak}x Streak</span>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 px-3 py-1 bg-slate-800/50 rounded-lg">
                    <Clock className="h-4 w-4 text-blue-400" />
                    <span className={`font-bold ${timeLeft <= 10 ? "text-red-400 animate-pulse" : "text-blue-400"}`}>
                      {timeLeft}s
                    </span>
                  </div>
                  <Badge className="bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0">
                    {lobbyData.players.length - eliminatedPlayers.length} alive
                  </Badge>
                </div>
              </div>

              <Progress value={progress} className="h-2 bg-slate-800" />

              {powerUps.length > 0 && (
                <div className="flex items-center gap-2 mt-3">
                  <span className="text-sm text-slate-400">Power-ups:</span>
                  {powerUps.map((powerUp, index) => (
                    <Badge key={index} variant="outline" className="border-yellow-400 text-yellow-400 text-xs">
                      {powerUp}
                    </Badge>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <Card className="border-purple-500/20 bg-slate-900/50 backdrop-blur-xl mb-6">
          <CardHeader>
            <CardTitle className="text-xl text-white leading-relaxed">{currentQuestion.question}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {currentQuestion.options.map((option, index) => {
                let buttonClass =
                  "w-full justify-start text-left h-auto py-4 px-6 border-slate-600 bg-slate-800/30 hover:bg-slate-700/50 text-white transition-all duration-200"
                let icon = null

                if (selectedAnswer !== null) {
                  if (index === currentQuestion.correctAnswer) {
                    buttonClass =
                      "w-full justify-start text-left h-auto py-4 px-6 bg-gradient-to-r from-green-500 to-emerald-500 text-white border-green-400"
                    icon = <CheckCircle className="h-5 w-5 text-white" />
                  } else if (index === selectedAnswer) {
                    buttonClass =
                      "w-full justify-start text-left h-auto py-4 px-6 bg-gradient-to-r from-red-500 to-red-600 text-white border-red-400"
                    icon = <XCircle className="h-5 w-5 text-white" />
                  } else {
                    buttonClass += " opacity-50"
                  }
                } else {
                  buttonClass += " hover:border-purple-400 hover:shadow-lg hover:shadow-purple-500/20"
                }

                return (
                  <Button
                    key={index}
                    className={buttonClass}
                    onClick={() => handleAnswer(index)}
                    disabled={selectedAnswer !== null}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-base">{option}</span>
                      {icon}
                    </div>
                  </Button>
                )
              })}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
