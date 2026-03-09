# MetaMask → Circles USDC Transfer (On-Chain)

Transfer 19,800 USDC from a MetaMask wallet to the Circles network via the **CirclesTransfer** on-chain smart contract.

## What's New in v2 (On-Chain)

| Feature | v1 (off-chain) | v2 (on-chain) |
|---------|---------------|---------------|
| USDC transfer | Direct ERC-20 `transfer()` | `approve` → `CirclesTransfer.transferToCircles()` |
| Gas-payer funding | Raw ETH send | `CirclesTransfer.fundGas()` (on-chain event) |
| Audit trail | Etherscan ERC-20 log | `USDCTransferred` + `GasFunded` events on contract |
| Access control | None | Contract owner can update recipient; custom errors |
| Testnet deploy | — | Hardhat scripts for Sepolia / Goerli |

## Architecture

```
User Wallet (MetaMask)
  │
  │  1. approve(CirclesTransfer, 19800 USDC)
  │  2. transferToCircles(19800e6)             ─────────────────────────────┐
  ▼                                                                         ▼
CirclesTransfer.sol  ──  transferFrom(user → circlesRecipient, 19800 USDC)
  │
  └── emit USDCTransferred(from, to, amount, gasPayerAddress)

Gas Payer (optional)
  │  fundGas(senderAddress) { value: 0.01 ETH }
  │  → ETH forwarded to sender on-chain
  └── emit GasFunded(gasPayer, sender, 0.01 ETH)
```

## Prerequisites

- Node.js 18+
- MetaMask browser extension
- 19,800 USDC in your MetaMask wallet
- A small amount of ETH for gas

## Installation

```bash
npm install
```

## Configuration

```bash
cp .env.example .env
```

Edit `.env` with your values:

```env
# Front-end
VITE_TENDERLY_RPC=https://virtual.mainnet.eu.rpc.tenderly.co/YOUR_KEY
VITE_CIRCLES_RECIPIENT=0xYourCirclesAddressHere
VITE_CONTRACT_ADDRESS=0xDeployedCirclesTransferAddress   # set after deploy

# Deployment
DEPLOYER_PRIVATE_KEY=your_private_key
SEPOLIA_RPC_URL=https://sepolia.infura.io/v3/YOUR_KEY
CIRCLES_RECIPIENT=0xYourCirclesAddressHere
```

## Smart Contract Deployment (Sepolia Testnet)

### 1. Compile the contract

```bash
npm run compile
```

### 2. Deploy to Sepolia

```bash
npm run deploy:sepolia
```

The script prints the deployed contract address. Copy it into your `.env`:

```env
VITE_CONTRACT_ADDRESS=0x<deployed address>
```

### 3. (Optional) Verify on Etherscan

```bash
npx hardhat verify --network sepolia <CONTRACT_ADDRESS> <USDC_ADDRESS> <CIRCLES_RECIPIENT>
```

## Running the Front-End

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) (or the Codespaces forwarded URL).

## Usage Flow

1. **Connect** – Click *Connect MetaMask* to connect your wallet.
2. **Approve** – Click *Approve USDC* to grant the CirclesTransfer contract permission to spend 19,800 USDC on your behalf. This calls `approve(contractAddress, MaxUint256)` on the USDC token. Only required once per wallet.
3. **Transfer** – Click *Transfer 19,800 USDC*. The app calls `transferToCircles(19800e6)` on the contract, which:
   - Verifies allowance and balance on-chain.
   - Calls `transferFrom(you → circlesRecipient, 19800e6)` atomically.
   - Emits a `USDCTransferred` event for permanent on-chain proof.
4. *(Optional)* **Gas Payer** – Enter a secondary address in the Gas Payer field before transferring. The app will call `fundGas(yourAddress)` from the gas payer to top up your ETH balance before the transfer.

> **Fallback:** If `VITE_CONTRACT_ADDRESS` is not set, the app falls back to the v1 direct ERC-20 `transfer()` flow.

## Smart Contract: `CirclesTransfer.sol`

### Key Functions

| Function | Who calls it | Description |
|----------|-------------|-------------|
| `transferToCircles(uint256 amount)` | Sender | Transfer USDC to Circles recipient. Requires prior `approve`. |
| `transferToCirclesWithGasPayer(uint256 amount, address gasPayer)` | Sender | Same as above, records gas-payer address in event. |
| `fundGas(address sender) payable` | Gas payer | Forwards ETH to `sender` for gas fees. Emits `GasFunded`. |
| `setCirclesRecipient(address)` | Owner only | Update the Circles recipient address. |
| `transferOwnership(address)` | Owner only | Transfer contract ownership. |
| `allowanceForContract(address owner)` | Anyone | Read USDC allowance granted to this contract. |
| `usdcBalanceOf(address account)` | Anyone | Read USDC balance. |

### Events

| Event | Parameters | When |
|-------|-----------|------|
| `USDCTransferred` | `from, to, amount, gasPayerAddress` | Every successful transfer |
| `GasFunded` | `gasPayer, sender, amount` | Every ETH gas-funding |
| `RecipientUpdated` | `newRecipient` | When owner updates recipient |
| `OwnershipTransferred` | `previousOwner, newOwner` | When ownership changes |

### Custom Errors

`NotOwner`, `ZeroAddress`, `ZeroAmount`, `RecipientNotSet`, `USDCTransferFailed`, `ETHTransferFailed`, `InsufficientAllowance(required, actual)`, `InsufficientBalance(required, actual)`

## Build for Production

```bash
npm run build       # output → dist/
npm run preview     # local preview of production build
```

## File Structure

```
├── contracts/
│   └── CirclesTransfer.sol      # Solidity smart contract
├── scripts/
│   └── deploy.ts                # Hardhat deploy script
├── src/
│   ├── contract.ts              # Contract ABI & helpers
│   ├── main.ts                  # UI event handlers & app logic
│   ├── metamask.ts              # MetaMask integration
│   ├── transfer.ts              # On-chain USDC transfer logic
│   ├── types.ts                 # TypeScript interfaces
│   └── utils.ts                 # Formatting utilities
├── index.html                   # HTML entry point
├── hardhat.config.ts            # Hardhat configuration (Sepolia / Goerli)
├── tsconfig.hardhat.json        # TypeScript config for Hardhat scripts
├── vite.config.ts               # Vite dev server (port 3000)
├── package.json                 # Dependencies & scripts
├── .env.example                 # Environment variable template
└── README.md                    # This file
```

## Troubleshooting

### "No on-chain contract configured"
Set `VITE_CONTRACT_ADDRESS` in your `.env` to the deployed `CirclesTransfer` address.

### "Insufficient USDC allowance"
Click **Approve USDC** before transferring. The approval is per-wallet and only needed once.

### "MetaMask is not installed"
Install MetaMask from https://metamask.io and refresh the page.

### "Unexpected network"
The app targets Ethereum mainnet (Chain ID 1) or Sepolia (Chain ID 11155111). Switch networks in MetaMask.

### "Insufficient funds in the gas payer address"
The gas payer must hold at least 0.012 ETH (0.01 for funding + 0.002 overhead).

### `TS2304: Cannot find name 'window'`
Ensure `tsconfig.json` includes `"lib": ["ES2020", "DOM", "DOM.Iterable"]` (already configured).

## Security Notes

🔒 **Keep `.env` private — it is listed in `.gitignore`.**  
🔒 **Never commit private keys to version control.**  
🔒 **The `CirclesTransfer` contract uses `transferFrom`, not `transfer` — your USDC stays in your wallet until the transaction is confirmed.**  
🔒 **Verify the contract address on Etherscan before approving.**  
🔒 **The contract owner can only update the Circles recipient — they cannot withdraw your tokens.**

## License

MIT

---

**Made with ❤️ by bualfry77**
