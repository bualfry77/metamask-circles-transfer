const web3 = require('./web3-config');
const USDC_ADDRESS = process.env.USDC_ADDRESS;

async function checkBalance(address) {
    const balance = await web3.eth.getBalance(address);
    console.log(`Balance for ${address}: ${balance}`);
}

checkBalance("your_wallet_address_here");