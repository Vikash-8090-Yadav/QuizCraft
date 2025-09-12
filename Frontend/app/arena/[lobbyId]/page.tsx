"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useWeb3 } from "@/components/Web3Provider"
import { ethers } from "ethers"
import { CONTRACT_ADDRESSES, QUIZ_CRAFT_ARENA_ABI } from "@/lib/contracts"
import { CONFLUX_TESTNET } from "@/lib/constants"
import type { Lobby } from "@/types"
import { 
  Trophy, 
  Users, 
  Coins, 
  Clock, 
  Zap, 
  Crown, 
  Swords, 
  Shield, 
  ArrowLeft,
  Loader2,
  CheckCircle,
  RefreshCw
} from "lucide-react"
import QuizGame from "@/components/QuizGame"
import RealTimeScores from "@/components/RealTimeScores"

export default function LobbyPage() {
  const params = useParams()
  const router = useRouter()
  const { signer, isConnected, isOnConflux, account } = useWeb3()
  const [lobby, setLobby] = useState<Lobby | null>(null)
  const [loading, setLoading] = useState(true)
  const [players, setPlayers] = useState<string[]>([])
  const [isUserInLobby, setIsUserInLobby] = useState(false)
  const [gameStarted, setGameStarted] = useState(false)
  const [gameResults, setGameResults] = useState<any[]>([])
  const [expiresInSec, setExpiresInSec] = useState<number | null>(null)
  const [isExpired, setIsExpired] = useState(false)
  const [pendingReturns, setPendingReturns] = useState<string | null>(null)
  const [createdAtSec, setCreatedAtSec] = useState<number | null>(null)
  const [expiresAtSec, setExpiresAtSec] = useState<number | null>(null)
  const [lobbyTimeoutSec, setLobbyTimeoutSec] = useState<number | null>(null)
  const [gameFinished, setGameFinished] = useState(false)
  const [winner, setWinner] = useState<string | null>(null)
  const [claimingPrize, setClaimingPrize] = useState(false)
  const [startingGame, setStartingGame] = useState(false)
  const [contractScores, setContractScores] = useState<{address: string, score: number}[]>([])
  const [contractLeaderboard, setContractLeaderboard] = useState<string[]>([])
  const [isLeaderboardSet, setIsLeaderboardSet] = useState(false)
  const [rawStatus, setRawStatus] = useState<number | null>(null)
  const [prizeDistributedOnChain, setPrizeDistributedOnChain] = useState<boolean | null>(null)
  const [resolvingPrize, setResolvingPrize] = useState(false)
  const [gameStartCountdown, setGameStartCountdown] = useState<number | null>(null)

  const lobbyId = params.lobbyId as string
  const numericLobbyId = Number(lobbyId)

  const [joinedHint, setJoinedHint] = useState<boolean>(false)

  // Persisted finished state: keep leaderboard visible permanently after a quiz ends
  useEffect(() => {
    try {
      const finishedFlag = typeof window !== 'undefined' ? sessionStorage.getItem(`quizcraft:finished:${lobbyId}`) : null
      if (finishedFlag === 'true') {
        setGameFinished(true)
        setGameStarted(false)
      }
    } catch {}
  }, [lobbyId])

  useEffect(() => {
    try {
      if (account) {
        const flag = sessionStorage.getItem(`quizcraft:joined:${lobbyId}:${account.toLowerCase()}`)
        setJoinedHint(flag === 'true')
      } else {
        setJoinedHint(false)
      }
    } catch {
      setJoinedHint(false)
    }
  }, [account, lobbyId])

  const fetchLobbyDetails = async () => {
      console.log("Lobby page loaded for lobbyId:", lobbyId)
      console.log("isConnected:", isConnected, "isOnConflux:", isOnConflux, "account:", account)

      try {
        // Use wallet provider if on the correct network; otherwise fall back to public RPC for read-only data
        const hasWindowProvider = typeof window !== 'undefined' && (window as any).ethereum
        const browserProvider = hasWindowProvider ? new ethers.BrowserProvider((window as any).ethereum) : null
        const rpcProvider = new ethers.JsonRpcProvider(CONFLUX_TESTNET.rpcUrl)
        // Prefer wallet provider if on the right network; still keep rpc for fallbacks
        const provider = (hasWindowProvider && isOnConflux) ? (browserProvider as any) : (rpcProvider as any)

        const contract = new ethers.Contract(
          CONTRACT_ADDRESSES.QUIZ_CRAFT_ARENA,
          QUIZ_CRAFT_ARENA_ABI,
          provider
        )

        // Get lobby details
        const lobbyData = await contract.lobbies(numericLobbyId)
        const entryFeeCFX = ethers.formatEther(lobbyData.entryFee)
        const status = Number(lobbyData.status)
        setRawStatus(status)
        const playerCount = Number(lobbyData.playerCount)
        const maxPlayers = Number(lobbyData.maxPlayers)
        
        // Determine lobby status
        let statusText = ""
        if (status === 0) { // OPEN
          statusText = playerCount === 0 ? "Waiting for players" : `${playerCount}/${maxPlayers} players`
        } else if (status === 1) { // STARTED
          if (gameFinished) {
            statusText = "Game Completed"
          } else if (gameStarted) {
            statusText = "Game in progress"
          } else if (playerCount >= maxPlayers) {
            statusText = "All players joined - Game starting soon"
          } else {
            statusText = `${playerCount}/${maxPlayers} players - Waiting for more players`
          }
        } else if (status === 2) { // IN_PROGRESS
          statusText = "Game in progress"
        } else if (status === 3) { // COMPLETED
          statusText = "Completed"
        } else if (status === 4) { // CANCELLED
          statusText = "Cancelled"
        }

        // Get players in lobby
        const playersList = await contract.getPlayersInLobby(numericLobbyId)
        
        // Check if current user is in lobby using efficient mapping with robust fallbacks
        let userInLobby = false
        if (account) {
          // Primary: use whichever provider selected above
          try {
            userInLobby = await contract.isPlayerInLobby(numericLobbyId, account)
            console.log("Contract membership check (primary):", userInLobby)
          } catch (err) {
            console.error("Contract membership check (primary) failed:", err)
          }

          // Secondary: try the other provider flavor as redundancy
          if (!userInLobby) {
            try {
              const altProvider = (provider === rpcProvider && browserProvider) ? browserProvider : rpcProvider
              const altContract = new ethers.Contract(
                CONTRACT_ADDRESSES.QUIZ_CRAFT_ARENA,
                QUIZ_CRAFT_ARENA_ABI,
                altProvider as any
              )
              userInLobby = await altContract.isPlayerInLobby(numericLobbyId, account)
              console.log("Contract membership check (secondary):", userInLobby)
            } catch (err) {
              console.error("Contract membership check (secondary) failed:", err)
            }
          }

          // Fallback: derive from players list (case-insensitive)
          if (!userInLobby) {
            const acct = account.toLowerCase()
            userInLobby = playersList.some((p: string) => p.toLowerCase() === acct)
            console.log("Players list fallback check:", userInLobby)
          }

          // If detected from on-chain or players list, persist a session hint for smoother UX
          try {
            if (userInLobby) {
              sessionStorage.setItem(`quizcraft:joined:${lobbyId}:${account.toLowerCase()}`, 'true')
            }
          } catch {}

          // Final fallback: recently joined hint from session
          if (!userInLobby && joinedHint) {
            userInLobby = true
            console.log("Session hint fallback:", userInLobby)
          }

          console.log("Final membership result:", { lobbyId: numericLobbyId, account, userInLobby })
        }

        const lobbyInfo: Lobby = {
          id: String(lobbyData.id),
          name: lobbyData.name,
          category: lobbyData.category,
          mode: `🎯 ${lobbyData.name}`,
          entryFee: entryFeeCFX,
          currentPlayers: playerCount,
          maxPlayers: maxPlayers,
          isActive: status === 0 && playerCount < maxPlayers,
          creator: lobbyData.creator,
          status: statusText,
          isUserInLobby: userInLobby,
        }

        setLobby(lobbyInfo)
        setPlayers(playersList)
        setIsUserInLobby(userInLobby)
        setPrizeDistributedOnChain(lobbyData.distribution === 1) // 1 = DISTRIBUTED
        
        // Compute timing details based on createdAt + LOBBY_TIMEOUT
        try {
          const createdAt: bigint = lobbyData.createdAt
          const LOBBY_TIMEOUT: bigint = await contract.LOBBY_TIMEOUT()
          const nowSec = Math.floor(Date.now() / 1000)
          const expiresAt = Number(createdAt + LOBBY_TIMEOUT)
          const remain = Math.max(0, expiresAt - nowSec)
          setExpiresInSec(remain)
          setIsExpired(remain === 0)
          setCreatedAtSec(Number(createdAt))
          setExpiresAtSec(expiresAt)
          setLobbyTimeoutSec(Number(LOBBY_TIMEOUT))
        } catch (e) {
          // ignore timing calculation errors
        }
        
        // Game start is now handled by the countdown timer effect above

        // Check if game is completed and get winner
        if (status === 3) { // COMPLETED
          setGameFinished(true)
          setWinner(lobbyData.winner)
        }

      } catch (error) {
        console.error("Error fetching lobby details:", error)
      } finally {
        setLoading(false)
      }
    }

  useEffect(() => {
    fetchLobbyDetails()
  }, [lobbyId, isConnected, isOnConflux, account, joinedHint])

  // Listen to PlayerJoined events scoped to this lobby to refresh membership promptly
  useEffect(() => {
    let contract: ethers.Contract | null = null
    const setup = async () => {
      try {
        if (typeof window === 'undefined' || !(window as any).ethereum) return
        const provider = new ethers.BrowserProvider((window as any).ethereum)
        contract = new ethers.Contract(
          CONTRACT_ADDRESSES.QUIZ_CRAFT_ARENA,
          QUIZ_CRAFT_ARENA_ABI,
          provider
        )
        const handler = (eventLobbyId: bigint) => {
          if (Number(eventLobbyId) === numericLobbyId) {
            // Soft refresh membership related state
            window.location.reload()
          }
        }
        contract.on('PlayerJoined', handler)
      } catch {}
    }
    setup()
    return () => {
      try { contract?.removeAllListeners?.('PlayerJoined') } catch {}
    }
  }, [numericLobbyId])

  // Tick countdown every second
  useEffect(() => {
    if (expiresInSec === null) return
    if (expiresInSec <= 0) {
      setIsExpired(true)
      return
    }
    const t = setTimeout(() => setExpiresInSec((s) => (s ? s - 1 : 0)), 1000)
    return () => clearTimeout(t)
  }, [expiresInSec])

  // Game start countdown timer
  useEffect(() => {
    if (gameStartCountdown === null) return
    if (gameStartCountdown <= 0) {
      setGameStarted(true)
      setGameStartCountdown(null)
      return
    }
    const t = setTimeout(() => setGameStartCountdown((s) => (s ? s - 1 : 0)), 1000)
    return () => clearTimeout(t)
  }, [gameStartCountdown])

  // Auto-start game when all players join
  useEffect(() => {
    if (lobby && players.length >= lobby.maxPlayers && !gameStarted && !gameFinished && !gameStartCountdown) {
      console.log("All players joined, starting 10-second countdown")
      setGameStartCountdown(10)
    }
  }, [lobby, players.length, gameStarted, gameFinished, gameStartCountdown])

  // Poll for lobby updates when waiting for players
  useEffect(() => {
    if (gameStarted || gameFinished) return
    
    const pollInterval = setInterval(() => {
      // Re-fetch lobby details to check for new players
      fetchLobbyDetails()
    }, 2000) // Poll every 2 seconds
    
    return () => clearInterval(pollInterval)
  }, [gameStarted, gameFinished])

  const claimRefund = async () => {
    if (!signer || !isUserInLobby) return
    try {
      const contract = new ethers.Contract(
        CONTRACT_ADDRESSES.QUIZ_CRAFT_ARENA,
        QUIZ_CRAFT_ARENA_ABI,
        signer
      )
      const tx = await contract.claimRefund(lobbyId)
      await tx.wait()
      alert('Refund claimed. You can withdraw now.')
    } catch (e: any) {
      console.error('claimRefund error', e)
      alert(e?.message || 'Failed to claim refund')
    }
  }


  const claimPrize = async () => {
    if (!signer || !winner || winner.toLowerCase() !== account?.toLowerCase()) return
    setClaimingPrize(true)
    try {
      // Call the resolve-game API to trigger on-chain resolution
      const response = await fetch('/api/resolve-game', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_RESOLVE_GAME_API_KEY || 'default-secret'}`
        },
        body: JSON.stringify({
          lobbyId: lobbyId,
          winnerAddress: winner
        })
      })

      if (response.ok) {
        const result = await response.json()
        alert(`Game resolved on-chain! Transaction: ${result.transactionHash}`)
        // Refresh lobby data to show updated status
        window.location.reload()
      } else {
        const error = await response.json()
        alert(`Failed to resolve game: ${error.error}`)
      }
    } catch (e: any) {
      console.error('claimPrize error', e)
      alert(e?.message || 'Failed to claim prize')
    } finally {
      setClaimingPrize(false)
    }
  }

  const resolvePrizeAsCreator = async () => {
    if (!signer || !lobby?.creator || lobby.creator.toLowerCase() !== account?.toLowerCase()) return
    setResolvingPrize(true)
    try {
      // Determine winner from Supabase first, then fallback to on-chain, then local
      let winnerAddress = winner
      
      if (!winnerAddress) {
        try {
          // Try to get winner from Supabase
          const response = await fetch(`/api/scores/all-players?lobbyId=${lobbyId}`)
          if (response.ok) {
            const data = await response.json()
            if (data.winner) {
              winnerAddress = data.winner
            }
          }
        } catch (e) {
          console.error('Error fetching winner from Supabase:', e)
        }
      }

      if (!winnerAddress) {
        // Fallback to on-chain scores
        try {
          const provider = new ethers.BrowserProvider((window as any).ethereum)
          const contract = new ethers.Contract(CONTRACT_ADDRESSES.QUIZ_CRAFT_ARENA, QUIZ_CRAFT_ARENA_ABI, provider)
          const players = await contract.getPlayersInLobby(numericLobbyId)
          const scores = []
          for (const player of players) {
            const score = await contract.playerScores(numericLobbyId, player)
            scores.push(Number(score))
          }
          if (players.length > 0 && scores.length > 0) {
            const maxScore = Math.max(...scores)
            const winnerIndex = scores.findIndex(s => s === maxScore)
            if (winnerIndex >= 0) {
              winnerAddress = players[winnerIndex]
            }
          }
        } catch (e) {
          console.error('Error fetching winner from contract:', e)
        }
      }

      if (!winnerAddress) {
        // Final fallback to local winner
        if (gameResults.length > 0) {
          const localWinner = gameResults.reduce((prev, current) => 
            prev.score > current.score ? prev : current
          )
          winnerAddress = localWinner.player
        }
      }

      if (!winnerAddress) {
        alert('Could not determine winner. Please try again.')
        return
      }

      // Execute the prize payout directly using the user's wallet
      const contract = new ethers.Contract(CONTRACT_ADDRESSES.QUIZ_CRAFT_ARENA, QUIZ_CRAFT_ARENA_ABI, signer)
      
      // Call executeWinnerPayout on-chain using the creator's wallet
      const tx = await contract.executeWinnerPayout(numericLobbyId, winnerAddress)
      console.log("executeWinnerPayout transaction sent:", tx.hash)
      
      // Wait for confirmation
      const receipt = await tx.wait()
      console.log("Prize payout transaction confirmed:", receipt)

      alert(`Prize resolved on-chain! Winner: ${winnerAddress.slice(0, 6)}...${winnerAddress.slice(-4)}. Transaction: ${tx.hash}`)
      
      // Refresh lobby data to show updated status
      window.location.reload()
      
    } catch (e: any) {
      console.error('resolvePrizeAsCreator error', e)
      alert(e?.message || 'Failed to resolve prize')
    } finally {
      setResolvingPrize(false)
    }
  }

  // Game starts automatically when lobby is full - no manual start needed


  // Fetch scores and leaderboard from smart contract
  useEffect(() => {
    const fetchContractData = async () => {
      try {
        if (!isOnConflux) return
        const provider = new ethers.BrowserProvider((window as any).ethereum)
        const contract = new ethers.Contract(CONTRACT_ADDRESSES.QUIZ_CRAFT_ARENA, QUIZ_CRAFT_ARENA_ABI, provider)
        
        // Check if leaderboard is set and read it if present
        const leaderboardSet = await contract.leaderboardSet(numericLobbyId)
        setIsLeaderboardSet(leaderboardSet)
        console.log('Leaderboard set on-chain:', leaderboardSet)
        
        if (leaderboardSet) {
          const leaderboard = await contract.lobbyLeaderboard(numericLobbyId, 0) // Get first entry, need to loop for all
          setContractLeaderboard(leaderboard)
          console.log('On-chain leaderboard:', leaderboard)
        }

        // Read player scores individually since getAllScores doesn't exist in new contract
        const players = await contract.getPlayersInLobby(numericLobbyId)
        const scores: bigint[] = []
        for (const player of players) {
          const score = await contract.playerScores(numericLobbyId, player)
          scores.push(score)
        }
        const scoresData = players.map((player: string, index: number) => ({
          address: player,
          score: Number(scores[index])
        }))
        setContractScores(scoresData)
        console.log('On-chain scores:', scoresData)
        
        // Also check local storage for any pending scores
        try {
          const localScores = localStorage.getItem(`quizcraft:lobby-scores:${lobbyId}`)
          if (localScores) {
            const localData = JSON.parse(localScores)
            console.log('Local scores found:', localData)
            
            // If local scores exist and on-chain scores are empty, use local scores
            if (scoresData.length === 0 && localData.scores && localData.scores.length > 0) {
              const localScoresData = localData.players.map((player: string, index: number) => ({
                address: player,
                score: Number(localData.scores[index])
              }))
              setContractScores(localScoresData)
              console.log('Using local scores as fallback:', localScoresData)
            }
          }
        } catch (e) {
          console.error('Error reading local scores:', e)
        }
        
      } catch (e) {
        console.error('Error fetching contract data:', e)
      }
    }
    
    fetchContractData()
  }, [lobbyId, isOnConflux, gameFinished, gameStarted])

  const refreshScoresAndLeaderboard = async () => {
    try {
      if (!isOnConflux) return
      const provider = new ethers.BrowserProvider((window as any).ethereum)
      const contract = new ethers.Contract(CONTRACT_ADDRESSES.QUIZ_CRAFT_ARENA, QUIZ_CRAFT_ARENA_ABI, provider)
      
      // Check if leaderboard is set and read it if present
      const leaderboardSet = await contract.leaderboardSet(numericLobbyId)
      setIsLeaderboardSet(leaderboardSet)
      
      if (leaderboardSet) {
        const leaderboard = await contract.lobbyLeaderboard(numericLobbyId, 0) // Get first entry, need to loop for all
        setContractLeaderboard(leaderboard)
      }

      // Read player scores individually since getAllScores doesn't exist in new contract
      const players = await contract.getPlayersInLobby(numericLobbyId)
      const scores: bigint[] = []
      for (const player of players) {
        const score = await contract.playerScores(numericLobbyId, player)
        scores.push(score)
      }
      const scoresData = players.map((player: string, index: number) => ({
        address: player,
        score: Number(scores[index])
      }))
      setContractScores(scoresData)
      
      console.log('Scores and leaderboard refreshed:', { leaderboardSet, leaderboard: leaderboardSet ? await contract.getLeaderboard(numericLobbyId) : null, scores: scoresData })
    } catch (e) {
      console.error('Error refreshing scores and leaderboard:', e)
    }
  }

  const getLobbyIcon = (mode: string) => {
    if (mode.includes("Duel")) return <Swords className="h-6 w-6" />
    if (mode.includes("Royale")) return <Crown className="h-6 w-6" />
    if (mode.includes("Quick")) return <Zap className="h-6 w-6" />
    if (mode.includes("Championship")) return <Trophy className="h-6 w-6" />
    return <Shield className="h-6 w-6" />
  }

  const getStatusLabel = (statusNum: number | null) => {
    if (statusNum === null) return 'Unknown'
    switch (statusNum) {
      case 0: return 'OPEN'
      case 1: return 'FULL'
      case 2: return 'IN_PROGRESS'
      case 3: return 'COMPLETED'
      case 4: return 'CANCELLED'
      default: return 'Unknown'
    }
  }

  const formatRelativeTime = (targetSeconds: number, isFuture: boolean) => {
    const nowSec = Math.floor(Date.now() / 1000)
    const delta = Math.max(0, Math.abs(targetSeconds - nowSec))
    const minutes = Math.floor(delta / 60)
    const seconds = delta % 60
    if (minutes > 0) {
      return isFuture ? `in ${minutes}m ${seconds}s` : `${minutes}m ${seconds}s ago`
    }
    return isFuture ? `in ${seconds}s` : `${seconds}s ago`
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto space-y-6">
          {/* Top shimmer banner */}
          <div className="relative overflow-hidden rounded-xl border border-muted/30 bg-gradient-to-r from-muted/40 via-muted/60 to-muted/40">
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/20 to-transparent animate-[shimmer_1.6s_infinite]" />
            <div className="p-6 flex items-center justify-between">
              <div className="space-y-2">
                <div className="h-6 w-40 bg-white/20 rounded" />
                <div className="h-4 w-64 bg-white/10 rounded" />
              </div>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-white/20" />
                <div className="h-10 w-28 rounded-lg bg-white/20" />
              </div>
            </div>
          </div>

          {/* Info cards skeleton */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[0,1,2].map((i) => (
              <div key={i} className="relative overflow-hidden rounded-xl border border-muted/30 bg-card p-5">
                <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_1.6s_infinite]" />
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-muted" />
                  <div className="space-y-2 w-full">
                    <div className="h-3 w-24 bg-muted rounded" />
                    <div className="h-4 w-32 bg-muted rounded" />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Details and list skeletons */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="relative overflow-hidden rounded-xl border border-muted/30 bg-card p-6">
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_1.6s_infinite]" />
              <div className="h-5 w-40 bg-muted rounded mb-4" />
              <div className="space-y-3">
                {[0,1,2,3].map((i) => (
                  <div key={i} className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-full bg-muted" />
                    <div className="space-y-2 w-full">
                      <div className="h-3 w-28 bg-muted rounded" />
                      <div className="h-3 w-40 bg-muted/80 rounded" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="relative overflow-hidden rounded-xl border border-muted/30 bg-card p-6">
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_1.6s_infinite]" />
              <div className="h-5 w-48 bg-muted rounded mb-4" />
              <div className="space-y-3">
                {[0,1,2].map((i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded-lg border bg-muted/20">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-muted" />
                      <div className="h-4 w-32 bg-muted rounded" />
                    </div>
                    <div className="h-4 w-16 bg-muted rounded" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer action skeleton */}
          <div className="relative overflow-hidden rounded-xl border border-muted/30 bg-card p-8 text-center">
            <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_1.6s_infinite]" />
            <div className="mx-auto h-10 w-40 bg-muted rounded" />
          </div>
        </div>
        <style jsx global>{`
          @keyframes shimmer { 100% { transform: translateX(100%); } }
        `}</style>
      </div>
    )
  }

  if (!lobby) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto text-center">
          <Card className="border-2 border-red-500/20 bg-red-900/10">
            <CardContent className="py-16">
              <div className="w-20 h-20 bg-red-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Shield className="h-10 w-10 text-red-500" />
              </div>
              <h2 className="font-montserrat font-bold text-3xl mb-4 text-red-400">Lobby Not Found</h2>
              <p className="text-xl text-muted-foreground mb-8">
                The lobby you're looking for doesn't exist or you don't have access to it.
              </p>
              <Button
                onClick={() => router.push("/arena")}
                size="lg"
                className="bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                <ArrowLeft className="mr-3 h-5 w-5" />
                Back to Arena
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!loading && !isUserInLobby && account && !joinedHint) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto text-center">
          <Card className="border-2 border-yellow-500/20 bg-yellow-900/10">
            <CardContent className="py-16">
              <div className="w-20 h-20 bg-yellow-500/20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                <Shield className="h-10 w-10 text-yellow-500" />
              </div>
              <h2 className="font-montserrat font-bold text-3xl mb-4 text-yellow-400">Access Denied</h2>
              <p className="text-xl text-muted-foreground mb-8">
                You are not a member of this lobby. Please join the lobby from the arena first.
              </p>
              <Button
                onClick={() => router.push("/arena")}
                size="lg"
                className="bg-yellow-600 hover:bg-yellow-700 text-white font-semibold"
              >
                <ArrowLeft className="mr-3 h-5 w-5" />
                Back to Arena
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <Button
            onClick={() => router.push("/arena")}
            variant="outline"
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Arena
          </Button>
          <div className="text-right">
            <h1 className="text-2xl font-bold">Lobby #{lobbyId}</h1>
            <p className="text-muted-foreground">{lobby.status} ({getStatusLabel(rawStatus)})</p>
          </div>
        </div>

        {/* Lobby Info */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-3">
              {getLobbyIcon(lobby.mode)}
              {lobby.mode}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="flex items-center gap-3">
                <Coins className="h-5 w-5 text-yellow-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Entry Fee</p>
                  <p className="font-semibold">{lobby.entryFee} CFX</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Users className="h-5 w-5 text-blue-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Players</p>
                  <p className="font-semibold">{lobby.currentPlayers}/{lobby.maxPlayers}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Trophy className="h-5 w-5 text-purple-500" />
                <div>
                  <p className="text-sm text-muted-foreground">Prize Pool</p>
                  <p className="font-semibold">{(Number.parseFloat(lobby.entryFee) * lobby.maxPlayers).toFixed(1)} CFX</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lobby Details */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Lobby Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Raw status from enum */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-gray-100 rounded-full flex items-center justify-center">
                  <Shield className="h-4 w-4 text-gray-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p className="font-semibold">{getStatusLabel(rawStatus)}</p>
                </div>
              </div>
              {createdAtSec !== null && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                    <Clock className="h-4 w-4 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Created</p>
                    <p className="font-semibold">{new Date(createdAtSec * 1000).toLocaleString()} <span className="text-xs text-muted-foreground">({formatRelativeTime(createdAtSec, false)})</span></p>
                    {rawStatus === 1 && (
                      <p className="text-xs text-muted-foreground">Timer reset when lobby became FULL</p>
                    )}
                  </div>
                </div>
              )}
              {expiresAtSec !== null && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                    <Clock className="h-4 w-4 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Expires</p>
                    <p className="font-semibold">{new Date(expiresAtSec * 1000).toLocaleString()} <span className="text-xs text-muted-foreground">({formatRelativeTime(expiresAtSec, true)})</span></p>
                  </div>
                </div>
              )}
              {lobbyTimeoutSec !== null && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                    <Clock className="h-4 w-4 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Timeout Window</p>
                    <p className="font-semibold">{Math.floor(lobbyTimeoutSec / 60)} minutes</p>
                  </div>
                </div>
              )}
              {expiresInSec !== null && !isExpired && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                    <Clock className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Time Remaining</p>
                    <p className="font-semibold text-green-600">
                      {Math.floor((expiresInSec || 0) / 60)}m {(expiresInSec || 0) % 60}s
                    </p>
                  </div>
                </div>
              )}
              {/* Winner (if resolved) */}
              {winner && (
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
                    <Trophy className="h-4 w-4 text-yellow-600" />
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">Winner</p>
                    <p className="font-semibold">{winner.slice(0, 6)}...{winner.slice(-4)}</p>
                  </div>
                </div>
              )}
              {/* Prize distribution status */}
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-4 w-4 text-emerald-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Prize Distributed (on-chain)</p>
                  <p className="font-semibold">{prizeDistributedOnChain ? 'Yes' : 'No'}</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Real-time Scores from Supabase - Show before game starts and after game ends */}
        {(!gameStarted || gameFinished) && (
          <RealTimeScores 
            key={`scores-${gameFinished ? 'finished' : 'waiting'}`}
            lobbyId={lobbyId} 
            refreshInterval={3000}
            gameState={gameFinished ? 'finished' : 'waiting'}
            currentPlayerAddress={account || undefined}
          />
        )}

        {/* Creator-only Resolve Prize Button */}
        {lobby?.creator && account && lobby?.creator?.toLowerCase() === account.toLowerCase() && gameFinished && !prizeDistributedOnChain && (
          <Card className="mb-8">
            <CardContent className="p-6">
              <div className="text-center">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <Trophy className="h-8 w-8 text-yellow-500" />
                  <h3 className="text-xl font-semibold">Resolve Prize Pool</h3>
                </div>
                <p className="text-muted-foreground mb-4">
                  As the lobby creator, you can resolve the prize pool and distribute it to the winner.
                </p>
                <Button 
                  onClick={resolvePrizeAsCreator} 
                  disabled={resolvingPrize}
                  className="bg-purple-600 hover:bg-purple-700 text-white"
                >
                  {resolvingPrize ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Resolving Prize...
                    </>
                  ) : (
                    <>
                      <Trophy className="mr-2 h-4 w-4" />
                      Resolve Prize (Creator)
                    </>
                  )}
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quiz Game */}
        {gameStarted && !isExpired && !gameFinished ? (
          <QuizGame
            lobbyId={lobbyId}
            players={players}
            category={lobby.category}
            startTimestampSec={0} // Not used - simple timer handles everything
            questionDurationSec={10}
            seed={`${CONTRACT_ADDRESSES.QUIZ_CRAFT_ARENA}-${numericLobbyId}-${createdAtSec || 0}`}
            currentPlayerAddress={account || players.find(p => p) || ''}
            onGameEnd={(results) => {
              setGameResults(results)
              setGameFinished(true)
              setGameStarted(false)
              try { sessionStorage.setItem(`quizcraft:finished:${lobbyId}`, 'true') } catch {}
              // Determine winner from results
              const gameWinner = results.reduce((prev, current) => 
                prev.score > current.score ? prev : current
              )
              setWinner(gameWinner.player)
              console.log("Game ended with results:", results)
            }}
            onScoreUpdate={(scores) => {
              // Keep a lightweight preview list in gameResults shape for display
              const preview = Object.entries(scores).map(([player, score]) => ({
                player,
                score,
                correctAnswers: Math.floor((score || 0) / 100),
                totalQuestions: 10,
                timeBonus: Math.floor((score || 0) % 100)
              }))
              setGameResults(preview)
            }}
          />
        ) : (
          <Card className="mb-8">
            <CardContent className="p-8 text-center">
              {gameStartCountdown ? (
                // Show countdown when game is about to start
                <div className="space-y-6">
                  <div className="text-6xl font-bold text-green-600 mb-4">
                    {gameStartCountdown}
                  </div>
                  <h2 className="text-2xl font-bold text-green-600 mb-2">Game Starting Soon!</h2>
                  <p className="text-lg text-muted-foreground">
                    All players have joined! Get ready for the quiz battle!
                  </p>
                  <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{players.length} / {lobby.maxPlayers} Players Ready</span>
                  </div>
                </div>
              ) : (
                // Show waiting state when not all players joined
                <div className="space-y-4">
                  <div className="flex items-center justify-center gap-3 mb-4">
                    <Users className="h-8 w-8 text-blue-500" />
                    <span className="text-xl font-semibold">
                      {players.length} / {lobby.maxPlayers} Players Joined
                    </span>
                  </div>
                  {players.length >= lobby.maxPlayers ? (
                    <div className="text-green-600 font-semibold">
                      <CheckCircle className="h-6 w-6 inline mr-2" />
                      All players have joined! Game will start automatically in a few seconds.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-muted-foreground">
                        Waiting for {lobby.maxPlayers - players.length} more players to join...
                      </p>
                      {expiresInSec !== null && !isExpired && (
                        <p className="text-sm text-muted-foreground">
                          Expires in {Math.floor((expiresInSec || 0) / 60)}m {(expiresInSec || 0) % 60}s
                        </p>
                      )}
                    </div>
                  )}
                  {isExpired && isUserInLobby && (
                    <div className="mt-4">
                      <Button onClick={claimRefund} className="bg-red-600 hover:bg-red-700 text-white">
                        Claim Refund
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}


        {/* Players List */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Players ({lobby.currentPlayers}/{lobby.maxPlayers})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {players.map((player, index) => (
                <div
                  key={player}
                  className={`flex items-center justify-between p-3 rounded-lg border ${
                    player.toLowerCase() === account?.toLowerCase()
                      ? "bg-green-50 border-green-200"
                      : "bg-muted/20"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-500 to-purple-500 rounded-full flex items-center justify-center text-white font-bold text-sm">
                      {index + 1}
                    </div>
                    <div>
                      <p className="font-medium">
                        {player.toLowerCase() === account?.toLowerCase() ? "You" : `${player.slice(0, 6)}...${player.slice(-4)}`}
                      </p>
                      <p className="text-sm text-muted-foreground">{player}</p>
                    </div>
                  </div>
                  {player.toLowerCase() === account?.toLowerCase() && (
                    <Badge variant="default" className="bg-green-500">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      You
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

      </div>
    </div>
  )
}