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
  CheckCircle
} from "lucide-react"
import QuizGame from "@/components/QuizGame"

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

  const lobbyId = params.lobbyId as string

  useEffect(() => {
    const fetchLobbyDetails = async () => {
      console.log("Lobby page loaded for lobbyId:", lobbyId)
      console.log("isConnected:", isConnected, "isOnConflux:", isOnConflux, "account:", account)
      
      if (!isConnected || !isOnConflux) {
        console.log("Not connected or wrong network, setting loading to false")
        setLoading(false)
        return
      }

      try {
        const provider = new ethers.BrowserProvider(window.ethereum)
        const contract = new ethers.Contract(
          CONTRACT_ADDRESSES.QUIZ_CRAFT_ARENA,
          QUIZ_CRAFT_ARENA_ABI,
          provider
        )

        // Get lobby details
        const lobbyData = await contract.lobbies(lobbyId)
        const entryFeeCFX = ethers.formatEther(lobbyData.entryFee)
        const status = Number(lobbyData.status)
        const playerCount = Number(lobbyData.playerCount)
        const maxPlayers = Number(lobbyData.maxPlayers)
        
        // Determine lobby status
        let statusText = ""
        if (status === 0) { // OPEN
          statusText = playerCount === 0 ? "Waiting for players" : `${playerCount}/${maxPlayers} players`
        } else if (status === 1) { // FULL
          statusText = "Full - Game starting"
        } else if (status === 2) { // IN_PROGRESS
          statusText = "Game in progress"
        } else if (status === 3) { // COMPLETED
          statusText = "Completed"
        } else if (status === 4) { // CANCELLED
          statusText = "Cancelled"
        }

        // Get players in lobby
        const playersList = await contract.getPlayersInLobby(lobbyId)
        
        // Check if current user is in lobby
        let userInLobby = false
        if (account) {
          userInLobby = await contract.isPlayerInLobby(lobbyId, account)
          console.log("User in lobby check:", { lobbyId, account, userInLobby })
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
        
        // Compute expiry based on createdAt + LOBBY_TIMEOUT for OPEN/FULL
        try {
          const createdAt: bigint = lobbyData.createdAt
          const statusEnum: number = Number(lobbyData.status)
          const LOBBY_TIMEOUT: bigint = await contract.LOBBY_TIMEOUT()
          if (statusEnum === 0 || statusEnum === 1) {
            const nowSec = Math.floor(Date.now() / 1000)
            const expiresAt = Number(createdAt + LOBBY_TIMEOUT)
            const remain = Math.max(0, expiresAt - nowSec)
            setExpiresInSec(remain)
            setIsExpired(remain === 0)
            setCreatedAtSec(Number(createdAt))
            setExpiresAtSec(expiresAt)
            setLobbyTimeoutSec(Number(LOBBY_TIMEOUT))
          } else {
            setExpiresInSec(null)
            setIsExpired(false)
            setCreatedAtSec(null)
            setExpiresAtSec(null)
            setLobbyTimeoutSec(null)
          }
        } catch (e) {
          // ignore expiry calculation errors
        }
        
        // Auto-start game if lobby is full
        if (playersList.length >= maxPlayers && !gameStarted) {
          setGameStarted(true)
        }

      } catch (error) {
        console.error("Error fetching lobby details:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchLobbyDetails()
  }, [lobbyId, isConnected, isOnConflux, account])

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

  const withdrawRefund = async () => {
    if (!signer) return
    try {
      const contract = new ethers.Contract(
        CONTRACT_ADDRESSES.QUIZ_CRAFT_ARENA,
        QUIZ_CRAFT_ARENA_ABI,
        signer
      )
      const tx = await contract.withdrawRefund()
      await tx.wait()
      alert('Refund withdrawn to your wallet.')
    } catch (e: any) {
      console.error('withdrawRefund error', e)
      alert(e?.message || 'Failed to withdraw refund')
    }
  }

  // Read pending returns for current user
  useEffect(() => {
    const readPending = async () => {
      try {
        if (!account || !isOnConflux) return
        const provider = new ethers.BrowserProvider(window.ethereum)
        const contract = new ethers.Contract(
          CONTRACT_ADDRESSES.QUIZ_CRAFT_ARENA,
          QUIZ_CRAFT_ARENA_ABI,
          provider
        )
        const amount: bigint = await contract.pendingReturns(account)
        setPendingReturns(ethers.formatEther(amount))
      } catch {
        setPendingReturns(null)
      }
    }
    readPending()
  }, [account, isOnConflux, lobbyId])

  const getLobbyIcon = (mode: string) => {
    if (mode.includes("Duel")) return <Swords className="h-6 w-6" />
    if (mode.includes("Royale")) return <Crown className="h-6 w-6" />
    if (mode.includes("Quick")) return <Zap className="h-6 w-6" />
    if (mode.includes("Championship")) return <Trophy className="h-6 w-6" />
    return <Shield className="h-6 w-6" />
  }

  if (loading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-center h-64">
            <Loader2 className="h-8 w-8 animate-spin" />
            <span className="ml-2">Loading lobby...</span>
          </div>
        </div>
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

  if (!isUserInLobby) {
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
            <p className="text-muted-foreground">{lobby.status}</p>
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

        {/* Quiz Game */}
        {gameStarted && !isExpired ? (
          <QuizGame
            lobbyId={lobbyId}
            players={players}
            category={lobby.category}
            onGameEnd={(results) => {
              setGameResults(results)
              console.log("Game ended with results:", results)
            }}
          />
        ) : (
          <Card className="mb-8">
            <CardContent className="p-8 text-center">
              <div className="flex items-center justify-center gap-3 mb-4">
                <Users className="h-8 w-8 text-blue-500" />
                <span className="text-xl font-semibold">
                  {players.length} / {lobby.maxPlayers} Players Joined
                </span>
              </div>
              {expiresInSec !== null && (
                <div className="text-sm text-muted-foreground mb-2">
                  {isExpired ? (
                    <span className="text-red-600 font-semibold">Lobby expired</span>
                  ) : (
                    <>Expires in {Math.floor((expiresInSec || 0) / 60)}m {(expiresInSec || 0) % 60}s</>
                  )}
                  {isExpired && (
                    <div className="mt-1 text-xs text-muted-foreground">
                      {createdAtSec !== null && (
                        <div>Created: {new Date(createdAtSec * 1000).toLocaleString()}</div>
                      )}
                      {expiresAtSec !== null && (
                        <div>Expired: {new Date(expiresAtSec * 1000).toLocaleString()}</div>
                      )}
                      {lobbyTimeoutSec !== null && (
                        <div>Timeout Window: {Math.floor(lobbyTimeoutSec / 60)} minutes</div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {players.length >= lobby.maxPlayers ? (
                <div className="text-green-600 font-semibold">
                  <CheckCircle className="h-6 w-6 inline mr-2" />
                  All players have joined! The game will start soon.
                </div>
              ) : (
                <p className="text-muted-foreground">
                  Waiting for {lobby.maxPlayers - players.length} more players to join...
                </p>
              )}
              {isExpired && isUserInLobby && (
                <div className="mt-4 flex gap-3 justify-center">
                  <Button onClick={claimRefund} className="bg-red-600 hover:bg-red-700 text-white">Claim Refund</Button>
                  {pendingReturns && Number(pendingReturns) > 0 && (
                    <Button onClick={withdrawRefund} variant="outline">Withdraw ({Number(pendingReturns).toFixed(4)} CFX)</Button>
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

        {/* Status Message */}
        <Card>
          <CardContent className="py-8 text-center">
            {lobby.currentPlayers < lobby.maxPlayers ? (
              <div>
                <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Clock className="h-8 w-8 text-blue-500" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Waiting for Players</h3>
                <p className="text-muted-foreground">
                  {lobby.maxPlayers - lobby.currentPlayers} more player(s) needed to start the game.
                </p>
              </div>
            ) : (
              <div>
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="h-8 w-8 text-green-500" />
                </div>
                <h3 className="text-xl font-semibold mb-2">Lobby Full</h3>
                <p className="text-muted-foreground">
                  All players have joined! The game will start soon.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}