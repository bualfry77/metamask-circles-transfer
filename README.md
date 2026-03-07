# MetaMask → Circles USDC Transfer

Transfer 19,800 USDC from MetaMask wallet to Circles network using Tenderly RPC endpoint.

## Features

✅ **MetaMask Integration** - Connect securely via MetaMask  
✅ **19,800 USDC Transfer** - Pre-configured for your amount  
✅ **Tenderly RPC** - Uses virtual mainnet via Tenderly  
✅ **Circles Network** - Direct integration with Circles Seed  
✅ **Error Handling** - Comprehensive error messages  
✅ **Transaction Tracking** - Real-time confirmation status  

## Prerequisites

- Node.js 16+ installed
- MetaMask browser extension installed
- 19,800 USDC in your MetaMask wallet
- Circles recipient address configured

## Installation

```bash
# Clone repository
git clone https://github.com/bualfry77/metamask-circles-transfer.git
cd metamask-circles-transfer

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
```

## Configuration

Edit `.env` file:

```env
TENDERLY_RPC=https://virtual.mainnet.eu.rpc.tenderly.co/a5b0561f-8857-4a09-a786-b93f6ed43efe
CIRCLES_RECIPIENT=0xYourCirclesAddressHere
CIRCLES_SEED_ADDRESS=0xCirclesSeedAddressHere
```

**Replace `0xYourCirclesAddressHere` with your actual Circles address!**

## Usage

### Development

```bash
npm run dev
```

### Production

```bash
npm run build
npm start
```

## How It Works

1. **Connect MetaMask** - Click connect and approve in MetaMask
2. **Check Balance** - Verifies you have 19,800 USDC
3. **Initiate Transfer** - Sends transaction to Circles recipient
4. **MetaMask Approval** - Confirm transaction in MetaMask popup
5. **Confirmation** - Wait for blockchain confirmation
6. **Success** - Transaction hash and block details displayed

## Transaction Details

- **Amount**: 19,800 USDC
- **From**: Your MetaMask address
- **To**: Your Circles recipient address
- **Network**: Ethereum (via Tenderly RPC)
- **Token**: USDC (0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48)

## Troubleshooting

### "MetaMask is not installed"
- Install MetaMask from https://metamask.io
- Refresh the page after installation

### "No accounts found"
- Unlock MetaMask wallet
- Make sure you're on the Ethereum mainnet

### "Invalid recipient address"
- Check `.env` file for correct Circles address
- Address must be 42 characters (0x + 40 hex characters)

### "Insufficient funds"
- Ensure you have at least 19,800 USDC
- Check gas fees (a few USDC for gas)

### Transaction fails
- Check network connection
- Verify Circles recipient address is correct
- Wait a moment and try again

## File Structure

```
├── src/
│   ├── index.ts          # Main transfer logic
│   ├── config.ts         # Configuration and ABIs
│   ├── types.ts          # TypeScript interfaces
├── package.json          # Dependencies
├── tsconfig.json         # TypeScript config
├── .env.example          # Environment template
├── .gitignore            # Git ignore rules
└── README.md             # This file
```

## Security Notes

🔒 **Keep your .env file private!**  
🔒 **Never commit .env to version control**  
🔒 **Use MetaMask's built-in security features**  
🔒 **Verify recipient address before confirming**  

## API Reference

### `connectMetaMask()`
Connects to MetaMask and returns the user's account address.

```typescript
const account = await connectMetaMask();
```

### `getUSDCBalance(address)`
Gets USDC balance for an address.

```typescript
const balance = await getUSDCBalance('0x...');
```

### `transferUSDCToCircles(fromAddress)`
Transfers 19,800 USDC to Circles recipient.

```typescript
const result = await transferUSDCToCircles(account);
console.log(result.hash); // Transaction hash
```

## License

MIT

## Support

For issues or questions:
- Check the troubleshooting section
- Review transaction hash on Etherscan
- Verify .env configuration

---

**Made with ❤️ by bualfry77**