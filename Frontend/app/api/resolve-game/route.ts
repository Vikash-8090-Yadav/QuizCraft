import { type NextRequest, NextResponse } from "next/server"
import { ethers } from "ethers"
import { CONTRACT_ADDRESSES, QUIZ_CRAFT_ARENA_ABI } from "@/lib/contracts"

// GameMaster private key (in production, use environment variable)
const GAMEMASTER_PRIVATE_KEY = process.env.GAMEMASTER_PRIVATE_KEY
const CONFLUX_RPC_URL = process.env.CONFLUX_RPC_URL || "https://evmtestnet.confluxrpc.com"

export async function POST(request: NextRequest) {
  try {
    // Verify API key for security
    const authHeader = request.headers.get("authorization")
    const expectedAuth = `Bearer ${process.env.RESOLVE_GAME_API_KEY || "default-secret"}`
    
    if (authHeader !== expectedAuth) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    if (!GAMEMASTER_PRIVATE_KEY) {
      return NextResponse.json({ error: "GameMaster private key not configured" }, { status: 500 })
    }

    const { lobbyId, winnerAddress } = await request.json()

    if (!lobbyId || !winnerAddress) {
      return NextResponse.json({ error: "Missing lobbyId or winnerAddress" }, { status: 400 })
    }

    // Create provider and wallet for gameMaster
    const provider = new ethers.JsonRpcProvider(CONFLUX_RPC_URL)
    const gameMasterWallet = new ethers.Wallet(GAMEMASTER_PRIVATE_KEY, provider)
    
    // Create contract instance with gameMaster wallet
    const contract = new ethers.Contract(
      CONTRACT_ADDRESSES.QUIZ_CRAFT_ARENA,
      QUIZ_CRAFT_ARENA_ABI,
      gameMasterWallet
    )

    // Call resolveGame on-chain
    const tx = await contract.resolveGame(lobbyId, winnerAddress)
    console.log("ResolveGame transaction sent:", tx.hash)
    
    // Wait for confirmation
    const receipt = await tx.wait()
    console.log("ResolveGame transaction confirmed:", receipt)

    return NextResponse.json({ 
      success: true, 
      transactionHash: tx.hash,
      blockNumber: receipt.blockNumber
    })

  } catch (error: any) {
    console.error("Error resolving game:", error)
    return NextResponse.json({ 
      error: "Failed to resolve game", 
      details: error.message 
    }, { status: 500 })
  }
}
