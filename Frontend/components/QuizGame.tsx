'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Clock, Trophy, Users, Zap } from 'lucide-react';

interface QuizQuestion {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  explanation: string;
  category: string;
  difficulty: 'easy' | 'medium' | 'hard';
  timeLimit: number;
}

interface QuizGameProps {
  lobbyId: string;
  players: string[];
  category?: string;
  onGameEnd: (results: GameResult[]) => void;
  onScoreUpdate?: (scores: Record<string, number>) => void;
  startTimestampSec: number; // on-chain createdAt + countdown
  questionDurationSec: number; // per-question duration
  seed: string; // deterministic quiz seed
}

interface GameResult {
  player: string;
  score: number;
  correctAnswers: number;
  totalQuestions: number;
  timeBonus: number;
}

export default function QuizGame({ lobbyId, players, category, onGameEnd, onScoreUpdate, startTimestampSec, questionDurationSec, seed }: QuizGameProps) {
  const [gameState, setGameState] = useState<'waiting' | 'countdown' | 'playing' | 'finished'>('waiting');
  const [countdown, setCountdown] = useState(10);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [timeLeft, setTimeLeft] = useState(questionDurationSec);
  const [playerScores, setPlayerScores] = useState<Record<string, number>>({});
  const [showExplanation, setShowExplanation] = useState(false);
  const [gameResults, setGameResults] = useState<GameResult[]>([]);
  const [questionSource, setQuestionSource] = useState<'ai' | 'fallback' | null>(null);
  const [quizStartedAt, setQuizStartedAt] = useState<number | null>(null);
  const [quizEndedAt, setQuizEndedAt] = useState<number | null>(null);

  // Hydrate persisted scores
  useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`quizcraft:scores:${lobbyId}`)
      if (raw) setPlayerScores(JSON.parse(raw))
    } catch {}
  }, [lobbyId])

  // Persist scores
  useEffect(() => {
    try {
      sessionStorage.setItem(`quizcraft:scores:${lobbyId}`, JSON.stringify(playerScores))
    } catch {}
  }, [lobbyId, playerScores])

  // Initialize game phase based on startTimestampSec
  useEffect(() => {
    const tick = () => {
      const nowSec = Math.floor(Date.now() / 1000)
      if (questions.length === 0) {
        // lazily generate quiz once
        generateQuiz()
      }
      if (nowSec < startTimestampSec) {
        setGameState('countdown')
        setCountdown(Math.max(0, startTimestampSec - nowSec))
      } else if (questions.length > 0) {
        const elapsed = nowSec - startTimestampSec
        const qIndex = Math.floor(elapsed / questionDurationSec)
        if (qIndex >= questions.length) {
          if (gameState !== 'finished') endGame()
          return
        }
        setGameState('playing')
        setCurrentQuestion(qIndex)
        const rem = questionDurationSec - (elapsed % questionDurationSec)
        setTimeLeft(rem)
      }
    }
    const i = setInterval(tick, 1000)
    tick()
    return () => clearInterval(i)
  }, [startTimestampSec, questionDurationSec, questions.length])

  // Emit live score reset at game start
  useEffect(() => {
    if (gameState === 'playing' && onScoreUpdate) onScoreUpdate(playerScores)
  }, [gameState])

  // timeLeft derived by main tick; no separate timer needed

  const startGame = () => {
    setGameState('countdown');
    setQuizStartedAt(startTimestampSec * 1000);
  };

  const generateQuiz = async () => {
    try {
      let response = await fetch('/api/generate-quiz', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category: category || 'Technology',
          difficulty: 'medium',
          questionCount: 10,
          timePerQuestion: questionDurationSec,
          seed,
        })
      });
      if (!response.ok) {
        // brief retry once on 503 from AI
        response = await fetch('/api/generate-quiz', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            category: category || 'Technology',
            difficulty: 'medium',
            questionCount: 10,
            timePerQuestion: questionDurationSec,
            seed,
          })
        });
      }
      const data = await response.json();
      if (process.env.NODE_ENV !== 'production') {
        // Helpful debug in console
        // eslint-disable-next-line no-console
        console.log('Quiz generation debug:', data.debug);
      }
      if (data.success) {
        setQuestions(data.quiz.questions);
        setTimeLeft(data.quiz.timePerQuestion);
        const usedFallback = Boolean(data.debug?.fallbackUsed);
        setQuestionSource(usedFallback ? 'fallback' : 'ai');
      } else {
        // Fallback: minimal placeholder quiz so UI proceeds
        const placeholder = {
          id: 'placeholder',
          question: 'Placeholder question: Which letter comes first?',
          options: ['A', 'B', 'C', 'D'],
          correctAnswer: 0,
          timeLimit: 30,
        };
        setQuestions([placeholder]);
        setTimeLeft(placeholder.timeLimit);
        setQuestionSource('fallback');
        console.warn('Using placeholder quiz due to generation failure');
      }
    } catch (error) {
      console.error('Error generating quiz:', error);
      const placeholder = {
        id: 'placeholder',
        question: 'Placeholder question: Which letter comes first?',
        options: ['A', 'B', 'C', 'D'],
        correctAnswer: 0,
        timeLimit: questionDurationSec,
      };
      setQuestions([placeholder]);
      setTimeLeft(placeholder.timeLimit);
      setQuestionSource('fallback');
    }
  };

  const handleAnswerSelect = (answerIndex: number) => {
    if (selectedAnswer !== null) return; // Already answered
    
    setSelectedAnswer(answerIndex);
    setShowExplanation(true);
    
    // Calculate score
    const isCorrect = answerIndex === questions[currentQuestion].correctAnswer;
    const timeBonus = Math.floor(timeLeft / 5); // Bonus points for speed
    // Negative marking: -25 for wrong answers; score cannot go below 0 overall
    const base = isCorrect ? 100 : -25;
    const points = Math.max(0, base + (isCorrect ? timeBonus : 0));
    
    // Update scores (in real implementation, this would be sent to server)
    setPlayerScores(prev => {
      const next = { ...prev }
      const current = next[players[0]] || 0
      const newScore = Math.max(0, current + (isCorrect ? (100 + timeBonus) : -25))
      next[players[0]] = newScore
      if (onScoreUpdate) onScoreUpdate(next)
      return next
    });

    // Clear selection after a brief explanation window; advance handled by time-based tick
    setTimeout(() => {
      setSelectedAnswer(null);
      setShowExplanation(false);
    }, 2000);
  };

  const handleTimeUp = () => {
    // no-op; advancement handled by wall-clock
  };

  const endGame = async () => {
    setGameState('finished');
    setQuizEndedAt(Date.now());
    
    // Calculate final results
    const results: GameResult[] = players.map(player => ({
      player,
      score: playerScores[player] || 0,
      correctAnswers: Math.floor((playerScores[player] || 0) / 100),
      totalQuestions: questions.length,
      timeBonus: Math.floor((playerScores[player] || 0) % 100)
    }));
    
    setGameResults(results);
    onGameEnd(results);
    
    // Post score and time taken for the first player (demo)
    const totalMs = (Date.now() - (quizStartedAt || Date.now()));
    const timeTakenSeconds = Math.max(0, Math.round(totalMs / 1000));
    fetch('/api/submit-score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        score: results[0]?.score || 0,
        category: category || 'Technology',
        timeTakenSeconds,
      })
    }).catch(() => {});

    // Submit scores to smart contract for leaderboard
    try {
      const playerAddresses = results.map(r => r.player);
      const scores = results.map(r => r.score);
      
      const response = await fetch('/api/submit-scores', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_RESOLVE_GAME_API_KEY || 'default-secret'}`
        },
        body: JSON.stringify({
          lobbyId: lobbyId,
          players: playerAddresses,
          scores: scores
        })
      });

      if (response.ok) {
        console.log('Scores submitted to smart contract');
        
        // Set leaderboard (ranked by score)
        const sortedResults = results.sort((a, b) => b.score - a.score);
        const leaderboard = sortedResults.map(r => r.player);
        
        const leaderboardResponse = await fetch('/api/set-leaderboard', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${process.env.NEXT_PUBLIC_RESOLVE_GAME_API_KEY || 'default-secret'}`
          },
          body: JSON.stringify({
            lobbyId: lobbyId,
            leaderboard: leaderboard
          })
        });

        if (leaderboardResponse.ok) {
          console.log('Leaderboard set in smart contract');
        } else {
          console.error('Failed to set leaderboard');
        }
      } else {
        console.error('Failed to submit scores to smart contract');
      }
    } catch (error) {
      console.error('Error submitting scores to smart contract:', error);
    }
  };

  if (gameState === 'waiting') {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-8 text-center">
          <Users className="h-16 w-16 text-blue-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-4">Waiting for Players</h2>
          <p className="text-muted-foreground mb-4">
            {players.length} / 4 players joined
          </p>
          <div className="flex justify-center gap-2">
            {players.map((player, index) => (
              <Badge key={index} variant="outline">
                {player.slice(0, 6)}...{player.slice(-4)}
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (gameState === 'countdown') {
    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardContent className="p-8 text-center">
          <div className="text-6xl font-bold text-accent mb-4">{countdown}</div>
          <h2 className="text-2xl font-bold mb-4">Game Starting Soon!</h2>
          <p className="text-muted-foreground">Get ready for the quiz battle!</p>
        </CardContent>
      </Card>
    );
  }

  if (gameState === 'playing' && questions.length > 0) {
    const question = questions[currentQuestion];
    const progress = ((currentQuestion + 1) / questions.length) * 100;

    return (
      <div className="w-full max-w-4xl mx-auto space-y-6">
        {/* Progress Bar */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Question {currentQuestion + 1} of {questions.length}</span>
              <div className="flex items-center gap-2">
                {questionSource && (
                  <Badge variant={questionSource === 'ai' ? 'default' : 'outline'}>
                    Source: {questionSource === 'ai' ? 'AI' : 'Fallback'}
                  </Badge>
                )}
                <Clock className="h-4 w-4" />
                <span className="text-sm font-medium">{timeLeft}s</span>
              </div>
            </div>
            <Progress value={progress} className="h-2" />
          </CardContent>
        </Card>

        {/* Question Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <Badge variant="outline">{question.category}</Badge>
              <Badge variant="secondary">{question.difficulty}</Badge>
            </div>
            <CardTitle className="text-xl">{question.question}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {question.options.map((option, index) => (
              <Button
                key={index}
                variant={selectedAnswer === index ? "default" : "outline"}
                className={`w-full justify-start h-12 text-left ${
                  selectedAnswer !== null && index === question.correctAnswer
                    ? "bg-green-500 hover:bg-green-600"
                    : selectedAnswer === index && index !== question.correctAnswer
                    ? "bg-red-500 hover:bg-red-600"
                    : ""
                }`}
                onClick={() => handleAnswerSelect(index)}
                disabled={selectedAnswer !== null}
              >
                <span className="font-medium mr-3">{String.fromCharCode(65 + index)}.</span>
                {option}
              </Button>
            ))}
          </CardContent>
        </Card>

        {/* Explanation */}
        {showExplanation && (
          <Card className="border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <h4 className="font-semibold text-blue-900 mb-2">Explanation:</h4>
              <p className="text-blue-800">{question.explanation}</p>
            </CardContent>
          </Card>
        )}

        {/* Live Leaderboard */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Trophy className="h-5 w-5" />
              Live Scores
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {Object.entries(playerScores)
                .sort(([,a], [,b]) => b - a)
                .map(([player, score]) => (
                  <div key={player} className="flex justify-between items-center">
                    <span className="text-sm">{player.slice(0, 6)}...{player.slice(-4)}</span>
                    <Badge variant="outline">{score} pts</Badge>
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (gameState === 'finished') {
    const winner = gameResults.reduce((prev, current) => 
      prev.score > current.score ? prev : current
    );

    return (
      <Card className="w-full max-w-2xl mx-auto">
        <CardHeader className="text-center">
          <Trophy className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
          <CardTitle className="text-2xl">Game Finished!</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center">
            <h3 className="text-lg font-semibold text-green-600 mb-2">🏆 Winner</h3>
            <p className="text-xl font-bold">{winner.player.slice(0, 6)}...{winner.player.slice(-4)}</p>
            <p className="text-muted-foreground">{winner.score} points</p>
          </div>
          
          <div className="space-y-2">
            <h4 className="font-semibold">Final Results:</h4>
            {gameResults
              .sort((a, b) => b.score - a.score)
              .map((result, index) => (
                <div key={result.player} className="flex justify-between items-center p-2 bg-muted/50 rounded">
                  <span className="text-sm">
                    #{index + 1} {result.player.slice(0, 6)}...{result.player.slice(-4)}
                  </span>
                  <Badge variant={index === 0 ? "default" : "outline"}>
                    {result.score} pts
                  </Badge>
                </div>
              ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return null;
}
