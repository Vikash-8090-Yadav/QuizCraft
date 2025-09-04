// SPDX-License-Identifier: MIT
pragma solidity ^0.8.10;

// Import OpenZeppelin contracts for security and ownership
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title QuizCraftArena
 * @dev Main contract for managing quiz lobbies, entry fees, and prize distributions on Conflux eSpace.
 * Uses a pull-over-push pattern for refunds to enhance security.
 */
contract QuizCraftArena is ReentrancyGuard, Ownable {
    // ===== STATE VARIABLES =====
    uint256 public constant LOBBY_TIMEOUT = 5 minutes; // Lobby expiry time
    uint256 public platformFeeBps; // Platform fee in basis points (e.g., 500 = 5%)

    address public gameMaster; // Trusted address to resolve games

    // Lobby status lifecycle
    enum LobbyStatus { OPEN, FULL, IN_PROGRESS, COMPLETED, CANCELLED }

    // Structure to hold all lobby data
    struct Lobby {
        uint256 id;
        string name;           // Lobby name (e.g., "Lightning Duel", "Battle Royale")
        string category;       // Quiz category (e.g., "Technology", "Crypto", "Science")
        uint256 entryFee;
        uint256 playerCount;
        uint256 maxPlayers;
        uint256 prizePool;
        uint256 createdAt;
        LobbyStatus status;
        address[] players;
        address winner;
        bool prizeDistributed;
        address creator;       // Who created the lobby
    }

    // Mappings for data storage
    mapping(uint256 => Lobby) public lobbies;
    mapping(address => uint256) public pendingReturns; // For user withdrawals

    uint256 public nextLobbyId; // Counter for lobby IDs

    // ===== EVENTS =====
    event LobbyCreated(uint256 indexed lobbyId, string name, string category, uint256 entryFee, uint256 maxPlayers, address creator);
    event PlayerJoined(uint256 indexed lobbyId, address player);
    event LobbyCompleted(uint256 indexed lobbyId, address winner, uint256 prize);
    event LobbyCancelled(uint256 indexed lobbyId);
    event RefundClaimed(address player, uint256 amount);
    event GameMasterUpdated(address newGameMaster);
    event FeeUpdated(uint256 newFeeBps);

    // ===== MODIFIERS =====
    modifier onlyGameMaster() {
        require(msg.sender == gameMaster, "Caller is not the GameMaster");
        _;
    }

    modifier validLobby(uint256 _lobbyId) {
        require(_lobbyId < nextLobbyId, "Lobby does not exist");
        _;
    }

    modifier isLobbyStatus(uint256 _lobbyId, LobbyStatus _status) {
        require(lobbies[_lobbyId].status == _status, "Lobby is not in the correct status");
        _;
    }

    // ===== CONSTRUCTOR =====
    /**
     * @dev Initializes the contract with an initial platform fee and sets the deployer as owner and gameMaster.
     * @param _feeBps Initial platform fee in basis points.
     */
    constructor(uint256 _feeBps)  {
    platformFeeBps = _feeBps;
    gameMaster = msg.sender;
}

    // ===== EXTERNAL & PUBLIC FUNCTIONS =====

    /**
     * @dev Allows a user to create a new game lobby.
     * @param _name The name of the lobby (e.g., "Lightning Duel", "Battle Royale").
     * @param _category The quiz category (e.g., "Technology", "Crypto", "Science").
     * @param _entryFee The entry fee in CFX required to join the lobby.
     * @param _maxPlayers The maximum number of players allowed in the lobby.
     * @return The ID of the newly created lobby.
     */
    function createLobby(
        string memory _name,
        string memory _category,
        uint256 _entryFee,
        uint256 _maxPlayers
    ) external returns (uint256) {
        require(bytes(_name).length > 0, "Lobby name cannot be empty");
        require(bytes(_category).length > 0, "Category cannot be empty");
        require(_entryFee > 0, "Entry fee must be greater than 0");
        require(_maxPlayers > 1, "Max players must be at least 2");
        require(_maxPlayers <= 10, "Max players cannot exceed 10");

        uint256 lobbyId = nextLobbyId++;
        Lobby storage newLobby = lobbies[lobbyId];

        newLobby.id = lobbyId;
        newLobby.name = _name;
        newLobby.category = _category;
        newLobby.entryFee = _entryFee;
        newLobby.maxPlayers = _maxPlayers;
        newLobby.createdAt = block.timestamp;
        newLobby.status = LobbyStatus.OPEN;
        newLobby.creator = msg.sender;

        emit LobbyCreated(lobbyId, _name, _category, _entryFee, _maxPlayers, msg.sender);
        return lobbyId;
    }

    /**
     * @dev Allows a user to join an existing open lobby by paying the entry fee.
     * @param _lobbyId The ID of the lobby to join.
     */
    function joinLobby(uint256 _lobbyId) external payable nonReentrant validLobby(_lobbyId) isLobbyStatus(_lobbyId, LobbyStatus.OPEN) {
        Lobby storage lobby = lobbies[_lobbyId];
        require(msg.value == lobby.entryFee, "Incorrect entry fee sent");
        require(lobby.players.length < lobby.maxPlayers, "Lobby is full");
        require(!isPlayerInLobby(_lobbyId, msg.sender), "Player already in lobby");

        lobby.players.push(msg.sender);
        lobby.playerCount++;
        lobby.prizePool += msg.value;

        emit PlayerJoined(_lobbyId, msg.sender);

        // Check if lobby is now full
        if (lobby.players.length == lobby.maxPlayers) {
            lobby.status = LobbyStatus.FULL;
            lobby.createdAt = block.timestamp; // Reset timer for game start
        }
    }

    /**
     * @dev Called by the GameMaster to resolve a completed game and distribute the prize.
     * @param _lobbyId The ID of the lobby to resolve.
     * @param _winner The address of the winning player.
     */
    function resolveGame(uint256 _lobbyId, address _winner) external nonReentrant onlyGameMaster validLobby(_lobbyId) {
        Lobby storage lobby = lobbies[_lobbyId];
        require(lobby.status == LobbyStatus.FULL, "Lobby not ready to resolve");
        require(isPlayerInLobby(_lobbyId, _winner), "Winner is not a player in this lobby");
        require(!lobby.prizeDistributed, "Prize already distributed");

        lobby.status = LobbyStatus.COMPLETED;
        lobby.winner = _winner;
        lobby.prizeDistributed = true;

        uint256 fee = (lobby.prizePool * platformFeeBps) / 10000;
        uint256 prize = lobby.prizePool - fee;

        // Send prize to winner
        (bool success, ) = _winner.call{value: prize}("");
        require(success, "Transfer to winner failed");

        // Send fee to platform owner
        (success, ) = owner().call{value: fee}("");
        require(success, "Transfer of fee failed");

        emit LobbyCompleted(_lobbyId, _winner, prize);
    }

    /**
     * @dev Allows a player in an expired lobby to mark their funds for refund.
     * @param _lobbyId The ID of the expired lobby.
     */
    function claimRefund(uint256 _lobbyId) external validLobby(_lobbyId) {
        Lobby storage lobby = lobbies[_lobbyId];
        require(lobby.status == LobbyStatus.OPEN || lobby.status == LobbyStatus.FULL, "Not refundable");
        require(block.timestamp > lobby.createdAt + LOBBY_TIMEOUT, "Lobby not yet expired");
        require(isPlayerInLobby(_lobbyId, msg.sender), "Not a player in this lobby");
        require(!lobby.prizeDistributed, "Prize already handled");

        lobby.status = LobbyStatus.CANCELLED;
        pendingReturns[msg.sender] += lobby.entryFee;

        emit LobbyCancelled(_lobbyId);
    }

    /**
     * @dev Allows a user to withdraw any refunds they have claimed.
     */
    function withdrawRefund() external nonReentrant {
        uint256 amount = pendingReturns[msg.sender];
        require(amount > 0, "No funds to withdraw");

        pendingReturns[msg.sender] = 0;
        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "Refund transfer failed");

        emit RefundClaimed(msg.sender, amount);
    }

    // ===== VIEW & UTILITY FUNCTIONS =====
    /**
     * @dev Checks if an address is a player in a specific lobby.
     * @param _lobbyId The ID of the lobby.
     * @param _player The address to check.
     * @return True if the player is in the lobby, false otherwise.
     */
    function isPlayerInLobby(uint256 _lobbyId, address _player) public view validLobby(_lobbyId) returns (bool) {
        Lobby storage lobby = lobbies[_lobbyId];
        for (uint256 i = 0; i < lobby.players.length; i++) {
            if (lobby.players[i] == _player) {
                return true;
            }
        }
        return false;
    }

    /**
     * @dev Gets the list of players in a lobby.
     * @param _lobbyId The ID of the lobby.
     * @return An array of player addresses.
     */
    function getPlayersInLobby(uint256 _lobbyId) external view validLobby(_lobbyId) returns (address[] memory) {
        return lobbies[_lobbyId].players;
    }

    // ===== ADMIN FUNCTIONS =====
    /**
     * @dev Allows the owner to update the platform fee.
     * @param _newFeeBps The new fee in basis points.
     */
    function updatePlatformFee(uint256 _newFeeBps) external onlyOwner {
        require(_newFeeBps <= 1000, "Fee cannot exceed 10%"); // Max 10% fee
        platformFeeBps = _newFeeBps;
        emit FeeUpdated(_newFeeBps);
    }

    /**
     * @dev Allows the owner to update the GameMaster address.
     * @param _newGameMaster The address of the new GameMaster.
     */
    function updateGameMaster(address _newGameMaster) external onlyOwner {
        require(_newGameMaster != address(0), "Invalid GameMaster address");
        gameMaster = _newGameMaster;
        emit GameMasterUpdated(_newGameMaster);
    }

    /**
     * @dev Allows the owner to withdraw any accidental non-CFX tokens sent to the contract.
     * @param _token The address of the token to withdraw.
     * @param _to The address to send the tokens to.
     */
    function withdrawERC20(IERC20 _token, address _to) external onlyOwner {
        uint256 balance = _token.balanceOf(address(this));
        require(balance > 0, "No tokens to withdraw");
        _token.transfer(_to, balance);
    }

    // Fallback function to reject accidental ETH sends (should not happen on Conflux)
    receive() external payable {
        revert("Do not send ETH directly");
    }
}