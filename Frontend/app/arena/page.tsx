"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { useWeb3 } from "@/components/Web3Provider"
import { ethers } from "ethers"
import { CONTRACT_ADDRESSES, QUIZ_CRAFT_ARENA_ABI } from "@/lib/contracts"
import { IS_DEVELOPMENT } from "@/lib/constants"
import type { Lobby } from "@/types"
import { Trophy, Users, Coins, Loader2, Swords, Crown, Zap, Shield } from "lucide-react"

export default function ArenaPage() {
  const { signer, isConnected } = useWeb3()
  const [lobbies, setLobbies] = useState<Lobby[]>([])
  const [loading, setLoading] = useState(true)
  const [joiningLobby, setJoiningLobby] = useState<string | null>(null)

  useEffect(() => {
    const fetchLobbies = async () => {
      try {
        if (IS_DEVELOPMENT || CONTRACT_ADDRESSES.QUIZ_CRAFT_ARENA === "0x1234567890123456789012345678901234567890") {
          // Enhanced mock data with more variety for development
          const mockLobbies: Lobby[] = [
            {
              id: "1",
              mode: "⚡ Lightning Duel",
              entryFee: "2",
              currentPlayers: 1,
              maxPlayers: 2,
              isActive: true,
            },
            {
              id: "2",
              mode: "🏆 Battle Royale",
              entryFee: "5",
              currentPlayers: 3,
              maxPlayers: 5,
              isActive: true,
            },
            {
              id: "3",
              mode: "🚀 Quick Match",
              entryFee: "1",
              currentPlayers: 2,
              maxPlayers: 2,
              isActive: false,
            },
            {
              id: "4",
              mode: "👑 Championship",
              entryFee: "10",
              currentPlayers: 7,
              maxPlayers: 10,
              isActive: true,
            },
            {
              id: "5",
              mode: "🎯 Precision Challenge",
              entryFee: "3",
              currentPlayers: 0,
              maxPlayers: 4,
              isActive: true,
            },
          ]

          // Simulate network delay
          await new Promise((resolve) => setTimeout(resolve, 1000))
          setLobbies(mockLobbies)
        } else {
          // Real contract calls would go here
          console.log("[v0] Attempting to fetch real lobbies from contract...")
          // For now, fall back to mock data even in production
          setLobbies([])
        }
      } catch (error) {
        console.error("Error fetching lobbies:", error)
        // Fallback to empty array on error
        setLobbies([])
      } finally {
        setLoading(false)
      }
    }

    fetchLobbies()
  }, [])

  const joinLobby = async (lobby: Lobby) => {
    if (!signer || !isConnected) {
      alert("Please connect your wallet first")
      return
    }

    setJoiningLobby(lobby.id)

    try {
      if (IS_DEVELOPMENT || CONTRACT_ADDRESSES.QUIZ_CRAFT_ARENA === "0x1234567890123456789012345678901234567890") {
        // Development mode - simulate transaction
        console.log("[v0] Development mode: Simulating lobby join...")
        await new Promise((resolve) => setTimeout(resolve, 2000))
        console.log("[v0] Simulated transaction confirmed")

        // Redirect to lobby page
        window.location.href = `/arena/${lobby.id}`
      } else {
        // Real contract interaction
        const contract = new ethers.Contract(CONTRACT_ADDRESSES.QUIZ_CRAFT_ARENA, QUIZ_CRAFT_ARENA_ABI, signer)
        const entryFeeWei = ethers.parseEther(lobby.entryFee)

        const tx = await contract.joinLobby(lobby.id, {
          value: entryFeeWei,
        })

        console.log("Transaction sent:", tx.hash)
        await tx.wait()
        console.log("Transaction confirmed")

        // Redirect to lobby page
        window.location.href = `/arena/${lobby.id}`
      }
    } catch (error: any) {
      console.error("Error joining lobby:", error)

      if (error.code === "ACTION_REJECTED") {
        alert("Transaction was rejected")
      } else if (error.code === "INSUFFICIENT_FUNDS") {
        alert("Insufficient CFX balance")
      } else {
        alert("Failed to join lobby. Please try again.")
      }
    } finally {
      setJoiningLobby(null)
    }
  }

  const getLobbyIcon = (mode: string) => {
    if (mode.includes("Duel")) return <Swords className="h-5 w-5" />
    if (mode.includes("Royale")) return <Crown className="h-5 w-5" />
    if (mode.includes("Quick")) return <Zap className="h-5 w-5" />
    if (mode.includes("Championship")) return <Trophy className="h-5 w-5" />
    return <Shield className="h-5 w-5" />
  }

  const getLobbyGradient = (mode: string) => {
    if (mode.includes("Duel")) return "from-red-500 to-orange-500"
    if (mode.includes("Royale")) return "from-purple-500 to-pink-500"
    if (mode.includes("Quick")) return "from-yellow-400 to-orange-500"
    if (mode.includes("Championship")) return "from-blue-500 to-cyan-500"
    return "from-green-500 to-emerald-500"
  }

  if (!isConnected) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto text-center">
          <Card className="border-2 border-accent/20">
            <CardContent className="py-16">
              <div className="w-20 h-20 bg-gradient-to-br from-accent to-secondary rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse-glow">
                <Trophy className="h-10 w-10 text-white" />
              </div>
              <h2 className="font-montserrat font-bold text-3xl mb-4">Connect Your Wallet</h2>
              <p className="text-xl text-muted-foreground mb-8">
                Join the arena and compete with players worldwide for CFX rewards
              </p>
              <div className="grid md:grid-cols-3 gap-4 max-w-2xl mx-auto">
                <div className="p-4 bg-muted/50 rounded-lg">
                  <Shield className="h-8 w-8 text-green-500 mx-auto mb-2" />
                  <div className="font-semibold">Secure</div>
                  <div className="text-sm text-muted-foreground">Blockchain Protected</div>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <Coins className="h-8 w-8 text-yellow-500 mx-auto mb-2" />
                  <div className="font-semibold">Real Rewards</div>
                  <div className="text-sm text-muted-foreground">Win CFX Tokens</div>
                </div>
                <div className="p-4 bg-muted/50 rounded-lg">
                  <Users className="h-8 w-8 text-blue-500 mx-auto mb-2" />
                  <div className="font-semibold">Live Battles</div>
                  <div className="text-sm text-muted-foreground">Real-time PvP</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-gradient-to-br from-red-500 to-orange-500 rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse-glow">
            <Swords className="h-10 w-10 text-white" />
          </div>
          <h1 className="font-montserrat font-bold text-4xl md:text-5xl mb-4">
            Live <span className="text-accent">Arena</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto">
            Enter competitive lobbies and battle other players for CFX rewards. Winner takes all!
          </p>
        </div>

        {loading ? (
          <div className="grid gap-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="border-2 border-muted/20">
                <CardContent className="p-8">
                  <div className="animate-pulse space-y-4">
                    <div className="h-8 bg-muted rounded w-1/3"></div>
                    <div className="h-6 bg-muted rounded w-1/2"></div>
                    <div className="h-12 bg-muted rounded w-32"></div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="grid gap-6">
            {lobbies.map((lobby) => (
              <Card
                key={lobby.id}
                className={`relative overflow-hidden group hover:shadow-2xl transition-all duration-500 border-2 ${
                  lobby.isActive ? "hover:border-accent/50 border-accent/20" : "opacity-60 border-muted/20"
                }`}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${getLobbyGradient(lobby.mode)} rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
                />

                <CardContent className="relative p-8">
                  <div className="flex items-center justify-between">
                    <div className="space-y-4">
                      <div className="flex items-center gap-4">
                        <div
                          className={`w-12 h-12 bg-gradient-to-br ${getLobbyGradient(lobby.mode)} rounded-xl flex items-center justify-center group-hover:scale-110 transition-transform duration-300`}
                        >
                          {getLobbyIcon(lobby.mode)}
                        </div>
                        <div>
                          <h3 className="text-2xl font-montserrat font-bold">{lobby.mode}</h3>
                          {!lobby.isActive && (
                            <Badge variant="secondary" className="mt-1">
                              Lobby Full
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-8 text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Coins className="h-5 w-5 text-yellow-500" />
                          <span className="font-semibold text-lg">{lobby.entryFee} CFX</span>
                          <span className="text-sm">entry fee</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Users className="h-5 w-5 text-blue-500" />
                          <span className="font-semibold text-lg">
                            {lobby.currentPlayers}/{lobby.maxPlayers}
                          </span>
                          <span className="text-sm">players</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Trophy className="h-5 w-5 text-purple-500" />
                          <span className="font-semibold text-lg">
                            {(Number.parseFloat(lobby.entryFee) * lobby.maxPlayers).toFixed(1)} CFX
                          </span>
                          <span className="text-sm">prize pool</span>
                        </div>
                      </div>
                    </div>

                    <Button
                      onClick={() => joinLobby(lobby)}
                      disabled={!lobby.isActive || joiningLobby === lobby.id}
                      size="lg"
                      className="h-14 px-8 text-lg font-semibold shadow-lg hover:shadow-accent/25 transition-all duration-300"
                    >
                      {joiningLobby === lobby.id ? (
                        <>
                          <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                          Joining Battle...
                        </>
                      ) : (
                        <>
                          <Swords className="mr-3 h-5 w-5" />
                          Enter Battle
                        </>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {!loading && lobbies.length === 0 && (
          <Card className="border-2 border-accent/20">
            <CardContent className="py-16 text-center">
              <Trophy className="h-20 w-20 text-muted-foreground mx-auto mb-6" />
              <h3 className="text-2xl font-bold mb-4">No Active Lobbies</h3>
              <p className="text-muted-foreground text-lg mb-8">
                All warriors are currently in battle. Check back soon for new challenges!
              </p>
              <Button variant="outline" size="lg" onClick={() => window.location.reload()}>
                Refresh Lobbies
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
