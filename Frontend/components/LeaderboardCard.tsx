"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Trophy, Medal, Crown, Zap, TrendingUp } from "lucide-react"
import type { LeaderboardEntry } from "@/types"

async function getLeaderboard(): Promise<LeaderboardEntry[]> {
  // Mock data with more realistic usernames and enhanced data
  return [
    {
      rank: 1,
      address: "0x1234567890123456789012345678901234567890",
      score: 2850,
      timestamp: Date.now(),
      username: "CryptoMaster",
      streak: 15,
      nfts: 8,
    },
    {
      rank: 2,
      address: "0x2345678901234567890123456789012345678901",
      score: 2720,
      timestamp: Date.now(),
      username: "QuizNinja",
      streak: 12,
      nfts: 6,
    },
    {
      rank: 3,
      address: "0x3456789012345678901234567890123456789012",
      score: 2650,
      timestamp: Date.now(),
      username: "BrainPower",
      streak: 9,
      nfts: 5,
    },
    {
      rank: 4,
      address: "0x4567890123456789012345678901234567890123",
      score: 2580,
      timestamp: Date.now(),
      username: "Web3Wizard",
      streak: 7,
      nfts: 4,
    },
    {
      rank: 5,
      address: "0x5678901234567890123456789012345678901234",
      score: 2500,
      timestamp: Date.now(),
      username: "AIExplorer",
      streak: 6,
      nfts: 3,
    },
  ]
}

export function LeaderboardCard() {
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        const data = await getLeaderboard()
        setLeaderboard(data)
      } catch (error) {
        console.error("Failed to fetch leaderboard:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchLeaderboard()
  }, [])

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return (
          <div className="w-8 h-8 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center animate-pulse-glow">
            <Crown className="h-4 w-4 text-white" />
          </div>
        )
      case 2:
        return (
          <div className="w-8 h-8 bg-gradient-to-br from-gray-300 to-gray-500 rounded-full flex items-center justify-center">
            <Trophy className="h-4 w-4 text-white" />
          </div>
        )
      case 3:
        return (
          <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-600 rounded-full flex items-center justify-center">
            <Medal className="h-4 w-4 text-white" />
          </div>
        )
      default:
        return (
          <div className="w-8 h-8 bg-gradient-to-br from-muted to-muted-foreground/20 rounded-full flex items-center justify-center">
            <span className="text-xs font-bold text-muted-foreground">#{rank}</span>
          </div>
        )
    }
  }

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`
  }

  return (
    <Card className="relative overflow-hidden group hover:shadow-2xl transition-all duration-500 border-2 hover:border-accent/50">
      <div className="absolute inset-0 bg-gradient-to-br from-accent/5 via-transparent to-secondary/5 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

      <CardHeader className="relative">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-accent to-secondary rounded-xl flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-montserrat font-bold text-xl">Live Leaderboard</h3>
              <p className="text-sm text-muted-foreground">Top performers today</p>
            </div>
          </div>
          <Badge variant="secondary" className="animate-pulse">
            <Zap className="h-3 w-3 mr-1" />
            Live
          </Badge>
        </CardTitle>
      </CardHeader>

      <CardContent className="relative">
        {loading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="flex items-center justify-between animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 bg-muted rounded-full"></div>
                  <div className="h-4 bg-muted rounded w-24"></div>
                </div>
                <div className="h-4 bg-muted rounded w-16"></div>
              </div>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {leaderboard.map((entry, index) => (
              <div
                key={entry.rank}
                className="flex items-center justify-between p-3 rounded-lg hover:bg-muted/50 transition-all duration-300 group/item"
                style={{ animationDelay: `${index * 0.1}s` }}
              >
                <div className="flex items-center gap-3">
                  {getRankIcon(entry.rank)}
                  <div className="flex flex-col">
                    <span className="font-semibold text-sm group-hover/item:text-accent transition-colors">
                      {entry.username || formatAddress(entry.address)}
                    </span>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>🔥 {entry.streak || 0}</span>
                      <span>🏆 {entry.nfts || 0} NFTs</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="font-bold text-accent text-lg">{entry.score.toLocaleString()}</div>
                  <div className="text-xs text-muted-foreground">points</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-6 pt-4 border-t border-border/50">
          <button className="w-full text-center text-sm text-accent hover:text-accent/80 transition-colors font-medium">
            View Full Leaderboard →
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
