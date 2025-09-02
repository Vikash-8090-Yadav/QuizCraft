export const CONTRACT_ADDRESSES = {
  QUIZ_CRAFT_ARENA: process.env.NEXT_PUBLIC_QUIZ_CRAFT_ARENA_ADDRESS || "0x1234567890123456789012345678901234567890",
  QUIZ_CRAFT_NFT: process.env.NEXT_PUBLIC_QUIZ_CRAFT_NFT_ADDRESS || "0x0987654321098765432109876543210987654321",
}

export const QUIZ_CRAFT_ARENA_ABI = [
  "function joinLobby(uint256 lobbyId) external payable",
  "function getLobby(uint256 lobbyId) external view returns (tuple(uint256 id, uint256 entryFee, uint256 maxPlayers, uint256 currentPlayers, bool isActive, address[] players))",
  "function getPlayerLobbies(address player) external view returns (uint256[])",
  "event PlayerJoined(uint256 indexed lobbyId, address indexed player)",
  "event GameStarted(uint256 indexed lobbyId)",
  "event PlayerEliminated(uint256 indexed lobbyId, address indexed player)",
  "event GameFinished(uint256 indexed lobbyId, address indexed winner, uint256 prize)",
]

export const QUIZ_CRAFT_NFT_ABI = [
  "function balanceOf(address owner) external view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) external view returns (uint256)",
  "function tokenURI(uint256 tokenId) external view returns (string)",
  "function ownerOf(uint256 tokenId) external view returns (address)",
]
