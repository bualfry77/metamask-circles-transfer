# Copilot Instructions

## Project Overview

This is a browser-based TypeScript web application that transfers USDC from a MetaMask wallet to the Circles Network using a Tenderly virtual mainnet RPC endpoint. The app is built with Vite and ethers.js v6.

## Tech Stack

- **Language**: TypeScript (strict mode, ES2020 target)
- **Build tool**: Vite 6
- **Blockchain library**: ethers.js v6
- **Runtime environment**: Browser (no Node.js runtime code in `src/`)
- **Dev server**: Vite dev server bound to `0.0.0.0:3000` (Codespaces-compatible)

## Repository Structure

```
src/
  main.ts       – UI controller; wires DOM events, wallet state, and logging
  metamask.ts   – MetaMask provider detection, wallet connection, event listeners
  transfer.ts   – USDC balance checks, gas-payer funding, ERC-20 transfer execution
  types.ts      – Shared TypeScript interfaces (EthereumProvider, TransactionResult, WalletState, AppConfig)
  utils.ts      – Pure utility functions: formatAddress, formatAmount, isValidAddress, formatTimestamp
index.html      – Single-page UI (connect button, transfer button, log output, tx history)
vite.config.ts  – Vite server config
tsconfig.json   – TypeScript config (DOM lib required for browser APIs)
.env.example    – Template for required environment variables
```

## Environment Variables

All runtime configuration is provided through Vite environment variables (must be prefixed `VITE_`):

| Variable | Description |
|---|---|
| `VITE_TENDERLY_RPC` | Tenderly virtual mainnet RPC URL |
| `VITE_CIRCLES_RECIPIENT` | Destination Circles recipient address (0x…) |
| `VITE_CIRCLES_SEED_ADDRESS` | Circles Seed contract address (0x…) |

Copy `.env.example` to `.env` and populate before running.

## Build & Run

```bash
npm install          # install dependencies
npm run dev          # start dev server at http://localhost:3000
npm run build        # production build → dist/
npm run preview      # preview production build locally
```

There is no test runner configured; validate changes manually in the browser.

## Coding Conventions

- Use **TypeScript strict mode**; avoid `any` types — prefer explicit interfaces defined in `types.ts`.
- Keep functions **pure where possible** (especially in `utils.ts` and `transfer.ts`).
- Async functions should use `async/await`; avoid raw `.then()` chains.
- UI updates go in `main.ts`; blockchain/wallet logic stays in `metamask.ts` and `transfer.ts`.
- Use the `log()` helper in `main.ts` for all user-visible status messages (it mirrors to both the DOM and `console.log`).
- Ethereum addresses should always be validated with `isValidAddress()` from `utils.ts` before use.
- Use ethers.js v6 APIs (note: v6 has breaking changes from v5 — `ethers.utils.*` no longer exists; use top-level imports instead).

## Security Guidelines

- **Never commit `.env`** — it is listed in `.gitignore`. Secrets live only in `.env` or Codespaces secrets.
- **Never log private keys or seed phrases** anywhere in the codebase.
- Always validate Ethereum addresses before sending transactions.
- The USDC contract address (`0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`) is hardcoded — do not make it configurable through untrusted input.
- When handling user-supplied gas-payer addresses, validate them with `isValidAddress()` before use.

## Key Domain Knowledge

- **USDC** uses 6 decimal places (`usdcDecimals: 6`).
- The default transfer amount is **19,800 USDC**.
- Transfers use a direct ERC-20 `transfer` call from the sender's address (not `approve` + `transferFrom`). When a separate gas-payer address is provided, it first sends a small amount of ETH to the sender to cover gas fees, and then the sender executes the `transfer`.
- The app targets Ethereum mainnet via the Tenderly virtual RPC, not a testnet.
