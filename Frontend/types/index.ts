export interface Quiz {
  id: string
  category: string
  questions: Question[]
}

export interface Question {
  id: string
  question: string
  options: string[]
  correctAnswer: number
  timeLimit: number
}

export interface LeaderboardEntry {
  rank: number
  address: string
  score: number
  timestamp: number
}

export interface Lobby {
  id: string
  mode: string
  entryFee: string
  currentPlayers: number
  maxPlayers: number
  isActive: boolean
}

export interface NFTMetadata {
  tokenId: string
  name: string
  description: string
  image: string
  attributes: Array<{
    trait_type: string
    value: string
  }>
}

export interface Web3ContextType {
  provider: any
  signer: any
  account: string | null
  chainId: number | null
  isConnected: boolean
  connectWallet: () => Promise<void>
  switchToConflux: () => Promise<void>
  loading: boolean
  error: string | null
}
