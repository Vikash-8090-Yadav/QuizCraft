"use client"

import { useState, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { useWeb3 } from "@/components/Web3Provider"
import { ethers } from "ethers"
import { CONTRACT_ADDRESSES, QUIZ_CRAFT_ARENA_ABI } from "@/lib/contracts"
import { IS_DEVELOPMENT, CONFLUX_TESTNET } from "@/lib/constants"
import type { Lobby } from "@/types"
import { Trophy, Users, Coins, Loader2, Swords, Crown, Zap, Shield, Plus, X, CheckCircle } from "lucide-react"

const OWNER_ADDRESS = "0xc3E894473BB51b5e5453042420A1d465E69cbCB9"

export default function ArenaPage() {
  const { signer, isConnected, isOnConflux, chainId, switchToConflux, account } = useWeb3()
  const [lobbies, setLobbies] = useState<Lobby[]>([])
  const [loading, setLoading] = useState(true)
  const [joiningLobby, setJoiningLobby] = useState<string | null>(null)
  const [creatingLobby, setCreatingLobby] = useState(false)
  const [debugInfo, setDebugInfo] = useState<string>("")
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isSuccessModalOpen, setIsSuccessModalOpen] = useState(false)
  const [createdLobbyName, setCreatedLobbyName] = useState("")
  const [lobbyForm, setLobbyForm] = useState({
    name: "",
    category: "",
    entryFee: "",
    maxPlayers: "2"
  })

  useEffect(() => {
    const fetchLobbies = async () => {
      try {
        // Always use real contract now
        if (false) {
          const mockLobbies: Lobby[] = [
            { id: "1", name: "Lightning Duel", category: "Technology", mode: "⚡ Lightning Duel", entryFee: "2", currentPlayers: 1, maxPlayers: 2, isActive: true },
            { id: "2", name: "Battle Royale", category: "Crypto", mode: "🏆 Battle Royale", entryFee: "5", currentPlayers: 3, maxPlayers: 5, isActive: true },
            { id: "3", name: "Quick Match", category: "Science", mode: "🚀 Quick Match", entryFee: "1", currentPlayers: 2, maxPlayers: 2, isActive: false },
          ]
          await new Promise((resolve) => setTimeout(resolve, 500))
          setLobbies(mockLobbies)
          return
        }

        // Real on-chain fetch
        const onchainProvider = new ethers.BrowserProvider(window.ethereum)
        const readContract = new ethers.Contract(
          CONTRACT_ADDRESSES.QUIZ_CRAFT_ARENA,
          QUIZ_CRAFT_ARENA_ABI,
          onchainProvider
        )

        setDebugInfo("Fetching from contract...")
        const nextLobbyId: bigint = await readContract.nextLobbyId()
        const lobbyCount = Number(nextLobbyId)
        setDebugInfo(`Found ${lobbyCount} lobbies`)
        
        const fetched: Lobby[] = []
        for (let i = 0; i < lobbyCount; i++) {
          try {
            const lobby = await readContract.lobbies(i)
            // lobby: { id, name, category, entryFee, playerCount, maxPlayers, prizePool, createdAt, status, winner, prizeDistributed, creator }
            const entryFeeCFX = ethers.formatEther(lobby.entryFee)
            const status = Number(lobby.status)
            const playerCount = Number(lobby.playerCount)
            const maxPlayers = Number(lobby.maxPlayers)
            
            // Determine lobby status
            let isActive = false
            let statusText = ""
            if (status === 0) { // OPEN
              isActive = playerCount < maxPlayers
              statusText = playerCount === 0 ? "Waiting for players" : `${playerCount}/${maxPlayers} players`
            } else if (status === 1) { // FULL
              isActive = false
              statusText = "Full - Game starting"
            } else if (status === 2) { // IN_PROGRESS
              isActive = false
              statusText = "Game in progress"
            } else if (status === 3) { // COMPLETED
              isActive = false
              statusText = "Completed"
            } else if (status === 4) { // CANCELLED
              isActive = false
              statusText = "Cancelled"
            }

            // Check if current user is in this lobby
            let isUserInLobby = false
            if (account) {
              try {
                isUserInLobby = await readContract.isPlayerInLobby(i, account)
                console.log(`User ${account} in lobby ${i}:`, isUserInLobby)
              } catch (err) {
                console.error(`Error checking if user in lobby ${i}:`, err)
              }
            }

            fetched.push({
              id: String(lobby.id),
              name: lobby.name,
              category: lobby.category,
              mode: `🎯 ${lobby.name}`,
              entryFee: entryFeeCFX,
              currentPlayers: playerCount,
              maxPlayers: maxPlayers,
              isActive: isActive,
              creator: lobby.creator,
              status: statusText,
              isUserInLobby: isUserInLobby,
            })
          } catch (err) {
            console.error(`Error fetching lobby ${i}:`, err)
          }
        }
        setLobbies(fetched)
        setDebugInfo(`Loaded ${fetched.length} lobbies`)
      } catch (error) {
        console.error("Error fetching lobbies:", error)
        setDebugInfo(`Error: ${error}`)
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

    // If user is already in this lobby, they should use the "Enter Lobby" button instead
    if (lobby.isUserInLobby) {
      console.log("User is already in lobby, should use Enter Lobby button:", lobby.id)
      return
    }

    // Check if lobby is full (only for new players)
    if (lobby.currentPlayers >= lobby.maxPlayers) {
      alert("This lobby is full!")
      return
    }

    // Check if lobby is not active (only for new players)
    if (!lobby.isActive) {
      alert("This lobby is not accepting new players right now")
      return
    }

    setJoiningLobby(lobby.id)

    try {
      if (false) { // Always use real contract
        // Development mode - simulate transaction
        console.log("[v0] Development mode: Simulating lobby join...")
        await new Promise((resolve) => setTimeout(resolve, 2000))
        console.log("[v0] Simulated transaction confirmed")

        // Show success message and refresh
        alert(`Successfully joined "${lobby.name}"! You paid ${lobby.entryFee} CFX entry fee. Waiting for other players to join...`)
        window.location.reload()
      } else {
        // Real contract interaction
        const contract = new ethers.Contract(CONTRACT_ADDRESSES.QUIZ_CRAFT_ARENA, QUIZ_CRAFT_ARENA_ABI, signer)
        const entryFeeWei = ethers.parseEther(lobby.entryFee)

        console.log("Joining lobby:", {
          lobbyId: lobby.id,
          lobbyName: lobby.name,
          entryFee: lobby.entryFee,
          entryFeeWei: entryFeeWei.toString(),
          contractAddress: CONTRACT_ADDRESSES.QUIZ_CRAFT_ARENA
        })

        const tx = await contract.joinLobby(lobby.id, {
          value: entryFeeWei,
        })

        console.log("Transaction sent:", tx.hash)
        console.log("Transaction details:", {
          to: tx.to,
          value: tx.value?.toString(),
          gasLimit: tx.gasLimit?.toString(),
          gasPrice: tx.gasPrice?.toString()
        })
        
        const receipt = await tx.wait()
        console.log("Transaction confirmed:", receipt)

        // Show success message
        alert(`Successfully joined "${lobby.name}"! You paid ${lobby.entryFee} CFX entry fee. Waiting for other players to join...`)
        
        // Refresh the page to update lobby status
        window.location.reload()
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

  const createLobby = async () => {
    if (!signer || !isConnected) {
      alert("Please connect your wallet first")
      return
    }

    // Validate form data
    if (!lobbyForm.name.trim()) {
      alert("Lobby name cannot be empty")
      return
    }

    if (!lobbyForm.category.trim()) {
      alert("Category cannot be empty")
      return
    }

    const entryFee = parseFloat(lobbyForm.entryFee)
    if (isNaN(entryFee) || entryFee <= 0) {
      alert("Please enter a valid entry fee greater than 0")
      return
    }

    const maxPlayers = parseInt(lobbyForm.maxPlayers)
    if (isNaN(maxPlayers) || maxPlayers < 2 || maxPlayers > 10) {
      alert("Please enter a valid number of players between 2 and 10")
      return
    }

    setCreatingLobby(true)
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESSES.QUIZ_CRAFT_ARENA, QUIZ_CRAFT_ARENA_ABI, signer)
      
      // Convert entry fee to wei
      const entryFeeWei = ethers.parseEther(lobbyForm.entryFee)
      
      const tx = await contract.createLobby(lobbyForm.name.trim(), lobbyForm.category.trim(), entryFeeWei, maxPlayers)
      console.log("Create lobby transaction sent:", tx.hash)
      await tx.wait()
      console.log("Lobby created successfully")
      
      // Show success modal
      setCreatedLobbyName(lobbyForm.name)
      setIsSuccessModalOpen(true)
      
      // Reset form and close create modal
      setLobbyForm({ name: "", category: "", entryFee: "", maxPlayers: "2" })
      setIsCreateModalOpen(false)
      
      // Refresh lobbies
      window.location.reload()
    } catch (error: any) {
      console.error("Error creating lobby:", error)
      alert(`Failed to create lobby: ${error.message || "Please try again."}`)
    } finally {
      setCreatingLobby(false)
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

  if (!isOnConflux) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto text-center">
          <Card className="border-2 border-accent/20">
            <CardContent className="py-16">
              <div className="w-20 h-20 bg-gradient-to-br from-accent to-secondary rounded-2xl flex items-center justify-center mx-auto mb-6 animate-pulse-glow">
                <Shield className="h-10 w-10 text-white" />
              </div>
              <h2 className="font-montserrat font-bold text-3xl mb-4">Wrong Network</h2>
              <p className="text-xl text-muted-foreground mb-8">
                Please switch to {CONFLUX_TESTNET.name} (Chain ID {CONFLUX_TESTNET.chainId}) to join the arena.
              </p>
              <Button size="lg" onClick={switchToConflux}>Switch to {CONFLUX_TESTNET.name}</Button>
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
          
          {/* Debug info */}
          {debugInfo && (
            <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
              Debug: {debugInfo}
            </div>
          )}
          
          {/* Contract Info Debug */}
          <div className="mt-4 p-3 bg-blue-50 rounded-lg text-xs text-muted-foreground border">
            <div><strong>Contract Address:</strong> {CONTRACT_ADDRESSES.QUIZ_CRAFT_ARENA}</div>
            <div><strong>Network:</strong> {isOnConflux ? "Conflux eSpace Testnet" : "Wrong Network"}</div>
            <div><strong>Account:</strong> {account ? `${account.slice(0, 6)}...${account.slice(-4)}` : "Not Connected"}</div>
            <div><strong>Is Owner:</strong> {account && account.toLowerCase() === OWNER_ADDRESS.toLowerCase() ? "Yes" : "No"}</div>

          </div>
          
          {/* Create Lobby Button for Owner */}
          {account && account.toLowerCase() === OWNER_ADDRESS.toLowerCase() && (
            <div className="mt-6">
              <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create Custom Lobby (Owner Only)
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-yellow-500" />
                      Create New Lobby
                    </DialogTitle>
                    <DialogDescription>
                      Set up a new quiz lobby with custom settings. Only the contract owner can create lobbies.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="grid gap-4 py-4">
                    <div className="grid gap-2">
                      <Label htmlFor="lobby-name">Lobby Name</Label>
                      <Input
                        id="lobby-name"
                        placeholder="e.g., Lightning Duel, Battle Royale"
                        value={lobbyForm.name}
                        onChange={(e) => setLobbyForm({ ...lobbyForm, name: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="category">Quiz Category</Label>
                      <Select value={lobbyForm.category} onValueChange={(value) => setLobbyForm({ ...lobbyForm, category: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Technology">Technology</SelectItem>
                          <SelectItem value="Cryptocurrency">Cryptocurrency</SelectItem>
                          <SelectItem value="Science">Science</SelectItem>
                          <SelectItem value="History">History</SelectItem>
                          <SelectItem value="Sports">Sports</SelectItem>
                          <SelectItem value="Entertainment">Entertainment</SelectItem>
                          <SelectItem value="General Knowledge">General Knowledge</SelectItem>
                          <SelectItem value="Mathematics">Mathematics</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="entry-fee">Entry Fee (CFX)</Label>
                      <Input
                        id="entry-fee"
                        type="number"
                        step="0.1"
                        min="0.1"
                        placeholder="e.g., 1.0, 0.5, 2.0"
                        value={lobbyForm.entryFee}
                        onChange={(e) => setLobbyForm({ ...lobbyForm, entryFee: e.target.value })}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="max-players">Max Players</Label>
                      <Select value={lobbyForm.maxPlayers} onValueChange={(value) => setLobbyForm({ ...lobbyForm, maxPlayers: value })}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select max players" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="2">2 Players</SelectItem>
                          <SelectItem value="3">3 Players</SelectItem>
                          <SelectItem value="4">4 Players</SelectItem>
                          <SelectItem value="5">5 Players</SelectItem>
                          <SelectItem value="6">6 Players</SelectItem>
                          <SelectItem value="7">7 Players</SelectItem>
                          <SelectItem value="8">8 Players</SelectItem>
                          <SelectItem value="9">9 Players</SelectItem>
                          <SelectItem value="10">10 Players</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsCreateModalOpen(false)}
                      disabled={creatingLobby}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={createLobby}
                      disabled={creatingLobby}
                      className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                    >
                      {creatingLobby ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Creating...
                        </>
                      ) : (
                        <>
                          <Plus className="mr-2 h-4 w-4" />
                          Create Lobby
                        </>
                      )}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          )}

          {/* Success Modal */}
          <Dialog open={isSuccessModalOpen} onOpenChange={setIsSuccessModalOpen}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <div className="flex flex-col items-center text-center space-y-4">
                  <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center animate-pulse">
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  </div>
                  <DialogTitle className="text-2xl font-bold text-green-600">
                    Lobby Created Successfully!
                  </DialogTitle>
                  <DialogDescription className="text-lg">
                    Your lobby <span className="font-semibold text-gray-900">"{createdLobbyName}"</span> has been created and is now live in the arena.
                  </DialogDescription>
                </div>
              </DialogHeader>
              <div className="py-4">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2 text-green-800">
                    <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                    <span className="text-sm font-medium">Lobby is now accepting players</span>
                  </div>
                </div>
              </div>
              <div className="flex justify-center">
                <Button
                  onClick={() => setIsSuccessModalOpen(false)}
                  className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 px-8"
                >
                  <Trophy className="mr-2 h-4 w-4" />
                  Awesome!
                </Button>
              </div>
            </DialogContent>
          </Dialog>
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
                data-lobby-id={lobby.id}
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
                          <div className="flex items-center gap-2 mt-1">
                                                    {lobby.isUserInLobby && (
                          <Badge variant="default" className="bg-green-500 text-white">
                            You're in this lobby
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          Players: {lobby.currentPlayers}/{lobby.maxPlayers}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          InLobby: {lobby.isUserInLobby ? "Yes" : "No"}
                        </Badge>
                            {lobby.status && (
                              <Badge variant="outline" className="text-blue-600 border-blue-600">
                                {lobby.status}
                              </Badge>
                            )}
                            {!lobby.isActive && !lobby.isUserInLobby && (
                              <Badge variant="secondary">
                                {lobby.currentPlayers >= lobby.maxPlayers ? "Full" : "Not Joinable"}
                              </Badge>
                            )}
                          </div>
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

                    {(lobby.isUserInLobby || lobby.currentPlayers > 0) ? (
                      <Button
                        onClick={() => window.location.href = `/arena/${lobby.id}`}
                        size="lg"
                        className="h-14 px-8 text-lg font-semibold shadow-lg transition-all duration-300 bg-green-500 hover:bg-green-600 text-white"
                      >
                        <Swords className="mr-3 h-5 w-5" />
                        🚀 Enter Lobby
                      </Button>
                    ) : (
                      <Button
                        onClick={() => joinLobby(lobby)}
                        disabled={(!lobby.isActive && !lobby.isUserInLobby) || joiningLobby === lobby.id}
                        size="lg"
                        className="h-14 px-8 text-lg font-semibold shadow-lg transition-all duration-300 hover:shadow-accent/25"
                      >
                        {joiningLobby === lobby.id ? (
                          <>
                            <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                            Joining Battle...
                          </>
                        ) : (
                          <>
                            <Swords className="mr-3 h-5 w-5" />
                            Enter Battle ({lobby.entryFee} CFX)
                          </>
                        )}
                      </Button>
                    )}
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
