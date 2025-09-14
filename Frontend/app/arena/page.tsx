"use client"

import { useState, useEffect, useCallback } from "react"
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
import { Trophy, Users, Coins, Loader2, Swords, Crown, Zap, Shield, Plus, X, CheckCircle, AlertCircle, Info, RefreshCw, Clock } from "lucide-react"
import { useToast } from "@/components/ui/use-toast"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"

const OWNER_ADDRESS = "0xc3E894473BB51b5e5453042420A1d465E69cbCB9"

declare global {
  interface Window {
    ethereum?: any
  }
}

export default function ArenaPage() {
  const { signer, isConnected, isOnConflux, chainId, switchToConflux, account } = useWeb3()
  const { toast } = useToast()
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
  const [isAdminPanelOpen, setIsAdminPanelOpen] = useState(false)
  const [platformFee, setPlatformFee] = useState<number | null>(null)
  const [gameMaster, setGameMaster] = useState<string | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [updatingFee, setUpdatingFee] = useState(false)
  const [updatingGameMaster, setUpdatingGameMaster] = useState(false)
  const [updatingScores, setUpdatingScores] = useState<string | null>(null)
  const [newFee, setNewFee] = useState("")
  const [newGameMaster, setNewGameMaster] = useState("")

  // Function to update scores to blockchain (only for game master)
  const updateLobbyScores = async (lobbyId: string) => {
    if (!signer || !isConnected) {
      toast({ title: "Connect wallet", description: "Please connect your wallet to update scores.", variant: "destructive" })
      return
    }

    setUpdatingScores(lobbyId)
    try {
      // First, collect all player scores
      const collectedData = collectAllPlayerScores(lobbyId)
      if (!collectedData) {
        toast({ title: "No scores found", description: "No pending scores found for this lobby.", variant: "destructive" })
        return
      }

      const { players, scores, allPlayerScores, detailedResults } = collectedData
      
      console.log("Updating scores for lobby:", lobbyId)
      console.log("Players:", players)
      console.log("Scores:", scores)
      console.log("All player scores:", allPlayerScores)
      console.log("Detailed results:", detailedResults)
      
      // Submit scores to smart contract
      const contract = new ethers.Contract(
        CONTRACT_ADDRESSES.QUIZ_CRAFT_ARENA,
        QUIZ_CRAFT_ARENA_ABI,
        signer
      )

      // Note: The new contract doesn't have submitScores or setLeaderboard functions
      // Scores are now managed off-chain and only used for winner determination
      console.log("Scores collected for lobby:", lobbyId)
      console.log("Players:", players)
      console.log("Scores:", scores)
      
      // Create leaderboard based on scores (for display purposes)
      const leaderboard = players
        .map((addr: string, i: number) => ({ addr, score: Number(scores[i] || 0) }))
        .sort((a: { addr: string; score: number }, b: { addr: string; score: number }) => b.score - a.score)
        .map((x: { addr: string; score: number }) => x.addr)
      
      console.log("Leaderboard created:", leaderboard)

      // Update local status after full confirmation
      const updatedScoresData = { ...collectedData, status: 'confirmed', leaderboard }
      localStorage.setItem(`quizcraft:lobby-scores:${lobbyId}`, JSON.stringify(updatedScoresData))

      const playerCount = players.length
      const totalScore = scores.reduce((sum: number, score: number) => sum + score, 0)
      toast({ 
        title: "All Scores Updated", 
        description: `${playerCount} players' scores (${totalScore} total points) and leaderboard updated on-chain.`, 
        duration: 4000 
      })
      
      // Refresh lobbies to show updated status
      fetchLobbies()
      
    } catch (error: any) {
      console.error("Error updating scores:", error)
      toast({ title: "Update Failed", description: error.message || "Failed to update scores.", variant: "destructive" })
    } finally {
      setUpdatingScores(null)
    }
  }

  // Check if lobby has pending scores
  const hasPendingScores = (lobbyId: string) => {
    try {
      const scoresData = localStorage.getItem(`quizcraft:lobby-scores:${lobbyId}`)
      if (!scoresData) return false
      const { status } = JSON.parse(scoresData)
      return status === 'pending'
    } catch {
      return false
    }
  }

  // Collect and merge scores from all players
  const collectAllPlayerScores = (lobbyId: string) => {
    try {
      // Get the main lobby scores
      const lobbyScoresData = localStorage.getItem(`quizcraft:lobby-scores:${lobbyId}`)
      if (!lobbyScoresData) return null
      
      const lobbyData = JSON.parse(lobbyScoresData)
      const allPlayerScores = { ...(lobbyData.allPlayerScores || {}) }
      
      // Collect individual player contributions
      const players = lobbyData.players || []
      players.forEach((player: string) => {
        const playerContributionKey = `quizcraft:player-contribution:${lobbyId}:${player}`
        const playerContribution = localStorage.getItem(playerContributionKey)
        if (playerContribution) {
          const contribution = JSON.parse(playerContribution)
          allPlayerScores[player] = contribution.score
          console.log(`Collected score for ${player}: ${contribution.score}`)
        }
      })
      
      // Update the lobby data with collected scores
      const updatedLobbyData = {
        ...lobbyData,
        allPlayerScores: allPlayerScores,
        scores: players.map((p: string) => allPlayerScores[p] || 0)
      }
      
      // Save the updated data
      localStorage.setItem(`quizcraft:lobby-scores:${lobbyId}`, JSON.stringify(updatedLobbyData))
      console.log('Collected all player scores:', updatedLobbyData)
      
      return updatedLobbyData
    } catch (error) {
      console.error('Error collecting player scores:', error)
      return null
    }
  }

  // Check if scores are confirmed (ready to resolve)
  const hasConfirmedScores = (lobbyId: string) => {
    try {
      const scoresData = localStorage.getItem(`quizcraft:lobby-scores:${lobbyId}`)
      if (!scoresData) return false
      const { status } = JSON.parse(scoresData)
      return status === 'confirmed'
    } catch {
      return false
    }
  }

  // Resolve and distribute prize (only game master)
  const resolveLobbyPrize = async (lobbyId: string) => {
    if (!account || !gameMaster || account.toLowerCase() !== gameMaster.toLowerCase()) {
      toast({ title: "Unauthorized", description: "Only the game master can resolve.", variant: "destructive" })
      return
    }
    try {
      const raw = localStorage.getItem(`quizcraft:lobby-scores:${lobbyId}`)
      if (!raw) {
        toast({ title: "No leaderboard", description: "No leaderboard found for this lobby.", variant: "destructive" })
        return
      }
      const data = JSON.parse(raw)
      const top = Array.isArray(data.leaderboard) && data.leaderboard.length > 0 ? data.leaderboard[0] : null
      if (!top) {
        toast({ title: "No winner", description: "Leaderboard is missing or empty.", variant: "destructive" })
        return
      }
      const response = await fetch('/api/resolve-game', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.NEXT_PUBLIC_RESOLVE_GAME_API_KEY || 'default-secret'}`
        },
        body: JSON.stringify({ lobbyId, winnerAddress: top })
      })
      if (response.ok) {
        const result = await response.json()
        toast({ title: 'Game Resolved', description: `Prize distributed. Tx: ${result.transactionHash}`, duration: 5000 })
      } else {
        const error = await response.json()
        toast({ title: 'Resolve failed', description: error.error || 'Unable to resolve.', variant: 'destructive' })
      }
    } catch (e: any) {
      toast({ title: 'Resolve failed', description: e?.message || 'Unable to resolve.', variant: 'destructive' })
    }
  }

  const fetchLobbies = useCallback(async () => {
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
          console.log(`Lobby ${i} raw data:`, lobby)
          
          // Fix field mapping - ABI is missing players array field
          // Smart contract struct: [id, name, category, entryFee, playerCount, maxPlayers, prizePool, createdAt, status, distribution, players, winner, creator]
          // ABI has: [id, name, category, entryFee, playerCount, maxPlayers, prizePool, createdAt, status, distribution, winner, creator]
          // So winner is at index 10, creator is at index 11
          const creatorAddress = lobby[11] // creator is at index 11 (not 12 due to missing players array)
          const winnerAddress = lobby[10] // winner is at index 10 (not 11 due to missing players array)
          
          console.log(`Lobby ${i} creator (index 11):`, creatorAddress)
          console.log(`Lobby ${i} winner (index 10):`, winnerAddress)
          
          // lobby: { id, name, category, entryFee, playerCount, maxPlayers, prizePool, createdAt, status, distribution, players, winner, creator }
          const entryFeeCFX = ethers.formatEther(lobby.entryFee)
          const status = Number(lobby.status)
          const playerCount = Number(lobby.playerCount)
          const maxPlayers = Number(lobby.maxPlayers)
          
          // Check if lobby is expired
          const currentTime = Math.floor(Date.now() / 1000)
          const lobbyCreatedAt = Number(lobby.createdAt)
          const isExpired = currentTime >= lobbyCreatedAt + (5 * 60) // 5 minutes timeout

          // Determine lobby status
          let isActive = false
          let statusText = ""
          if (status === 0) { // OPEN
            isActive = !isExpired && playerCount < maxPlayers
            statusText = isExpired ? "Expired" : (playerCount === 0 ? "Waiting for players" : `${playerCount}/${maxPlayers} players`)
          } else if (status === 1) { // STARTED
            isActive = !isExpired && playerCount < maxPlayers
            statusText = isExpired ? "Expired" : `${playerCount}/${maxPlayers} players`
          } else if (status === 2) { // IN_PROGRESS
            isActive = false
            statusText = isExpired ? "Expired" : "Game in progress"
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
            isExpired: isExpired,
            creator: creatorAddress, // Use correct creator address from index 11
            status: statusText,
            isUserInLobby: isUserInLobby,
          })
        } catch (err) {
          console.error(`Error fetching lobby ${i}:`, err)
        }
      }
      setLobbies(fetched)
      setDebugInfo(`Loaded ${fetched.length} lobbies`)

      // Check if current account is owner and fetch admin data
      if (account) {
        try {
          const owner = await readContract.owner()
          const isOwnerAccount = owner.toLowerCase() === account.toLowerCase()
          setIsOwner(isOwnerAccount)

          if (isOwnerAccount) {
            // Note: The new contract doesn't have platformFeeBps or gameMaster functions
            // These are now managed differently in the new contract
            console.log("Owner account detected, but platform fee and game master functions not available in new contract")
            setPlatformFee(null)
            setGameMaster(null)
          }
        } catch (err) {
          console.error("Error fetching admin data:", err)
        }
      }
    } catch (error) {
      console.error("Error fetching lobbies:", error)
      setDebugInfo(`Error: ${error}`)
      setLobbies([])
    } finally {
      setLoading(false)
    }
  }, [account])

  useEffect(() => {
    setLoading(true)
    fetchLobbies()
  }, [fetchLobbies, isConnected, isOnConflux])

  // Listen to contract events for live updates (no page reload)
  useEffect(() => {
    if (!isConnected || !isOnConflux) return

    let contract: ethers.Contract | null = null
    let debounceTimer: any = null
    const events = [
      'LobbyCreated',
      'PlayerJoined', 
      'LobbyCompleted',
      'LobbyCancelled',
      'RefundClaimed',
      'FeeUpdated',
      'GameMasterUpdated'
    ]

    const triggerRefresh = () => {
      clearTimeout(debounceTimer)
      debounceTimer = setTimeout(() => {
        // Re-fetch lobbies without full reload
        (async () => {
          try {
            setLoading(true)
            const provider = new ethers.BrowserProvider(window.ethereum)
            const readContract = new ethers.Contract(
              CONTRACT_ADDRESSES.QUIZ_CRAFT_ARENA,
              QUIZ_CRAFT_ARENA_ABI,
              provider
            )
            const nextLobbyId: bigint = await readContract.nextLobbyId()
            const lobbyCount = Number(nextLobbyId)
            const fetched: Lobby[] = []
            for (let i = 0; i < lobbyCount; i++) {
              try {
                const lobby = await readContract.lobbies(i)
                const entryFeeCFX = ethers.formatEther(lobby.entryFee)
                const status = Number(lobby.status)
                const playerCount = Number(lobby.playerCount)
                const maxPlayers = Number(lobby.maxPlayers)
                let isActive = false
                let statusText = ""
                if (status === 0) { isActive = playerCount < maxPlayers; statusText = playerCount === 0 ? "Waiting for players" : `${playerCount}/${maxPlayers} players` }
                else if (status === 1) { statusText = "Full - Game starting" }
                else if (status === 2) { statusText = "Game in progress" }
                else if (status === 3) { statusText = "Completed" }
                else if (status === 4) { statusText = "Cancelled" }
                let isUserInLobby = false
                if (account) {
                  try { isUserInLobby = await readContract.isPlayerInLobby(i, account) } catch {}
                }
                // Fix field mapping - ABI is missing players array field
                const creatorAddress = lobby[11] // creator is at index 11 (not 12 due to missing players array)
                
                fetched.push({
                  id: String(lobby.id),
                  name: lobby.name,
                  category: lobby.category,
                  mode: `🎯 ${lobby.name}`,
                  entryFee: entryFeeCFX,
                  currentPlayers: playerCount,
                  maxPlayers,
                  isActive,
                  creator: creatorAddress, // Use correct creator address from index 11
                  status: statusText,
                  isUserInLobby,
                })
              } catch {}
            }
            setLobbies(fetched)
          } finally {
            setLoading(false)
          }
        })()
      }, 2000) // Increased debounce to 2 seconds to reduce rate limiting
    }

    const setupEventListeners = async () => {
      try {
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 2000))
        
        const provider = new ethers.BrowserProvider(window.ethereum)
        contract = new ethers.Contract(
          CONTRACT_ADDRESSES.QUIZ_CRAFT_ARENA,
          QUIZ_CRAFT_ARENA_ABI,
          provider
        )
        
        // Set up event listeners with error handling
        events.forEach(eventName => {
          contract!.on(eventName, (...args) => {
            console.log(`Event ${eventName}:`, args)
            triggerRefresh()
          })
        })
        
        console.log("Event listeners set up successfully")
      } catch (error: any) {
        console.error("Error setting up event listeners:", error)
        
        // Handle rate limiting specifically
        if (error.code === -32005 || error.message?.includes('rate exceeded') || error.message?.includes('Too many requests')) {
          console.warn("Rate limited, falling back to periodic refresh")
          // Fallback to periodic refresh instead of events
          const fallbackInterval = setInterval(() => {
            console.log("Fallback: Refreshing lobbies periodically")
            fetchLobbies()
          }, 30000) // Refresh every 30 seconds
          
          return () => clearInterval(fallbackInterval)
        }
      }
    }

    // Temporarily disable event listeners to avoid rate limiting
    // setupEventListeners()
    
    // Use periodic refresh instead
    const refreshInterval = setInterval(() => {
      console.log("Periodic refresh: Updating lobbies")
      fetchLobbies()
    }, 30000) // Refresh every 30 seconds

    return () => {
      clearTimeout(debounceTimer)
      clearInterval(refreshInterval)
      if (contract) {
        try {
          events.forEach(eventName => { 
            contract!.off(eventName) 
          })
        } catch (error) {
          console.warn("Error cleaning up event listeners:", error)
        }
      }
    }
  }, [isConnected, isOnConflux, account, fetchLobbies])

  const joinLobby = async (lobby: Lobby) => {
    if (!signer || !isConnected) {
      toast({ title: "Connect wallet", description: "Please connect your wallet to join.", variant: "destructive" })
      return
    }

    // If user is already in this lobby, they should use the "Enter Lobby" button instead
    if (lobby.isUserInLobby) {
      console.log("User is already in lobby, should use Enter Lobby button:", lobby.id)
      return
    }

    // Check if lobby is full (only for new players)
    if (lobby.currentPlayers >= lobby.maxPlayers) {
      toast({ title: "Lobby is full", description: "Please choose another lobby.", variant: "destructive" })
      return
    }

    // Check if lobby is not active - redirect to view instead of blocking
    if (!lobby.isActive) {
      // Redirect to view the lobby (for expired/completed lobbies - open to anyone)
      window.location.href = `/arena/${lobby.id}`
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

        // Enhanced success toast with transaction link
        toast({ 
          title: "🎯 Joined Lobby Successfully!", 
          description: `Entered "${lobby.name}" (${lobby.entryFee} CFX entry fee)`,
          duration: 4000,
          action: (
            <a 
              href={`https://evmtestnet.confluxscan.org/tx/${tx.hash}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-600 hover:text-blue-800 underline text-sm"
            >
              View Transaction
            </a>
          )
        })
        // Persist joined flag for smoother navigation to lobby page
        try {
          if (account) sessionStorage.setItem(`quizcraft:joined:${lobby.id}:${account.toLowerCase()}`, 'true')
        } catch {}
        // Optimistically mark as in lobby
        setLobbies(prev => prev.map(l => l.id === lobby.id ? { ...l, isUserInLobby: true, currentPlayers: l.currentPlayers + 1 } : l))
        // Navigate to lobby after a short delay
        setTimeout(() => { window.location.href = `/arena/${Number(lobby.id)}` }, 300)
      }
    } catch (error: any) {
      console.error("Error joining lobby:", error)

      if (error.code === "ACTION_REJECTED") {
        toast({ title: "Transaction rejected", description: "You cancelled the join.", variant: "destructive" })
      } else if (error.code === "INSUFFICIENT_FUNDS") {
        toast({ title: "Insufficient funds", description: "Not enough CFX to cover entry fee.", variant: "destructive" })
      } else {
        toast({ title: "Join failed", description: "Please try again.", variant: "destructive" })
      }
    } finally {
      setJoiningLobby(null)
    }
  }

  const createLobby = async () => {
    if (!signer || !isConnected) {
      toast({ title: "Connect wallet", description: "Please connect your wallet to create a lobby.", variant: "destructive" })
      return
    }

    // Validate form data
    if (!lobbyForm.name.trim()) {
      toast({ title: "Invalid name", description: "Lobby name cannot be empty.", variant: "destructive" })
      return
    }

    if (!lobbyForm.category.trim()) {
      toast({ title: "Invalid category", description: "Please select a quiz category.", variant: "destructive" })
      return
    }

    const entryFee = parseFloat(lobbyForm.entryFee)
    if (isNaN(entryFee) || entryFee <= 0) {
      toast({ title: "Invalid entry fee", description: "Enter a fee greater than 0.", variant: "destructive" })
      return
    }

    const maxPlayers = parseInt(lobbyForm.maxPlayers)
    if (isNaN(maxPlayers) || maxPlayers < 2 || maxPlayers > 10) {
      toast({ title: "Invalid players", description: "Players must be between 2 and 10.", variant: "destructive" })
      return
    }

    setCreatingLobby(true)
    try {
      const contract = new ethers.Contract(CONTRACT_ADDRESSES.QUIZ_CRAFT_ARENA, QUIZ_CRAFT_ARENA_ABI, signer)
      
      // Convert entry fee to wei
      const entryFeeWei = ethers.parseEther(lobbyForm.entryFee)
      
      const tx = await contract.createLobby(lobbyForm.name.trim(), lobbyForm.category.trim(), entryFeeWei, maxPlayers)
      console.log("Create lobby transaction sent:", tx.hash)
      const receipt = await tx.wait()
      console.log("Lobby created successfully")
      
      // Enhanced success toast with transaction link
      toast({ 
        title: "🎉 Lobby Created Successfully!", 
        description: `"${lobbyForm.name}" is now live and ready for players.`,
        duration: 5000,
        action: (
          <a 
            href={`https://evmtestnet.confluxscan.org/tx/${tx.hash}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 underline text-sm"
          >
            View on Explorer
          </a>
        )
      })
      
      // Show success modal
      setCreatedLobbyName(lobbyForm.name)
      setIsSuccessModalOpen(true)
      
      // Reset form and close create modal
      setLobbyForm({ name: "", category: "", entryFee: "", maxPlayers: "2" })
      setIsCreateModalOpen(false)
      
      // Auto-refresh lobbies to show the new lobby with loading state
      setTimeout(() => {
        fetchLobbies()
      }, 2000) // Wait 2 seconds for blockchain to update
    } catch (error: any) {
      console.error("Error creating lobby:", error)
      toast({ title: "Create failed", description: error.message || "Please try again.", variant: "destructive" })
    } finally {
      setCreatingLobby(false)
    }
  }

  const updatePlatformFee = async () => {
    if (!signer || !isOwner) return
    const fee = parseInt(newFee)
    if (isNaN(fee) || fee < 0 || fee > 1000) {
      toast({ title: "Invalid fee", description: "Fee must be 0-1000 bps (0-10%).", variant: "destructive" })
      return
    }
    setUpdatingFee(true)
    try {
      // Note: The new contract doesn't have updatePlatformFee function
      // Platform fees are now managed differently in the new contract
      console.log("Platform fee update requested:", fee)
      toast({ title: "Fee update not available", description: "Platform fee management is not available in the new contract." })
    } catch (error: any) {
      console.error("Error updating fee:", error)
      toast({ title: "Update failed", description: error.message, variant: "destructive" })
    } finally {
      setUpdatingFee(false)
    }
  }

  const updateGameMaster = async () => {
    if (!signer || !isOwner) return
    if (!newGameMaster || !ethers.isAddress(newGameMaster)) {
      toast({ title: "Invalid address", description: "Please enter a valid address.", variant: "destructive" })
      return
    }
    setUpdatingGameMaster(true)
    try {
      // Note: The new contract doesn't have updateGameMaster function
      // Game master is now managed differently in the new contract
      console.log("Game master update requested:", newGameMaster)
      toast({ title: "Game master update not available", description: "Game master management is not available in the new contract." })
    } catch (error: any) {
      console.error("Error updating game master:", error)
      toast({ title: "Update failed", description: error.message, variant: "destructive" })
    } finally {
      setUpdatingGameMaster(false)
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
          <p className="text-xl text-muted-foreground max-w-3xl mx-auto mb-6">
            Enter competitive lobbies and battle other players for CFX rewards. Winner takes all!
          </p>
          
          {/* Manual refresh button */}
          <Button
            onClick={() => {
              console.log("Manual refresh triggered")
              fetchLobbies()
            }}
            variant="outline"
            size="sm"
            className="mb-4"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Refreshing...' : 'Refresh Lobbies'}
          </Button>
          
          {/* Debug info */}
          {debugInfo && (
            <div className="mt-4 p-3 bg-muted/50 rounded-lg text-sm text-muted-foreground">
              Debug: {debugInfo}
            </div>
          )}
          
          
          {/* Admin Panel Button for Owner */}
          {isOwner && (
            <div className="mt-6">
              <Button
                onClick={() => setIsAdminPanelOpen(true)}
                size="lg"
                className="bg-gradient-to-r from-purple-500 to-indigo-500 hover:from-purple-600 hover:to-indigo-600"
              >
                <Shield className="mr-2 h-4 w-4" />
                Admin Panel
              </Button>
            </div>
          )}

          {/* Create Lobby Button for All Users */}
          {account && (
            <div className="mt-6">
              <Dialog open={isCreateModalOpen} onOpenChange={setIsCreateModalOpen}>
                <DialogTrigger asChild>
                  <Button
                    size="lg"
                    className="bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600"
                  >
                    <Plus className="mr-2 h-4 w-4" />
                    Create New Lobby
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[425px]">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <Trophy className="h-5 w-5 text-yellow-500" />
                      Create New Lobby
                    </DialogTitle>
                    <DialogDescription>
                      Set up a new quiz lobby with custom settings. Anyone can create lobbies.
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
                          <SelectItem value="Conflux Network">Conflux Network</SelectItem>
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

          {/* Admin Panel Dialog */}
          <Dialog open={isAdminPanelOpen} onOpenChange={setIsAdminPanelOpen}>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2">
                  <Shield className="h-5 w-5 text-purple-500" />
                  Admin Panel
                </DialogTitle>
                <DialogDescription>
                  Manage platform settings and game master. Only the contract owner can make changes.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-6 py-4">
                {/* Current Settings */}
                <div className="space-y-3">
                  <h4 className="font-semibold">Current Settings</h4>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Platform Fee</p>
                      <p className="font-semibold">{platformFee !== null ? `${platformFee} bps (${(platformFee / 100).toFixed(1)}%)` : "Loading..."}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Game Master</p>
                      <p className="font-semibold text-xs break-all">{gameMaster || "Loading..."}</p>
                    </div>
                  </div>
                </div>

                {/* Update Platform Fee */}
                <div className="space-y-3">
                  <h4 className="font-semibold">Update Platform Fee</h4>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      placeholder="New fee (0-1000 bps)"
                      value={newFee}
                      onChange={(e) => setNewFee(e.target.value)}
                      min="0"
                      max="1000"
                    />
                    <Button
                      onClick={updatePlatformFee}
                      disabled={updatingFee || !newFee}
                      size="sm"
                    >
                      {updatingFee ? "Updating..." : "Update"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Fee in basis points (100 bps = 1%)
                  </p>
                </div>

                {/* Update Game Master */}
                <div className="space-y-3">
                  <h4 className="font-semibold">Update Game Master</h4>
                  <div className="flex gap-2">
                    <Input
                      placeholder="New game master address"
                      value={newGameMaster}
                      onChange={(e) => setNewGameMaster(e.target.value)}
                    />
                    <Button
                      onClick={updateGameMaster}
                      disabled={updatingGameMaster || !newGameMaster}
                      size="sm"
                    >
                      {updatingGameMaster ? "Updating..." : "Update"}
                    </Button>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Enter a valid Ethereum address
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => setIsAdminPanelOpen(false)}
                >
                  Close
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="grid gap-6">
            {[...Array(4)].map((_, i) => (
              <Card key={i} className="border-2 border-muted/20 overflow-hidden">
                <CardContent className="p-8 relative">
                  <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/10 to-transparent animate-[shimmer_1.6s_infinite]" />
                  <div className="space-y-5">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 bg-muted rounded-xl" />
                      <div className="space-y-2">
                        <div className="h-6 w-56 bg-muted rounded" />
                        <div className="h-4 w-80 bg-muted/80 rounded" />
                      </div>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                      <div className="h-5 w-36 bg-muted rounded" />
                      <div className="h-5 w-28 bg-muted rounded" />
                      <div className="h-5 w-32 bg-muted rounded" />
                    </div>
                    <div className="h-12 w-40 bg-muted rounded-lg" />
                  </div>
                </CardContent>
              </Card>
            ))}
            <style jsx global>{`
              @keyframes shimmer { 100% { transform: translateX(100%); } }
            `}</style>
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
                aria-label={`Lobby ${lobby.name}`}
              >
                <div
                  className={`absolute inset-0 bg-gradient-to-br ${getLobbyGradient(lobby.mode)} rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`}
                  aria-hidden
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
                              <Badge variant="default" className="bg-green-500 text-white" aria-label="You're in this lobby">
                                You're in this lobby
                              </Badge>
                            )}
                            <Badge variant="outline" className="text-xs" aria-label={`Players ${lobby.currentPlayers} of ${lobby.maxPlayers}`}>
                              Players: {lobby.currentPlayers}/{lobby.maxPlayers}
                            </Badge>
                            {lobby.status && (
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger asChild>
                                    <Badge
                                      variant="outline"
                                      className={`text-xs ${
                                        lobby.status.includes('Full') ? 'text-amber-600 border-amber-600' :
                                        lobby.status.includes('Completed') ? 'text-purple-700 border-purple-700' :
                                        lobby.status.includes('progress') ? 'text-blue-700 border-blue-700' :
                                        'text-slate-600 border-slate-600'
                                      }`}
                                      aria-label={`Status ${lobby.status}`}
                                    >
                                      {lobby.status}
                                    </Badge>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Lobby status: {lobby.status}</p>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                            )}
                            {!lobby.isActive && !lobby.isUserInLobby && (
                              <Badge variant="secondary" aria-label={lobby.currentPlayers >= lobby.maxPlayers ? 'Full' : 'Viewable by All'}>
                                {lobby.currentPlayers >= lobby.maxPlayers ? "Full" : "Viewable by All"}
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

                    <div className="flex flex-col gap-3">
                      
                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        {lobby.isUserInLobby ? (
                          <Button
                            onClick={() => window.location.href = `/arena/${Number(lobby.id)}`}
                            size="lg"
                            className="h-14 px-8 text-lg font-semibold shadow-lg transition-all duration-300 bg-green-500 hover:bg-green-600 text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-green-600"
                            aria-label={`Enter lobby ${lobby.name}`}
                          >
                            <Swords className="mr-3 h-5 w-5" />
                            🚀 Enter Lobby
                          </Button>
                        ) : (
                          <Button
                            onClick={() => lobby.isActive ? joinLobby(lobby) : window.location.href = `/arena/${Number(lobby.id)}`}
                            disabled={joiningLobby === lobby.id}
                            size="lg"
                            className="h-14 px-8 text-lg font-semibold shadow-lg transition-all duration-300 hover:shadow-accent/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-accent"
                            aria-label={lobby.isActive ? `Join lobby ${lobby.name} for ${lobby.entryFee} CFX` : `View results for lobby ${lobby.name}`}
                          >
                            {joiningLobby === lobby.id ? (
                              <>
                                <Loader2 className="mr-3 h-5 w-5 animate-spin" />
                                Joining Battle...
                              </>
                            ) : (
                              <>
                                {lobby.isActive ? (
                                  <>
                                    <Swords className="mr-3 h-5 w-5" />
                                    Enter Battle ({lobby.entryFee} CFX)
                                  </>
                                ) : (
                                  <>
                                    <Trophy className="mr-3 h-5 w-5" />
                                    View Results (Open to All)
                                  </>
                                )}
                              </>
                            )}
                          </Button>
                        )}
                        
                        {/* Update Scores Button (only for game master) */}
                        {hasPendingScores(lobby.id) && account && gameMaster && account.toLowerCase() === gameMaster.toLowerCase() && (
                          <Button
                            onClick={() => updateLobbyScores(lobby.id)}
                            disabled={updatingScores === lobby.id}
                            size="lg"
                            variant="outline"
                            className="h-14 px-6 text-lg font-semibold border-amber-500 text-amber-600 hover:bg-amber-50"
                            aria-label={`Update scores for lobby ${lobby.name}`}
                          >
                            {updatingScores === lobby.id ? (
                              <>
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                Updating...
                              </>
                            ) : (
                              <>
                                <Trophy className="mr-2 h-5 w-5" />
                                Update Scores
                              </>
                            )}
                          </Button>
                        )}

                        {/* Resolve & Distribute Prize (only for game master, after confirmation) */}
                        {hasConfirmedScores(lobby.id) && account && gameMaster && account.toLowerCase() === gameMaster.toLowerCase() && (
                          <Button
                            onClick={() => resolveLobbyPrize(lobby.id)}
                            size="lg"
                            className="h-14 px-6 text-lg font-semibold bg-purple-600 hover:bg-purple-700 text-white"
                            aria-label={`Resolve and distribute prize for lobby ${lobby.name}`}
                          >
                            <Trophy className="mr-2 h-5 w-5" />
                            Resolve & Distribute
                          </Button>
                        )}
                      </div>
                    </div>
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
