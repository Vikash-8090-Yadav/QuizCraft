"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Progress } from "@/components/ui/progress"
import { Badge } from "@/components/ui/badge"
import { QUIZ_CATEGORIES } from "@/lib/constants"
import type { Quiz } from "@/types"
import { Gamepad2, Clock, CheckCircle, XCircle, Brain, Zap, Target, Star, Trophy } from "lucide-react"

export default function SoloPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>("")
  const [quiz, setQuiz] = useState<Quiz | null>(null)
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0)
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null)
  const [score, setScore] = useState(0)
  const [timeLeft, setTimeLeft] = useState(30)
  const [gameState, setGameState] = useState<"setup" | "playing" | "finished" | "loading">("setup")
  const [answers, setAnswers] = useState<number[]>([])
  const [streak, setStreak] = useState(0)

  const generateQuiz = async () => {
    if (!selectedCategory) return

    setGameState("loading")

    try {
      // Mock quiz generation with enhanced questions
      const mockQuiz: Quiz = {
        id: `quiz_${Date.now()}`,
        category: selectedCategory,
        questions: [
          {
            id: "1",
            question: "What is the primary consensus mechanism used by Conflux Network?",
            options: ["Proof of Work", "Tree-Graph", "Proof of Stake", "Delegated Proof of Stake"],
            correctAnswer: 1,
            timeLimit: 30,
          },
          {
            id: "2",
            question: "Which programming language is primarily used for Ethereum smart contracts?",
            options: ["JavaScript", "Python", "Solidity", "Rust"],
            correctAnswer: 2,
            timeLimit: 30,
          },
          {
            id: "3",
            question: "What does 'DeFi' stand for in blockchain terminology?",
            options: ["Digital Finance", "Decentralized Finance", "Distributed Finance", "Direct Finance"],
            correctAnswer: 1,
            timeLimit: 30,
          },
          {
            id: "4",
            question: "Which layer 2 scaling solution uses optimistic rollups?",
            options: ["Polygon", "Arbitrum", "Loopring", "StarkNet"],
            correctAnswer: 1,
            timeLimit: 30,
          },
          {
            id: "5",
            question: "What is the maximum supply of Bitcoin?",
            options: ["18 million", "19 million", "21 million", "25 million"],
            correctAnswer: 2,
            timeLimit: 30,
          },
        ],
      }

      setQuiz(mockQuiz)
      setCurrentQuestionIndex(0)
      setScore(0)
      setAnswers([])
      setStreak(0)
      setTimeLeft(30)
      setGameState("playing")

      // Start timer
      const timer = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            clearInterval(timer)
            handleAnswer(-1) // Auto-submit wrong answer
            return 0
          }
          return prev - 1
        })
      }, 1000)
    } catch (error) {
      console.error("Error generating quiz:", error)
      setGameState("setup")
    }
  }

  const handleAnswer = (answerIndex: number) => {
    if (!quiz || selectedAnswer !== null) return

    setSelectedAnswer(answerIndex)
    const currentQuestion = quiz.questions[currentQuestionIndex]
    const isCorrect = answerIndex === currentQuestion.correctAnswer

    if (isCorrect) {
      const points = 100 + streak * 10 // Bonus points for streaks
      setScore(score + points)
      setStreak(streak + 1)
    } else {
      setStreak(0)
    }

    setAnswers([...answers, answerIndex])

    // Move to next question after delay
    setTimeout(() => {
      if (currentQuestionIndex < quiz.questions.length - 1) {
        setCurrentQuestionIndex(currentQuestionIndex + 1)
        setSelectedAnswer(null)
        setTimeLeft(30)
      } else {
        finishQuiz()
      }
    }, 1500)
  }

  const finishQuiz = async () => {
    setGameState("finished")

    // Submit score to leaderboard
    try {
      await fetch("/api/submit-score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          score: score + (selectedAnswer === quiz?.questions[currentQuestionIndex]?.correctAnswer ? 100 : 0),
          category: selectedCategory,
        }),
      })
    } catch (error) {
      console.error("Error submitting score:", error)
    }
  }

  const resetGame = () => {
    setQuiz(null)
    setCurrentQuestionIndex(0)
    setSelectedAnswer(null)
    setScore(0)
    setTimeLeft(30)
    setGameState("setup")
    setAnswers([])
    setStreak(0)
  }

  if (gameState === "setup") {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-gradient-to-br from-accent to-secondary rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse-glow">
              <Brain className="h-10 w-10 text-white" />
            </div>
            <h1 className="font-montserrat font-bold text-4xl md:text-5xl mb-4">
              Solo <span className="text-accent">Training</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              Sharpen your knowledge with AI-generated quizzes and climb the leaderboard
            </p>
          </div>

          <Card className="relative overflow-hidden group hover:shadow-2xl transition-all duration-500 border-2 hover:border-accent/50">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

            <CardHeader className="relative">
              <CardTitle className="flex items-center gap-3 text-2xl">
                <Gamepad2 className="h-6 w-6 text-accent" />
                Choose Your Challenge
              </CardTitle>
            </CardHeader>

            <CardContent className="relative space-y-8">
              <div>
                <label className="text-sm font-semibold mb-3 block flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  Select Quiz Category
                </label>
                <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                  <SelectTrigger className="h-12 text-lg">
                    <SelectValue placeholder="Choose your expertise area" />
                  </SelectTrigger>
                  <SelectContent>
                    {QUIZ_CATEGORIES.map((category) => (
                      <SelectItem key={category} value={category} className="text-lg py-3">
                        {category}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <Zap className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                  <div className="font-semibold">5 Questions</div>
                  <div className="text-sm text-muted-foreground">Quick Challenge</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <Clock className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                  <div className="font-semibold">30s Each</div>
                  <div className="text-sm text-muted-foreground">Time Limit</div>
                </div>
                <div className="text-center p-4 bg-muted/50 rounded-lg">
                  <Star className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                  <div className="font-semibold">Streak Bonus</div>
                  <div className="text-sm text-muted-foreground">Extra Points</div>
                </div>
              </div>

              <Button
                onClick={generateQuiz}
                disabled={!selectedCategory}
                className="w-full h-14 text-lg font-semibold shadow-lg hover:shadow-accent/25 transition-all duration-300 animate-pulse-glow"
                size="lg"
              >
                <Brain className="mr-3 h-6 w-6" />
                Start Quiz Challenge
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (gameState === "loading") {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-2xl mx-auto text-center">
          <Card className="border-2 border-accent/20">
            <CardContent className="py-16">
              <div className="w-16 h-16 bg-gradient-to-br from-accent to-secondary rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse-glow">
                <Brain className="h-8 w-8 text-white animate-pulse" />
              </div>
              <h2 className="text-2xl font-bold mb-4">AI Crafting Your Quiz...</h2>
              <p className="text-muted-foreground mb-6">
                Our advanced AI is generating personalized questions for {selectedCategory}
              </p>
              <div className="w-full bg-muted rounded-full h-2">
                <div
                  className="bg-gradient-to-r from-accent to-secondary h-2 rounded-full animate-gradient"
                  style={{ width: "60%" }}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (gameState === "finished") {
    const finalScore =
      score + (answers[answers.length - 1] === quiz?.questions[quiz.questions.length - 1]?.correctAnswer ? 100 : 0)
    const correctAnswers = answers.filter((answer, index) => answer === quiz?.questions[index]?.correctAnswer).length
    const accuracy = Math.round((correctAnswers / (quiz?.questions.length || 1)) * 100)

    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <Card className="relative overflow-hidden border-2 border-accent/20">
            <div className="absolute inset-0 bg-gradient-to-br from-accent/10 via-transparent to-secondary/10" />

            <CardHeader className="relative text-center pb-4">
              <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse-glow">
                <Trophy className="h-10 w-10 text-white" />
              </div>
              <CardTitle className="text-3xl font-montserrat font-bold">Quiz Complete!</CardTitle>
            </CardHeader>

            <CardContent className="relative text-center space-y-8">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="p-6 bg-card rounded-xl border">
                  <div className="text-4xl font-bold text-accent mb-2">{finalScore}</div>
                  <p className="text-muted-foreground font-medium">Final Score</p>
                </div>
                <div className="p-6 bg-card rounded-xl border">
                  <div className="text-4xl font-bold text-green-500 mb-2">{accuracy}%</div>
                  <p className="text-muted-foreground font-medium">Accuracy</p>
                </div>
                <div className="p-6 bg-card rounded-xl border">
                  <div className="text-4xl font-bold text-purple-500 mb-2">
                    {correctAnswers}/{quiz?.questions.length}
                  </div>
                  <p className="text-muted-foreground font-medium">Correct</p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 justify-center">
                {accuracy === 100 && (
                  <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500">Perfect Score!</Badge>
                )}
                {accuracy >= 80 && <Badge className="bg-gradient-to-r from-green-400 to-emerald-500">Excellent!</Badge>}
                {streak >= 3 && <Badge className="bg-gradient-to-r from-purple-400 to-pink-500">Streak Master</Badge>}
                {finalScore > 500 && <Badge className="bg-gradient-to-r from-blue-400 to-cyan-500">High Scorer</Badge>}
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <Button
                  onClick={resetGame}
                  size="lg"
                  className="font-semibold shadow-lg hover:shadow-accent/25 transition-all duration-300"
                >
                  <Gamepad2 className="mr-2 h-5 w-5" />
                  Play Again
                </Button>
                <Button
                  variant="outline"
                  size="lg"
                  className="font-semibold bg-transparent"
                  onClick={() => (window.location.href = "/arena")}
                >
                  <Trophy className="mr-2 h-5 w-5" />
                  Try Arena Mode
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!quiz) return null

  const currentQuestion = quiz.questions[currentQuestionIndex]
  const progress = ((currentQuestionIndex + 1) / quiz.questions.length) * 100

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-3xl mx-auto">
        <Card className="relative overflow-hidden border-2 border-accent/20">
          <div className="absolute inset-0 bg-gradient-to-br from-accent/5 to-transparent" />

          <CardHeader className="relative">
            <div className="flex justify-between items-center mb-6">
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="text-sm px-3 py-1">
                  Question {currentQuestionIndex + 1} of {quiz.questions.length}
                </Badge>
                {streak > 0 && (
                  <Badge className="bg-gradient-to-r from-orange-400 to-red-500 text-sm px-3 py-1">
                    🔥 {streak} Streak
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-lg font-semibold">
                  <Clock className="h-5 w-5 text-accent" />
                  <span className={timeLeft <= 10 ? "text-red-500 animate-pulse" : "text-accent"}>{timeLeft}s</span>
                </div>
                <Badge variant="secondary" className="text-sm px-3 py-1">
                  Score: {score}
                </Badge>
              </div>
            </div>

            <Progress value={progress} className="mb-6 h-3" />

            <CardTitle className="text-xl md:text-2xl leading-relaxed font-semibold">
              {currentQuestion.question}
            </CardTitle>
          </CardHeader>

          <CardContent className="relative">
            <div className="space-y-4">
              {currentQuestion.options.map((option, index) => {
                let buttonVariant: "default" | "outline" | "destructive" | "secondary" = "outline"
                let icon = null
                let className =
                  "w-full justify-start text-left h-auto py-6 px-6 text-lg transition-all duration-300 hover:scale-[1.02]"

                if (selectedAnswer !== null) {
                  if (index === currentQuestion.correctAnswer) {
                    buttonVariant = "default"
                    className += " bg-green-500 hover:bg-green-600 border-green-500"
                    icon = <CheckCircle className="h-5 w-5 text-white" />
                  } else if (index === selectedAnswer) {
                    buttonVariant = "destructive"
                    icon = <XCircle className="h-5 w-5" />
                  }
                }

                return (
                  <Button
                    key={index}
                    variant={buttonVariant}
                    className={className}
                    onClick={() => handleAnswer(index)}
                    disabled={selectedAnswer !== null}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className="text-left">{option}</span>
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
