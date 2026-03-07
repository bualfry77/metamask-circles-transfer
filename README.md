# MetaMask → Circles USDC Transfer

Transfer 19,800 USDC from MetaMask wallet to Circles network using Tenderly RPC endpoint.

## Features

✅ **MetaMask Integration** - Connect securely via MetaMask  
✅ **19,800 USDC Transfer** - Pre-configured for your amount  
✅ **Tenderly RPC** - Uses virtual mainnet via Tenderly  
✅ **Circles Network** - Direct integration with Circles Seed  
✅ **Error Handling** - Comprehensive error messages  
✅ **Transaction Tracking** - Real-time confirmation status  
✅ **Vite Dev Server** - Fast browser dev server, works in GitHub Codespaces  

## Prerequisites

- Node.js 18+ installed
- MetaMask browser extension installed in the browser you will use
- 19,800 USDC in your MetaMask wallet
- Circles recipient address configured

## Installation & Running (local or Codespaces)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` and fill in your values:

```env
# Vite exposes variables prefixed with VITE_ to the browser
VITE_TENDERLY_RPC=https://virtual.mainnet.eu.rpc.tenderly.co/YOUR_KEY
VITE_CIRCLES_RECIPIENT=0xYourCirclesAddressHere
VITE_CIRCLES_SEED_ADDRESS=0xCirclesSeedAddressHere
```

**Replace `0xYourCirclesAddressHere` with your actual Circles address!**

### 3. Start the dev server

```bash
npm run dev
```

The server binds to `0.0.0.0:3000` so Codespaces can forward it automatically.

### 4. Open the app in your browser

- **Locally**: open [http://localhost:3000](http://localhost:3000)
- **GitHub Codespaces**: go to the **Ports** tab in VS Code, find port **3000**, and click *Open in Browser*.  
  Make sure you open the forwarded URL in a browser that has the **MetaMask extension installed**.

### 5. Use the app

Once the page loads MetaMask will prompt for connection.  
Approve the request and the transfer will proceed automatically.  
Watch the browser console (F12) for real-time status output.

## Build for production

```bash
npm run build        # output goes to dist/
npm run preview      # local preview of the production build
```

## How It Works

1. **Connect MetaMask** – Page loads and requests account access via MetaMask
2. **Check Balance** – Verifies you have 19,800 USDC on the connected account
3. **Initiate Transfer** – Sends transfer transaction via MetaMask signer
4. **MetaMask Approval** – Confirm transaction in the MetaMask popup
5. **Confirmation** – Waits for on-chain confirmation
6. **Success** – Transaction hash and block details logged to the console

## File Structure

```
├── src/
│   ├── index.ts          # Main transfer logic (browser entry point)
│   ├── config.ts         # Configuration and ABIs
│   ├── types.ts          # TypeScript interfaces
├── index.html            # HTML entry point loaded by Vite
├── vite.config.ts        # Vite configuration (host 0.0.0.0, port 3000)
├── tsconfig.json         # TypeScript config (DOM lib included)
├── package.json          # Dependencies & scripts
├── .env.example          # Environment template
├── .gitignore            # Git ignore rules
└── README.md             # This file
```

## Transaction Details

- **Amount**: 19,800 USDC
- **From**: Your MetaMask address
- **To**: Your Circles recipient address
- **Network**: Ethereum (via Tenderly RPC)
- **Token**: USDC (`0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48`)

## Troubleshooting

### `TS2304: Cannot find name 'window'`
Make sure `tsconfig.json` is present with `"lib": ["ES2020", "DOM", "DOM.Iterable"]`.  
This is already configured in the repo.

### "MetaMask is not installed"
- Install MetaMask from https://metamask.io
- Refresh the page after installation
- In Codespaces, open the forwarded URL in a browser that has MetaMask installed

### "No accounts found"
- Unlock MetaMask wallet
- Make sure you're on the Ethereum mainnet

### "Invalid recipient address"
- Check `.env` file for correct Circles address
- Address must be 42 characters (`0x` + 40 hex characters)

### "Insufficient funds"
- Ensure you have at least 19,800 USDC
- Check gas fees (a small amount of ETH for gas)

## Security Notes

🔒 **Keep your `.env` file private — it is listed in `.gitignore` and will not be committed.**  
🔒 **Never commit `.env` to version control.**  
🔒 **Use MetaMask's built-in security features.**  
🔒 **Verify recipient address before confirming.**  

## License

MIT

## Support

For issues or questions:
- Check the troubleshooting section above
- Review transaction hash on Etherscan
- Verify `.env` configuration

---

**Made with ❤️ by bualfry77**