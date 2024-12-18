export class PiteasSDK {
    constructor({ provider, chainId }) {
        this.provider = provider;
        this.chainId = chainId;
    }

    async getQuote({ fromToken, toToken, amount, slippage }) {
        console.log("Fetching quote for:", { fromToken, toToken, amount, slippage });

        // Sahte bir response döndürüyoruz.
        return {
            calldata: "0x1234567890abcdef",
            value: "1000000000000000000", // 1 ETH (örnek değer)
            estimatedGas: "21000",
            estimatedOutput: "990000000000000000", // 0.99 ETH (örnek değer)
        };
    }
}
