Of course. Here is the complete project description, architecture, and implementation plan explicitly designed for the **Conflux** blockchain.

---

## **Hackathon Project Submission: QuizCraft AI on Conflux**

### **Tagline:** Your Knowledge, On-Chain. Powered by Conflux.

### **One-Liner Pitch:**
A dynamic, AI-powered quiz platform on Conflux eSpace where users instantly play solo for points and NFTs or compete in live PvP matches for CFX prizes, leveraging Conflux's high throughput and low fees.

---

### **The Problem:**
Traditional quiz apps are centralized, have repetitive content, and offer no real ownership or monetary rewards. Other blockchains can have high and unpredictable fees, making micro-transactions for quizzes impractical.

### **Our Solution:**
**QuizCraft AI** is built natively on **Conflux eSpace** (EVM-compatible), utilizing its low transaction costs and fast finality to enable a seamless, rewarding quiz experience. We solve user wait times with a dual-mode system:
1.  **Solo Training Mode:** Instantly play AI-generated quizzes to earn points on a daily leaderboard and win NFTs—no waiting, no fees.
2.  **Live Arena Mode:** Deposit a small amount of CFX to enter a competitive, winner-takes-all match, with all prizes handled by a secure, transparent smart contract.

### **Why Conflux?**
*   **Low Gas Fees:** Essential for micro-transactions like quiz entry fees and NFT minting. Makes the game economically viable for users.
*   **High Throughput:** Handles the transaction load of multiple simultaneous games and leaderboard updates without congestion.
*   **EVM Compatibility:** Allows for rapid development using established Ethereum tools (MetaMask, Hardhat, Ethers.js) and easy onboarding for users.
*   **Growing Ecosystem:** Perfect for a innovative dApp that showcases a practical and fun use case for Web3.

### **Core Features & Conflux-Specific Innovation:**

**1. AI Integration (The Brain):**
*   **Dynamic Question Generation on Conflux eSpace:** The frontend calls an AI API (e.g., OpenAI) to generate unique questions. The question's hash or Merkle root can be stored on-chain for verifiable fairness in competitive modes.

**2. Conflux Blockchain Integration (The Trust & Economy):**
*   **CFX Deposits & Payouts:** All entry fees and prizes are denominated in **CFX**, leveraging its low cost for transfers.
*   **Smart Contract Escrow on eSpace:** The core game logic resides in a Solidity smart contract deployed on Conflux eSpace. It manages:
    *   Lobby creation and player registration.
    *   Holding CFX in escrow.
    *   Automatically distributing the prize pool to the winner.
    *   **Automatic Refunds:** If a lobby fails to fill within a set time, the smart contract automatically refunds all participants their CFX.
*   **Conflux NFT Standard (CRC-721):** All achievement badges and leaderboard prizes are minted as NFTs on Conflux, providing users with verifiable, on-chain trophies of their knowledge. These are stored on Conflux eSpace.

**3. Dual-Mode Gameplay (The Engagement):**
*   **Solo Training Mode (Free-to-Play, Score-Based):**
    *   **Instant Play:** No transactions needed. Users play for free, and their scores are recorded off-chain (or via a gas-optimized, batched on-chain solution).
    *   **Daily Conflux Leaderboard:** A dedicated UI shows the top players each day.
    *   **Rewards:** Top daily players win exclusive **Conflux NFTs** (CRC-721). This drives daily engagement without requiring users to spend CFX.
*   **Live Arena Mode (Play-to-Earn, Prize-Based):**
    *   **Competitive Play:** Users deposit CFX (e.g., 2 CFX) to join a lobby.
    *   **Smart Contract Escrow:** The Conflux smart contract holds all funds until the game resolves.
    *   **Winner-Takes-All:** The smart contract automatically sends the entire CFX prize pool to the winner's Conflux eSpace address.

### **Technical Architecture for Conflux:**

*   **Blockchain:** **Conflux eSpace** (EVM-Compatible)
*   **Smart Contracts:** **Solidity** (using OpenZeppelin libraries for security)
*   **Development Framework:** **Hardhat** (with Conflux hardhat plugin)
*   **Frontend:** **Next.js / React** with **TypeScript**
*   **Web3 Library:** **Ethers.js**
*   **Wallet Connection:** **MetaMask** (configured for Conflux eSpace Testnet & Mainnet)
*   **AI API:** **OpenAI API** (GPT-4 for question generation)
*   **Backend (Optional - for leaderboards):** A simple server or **Conflux RPC** to index events for the leaderboard, or a gas-efficient on-chain solution.
*   **NFT Storage:** Metadata stored on **IPFS** (e.g., Pinata), with the hash stored on-chain in the NFT contract.

### **How It Works (User Flow on Conflux):**

1.  **User Onboarding:**
    *   User opens the app. The website prompts them to connect their MetaMask wallet.
    *   A guide helps them switch their MetaMask network to **Conflux eSpace Testnet/Mainnet**.

2.  **Choosing a Mode:**
    *   **"Train for Free" (Solo Mode):** Click, choose a category, and play instantly. Score is recorded.
    *   **"Compete for CFX" (Live Arena):** Click, choose a lobby (e.g., 1v1, 5 Player), and see the entry fee (e.g., 2 CFX).

3.  **Live Arena Transaction Flow:**
    *   User clicks "Join" and approves two MetaMask transactions:
        1.  **Approve:** To allow the game contract to spend their CFX (if using an `ERC-20` standard for wrapped CFX, though native CFX handling is preferred).
        2.  **Join Game:** Interacts with the game contract's `joinLobby(uint256 lobbyId)` function, which locks their CFX into the contract.
    *   The lobby waits for players. If it fills, the game starts. If it times out, the contract's `refundPlayers(uint256 lobbyId)` function is called automatically, returning their CFX.
    *   The game plays out on the frontend. The frontend submits the winner's proof to the smart contract.
    *   The contract verifies the result and executes `payoutWinner(uint256 lobbyId)`, sending the CFX prize to the winner.

4.  **Earning NFTs:**
    *   After a day ends, the backend or an admin account triggers the `mintLeaderboardNFTs(address[] winners)` function in the NFT contract, sending NFTs to the top players' addresses.

### **Demo Plan for Hackathon (on Conflux Testnet):**

1.  **Show Conflux Infrastructure:**
    *   Show the contract deployed on **Conflux eSpace Testnet** and verified on ConfluxScan.
2.  **Live Demo:**
    *   Connect a MetaMask wallet to Conflux eSpace Testnet.
    *   **Demo Solo Mode:** Play a full quiz, show the leaderboard updating.
    *   **Demo Live Arena:** Use two separate MetaMask wallets to show joining a lobby, the contract holding CFX, simulating a game, and showing the winner receiving CFX automatically in their wallet.
    *   **Show an NFT:** Mint an NFT for a winner and view it on a Conflux NFT marketplace like TSpace.
3.  **Key Code to Highlight:**
    *   The Solidity smart contract for game logic, emphasizing the escrow and automatic refund features.
    *   The configuration files (`hardhat.config.js`) showing the Conflux eSpace RPC setup.
    *   The frontend code for switching networks to Conflux automatically.

### **Future Conflux-Specific Roadmap:**

*   **Integration with Conflux Core Space:** Explore using native CFX via cross-space capabilities for even lower fees.
*   **Conflux Community Grants:** Apply for grants to further develop and market the platform.
*   **$QUIZ Token on Conflux:** Launch a native utility token on Conflux for governance, fees, and rewards.

### **Why This Will Win on Conflux:**

This project is a perfect showcase of **Conflux's strengths**: low fees, high speed, and EVM compatibility. It's not just a generic DApp; it's a **fun, engaging, and practical use case** that provides real utility and demonstrates why the Conflux network is an ideal platform for the next generation of Web3 applications. The dual-mode system ensures a smooth user experience, directly addressing onboarding challenges in Web3.
