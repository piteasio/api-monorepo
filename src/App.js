// Import necessary dependencies
import React, { useState, useEffect } from 'react';
import { ethers } from 'ethers';
import 'bootstrap/dist/css/bootstrap.min.css';

const PITEAS_ROUTER_ADDRESS = "0x6BF228eb7F8ad948d37deD07E595EfddfaAF88A6";
const PULSECHAIN_RPC = "https://rpc.pulsechain.com";
const QUOTE_API_URL = "https://sdk.piteas.io/quote";
const TOKEN_LIST_URL = "https://raw.githubusercontent.com/piteasio/app-tokens/main/piteas-tokenlist.json";
const CHAIN_ID = 369;

const App = () => {
    const [walletAddress, setWalletAddress] = useState(null);
    const [provider, setProvider] = useState(null);
    const [signer, setSigner] = useState(null);
    const [nativeBalance, setNativeBalance] = useState("0");
    const [inputToken, setInputToken] = useState("PLS");
    const [outputToken, setOutputToken] = useState("PLS");
    const [inputAmount, setInputAmount] = useState("");
    const [slippage, setSlippage] = useState(0.5);
    const [receiver, setReceiver] = useState("");
    const [quote, setQuote] = useState(null);
    const [balances, setBalances] = useState({});
    const [loading, setLoading] = useState(false);
    const [tokenList, setTokenList] = useState([]);
    const [message, setMessage] = useState("");
    const [balanceFetchStatus, setBalanceFetchStatus] = useState("");
    const [tokenListLoading, setTokenListLoading] = useState(false);
    const [useTokenList, setUseTokenList] = useState(false);
    const [transactionHash, setTransactionHash] = useState(null);

    // Fetch token list from remote source
    const fetchTokenList = async () => {
        setTokenListLoading(true);
        try {
            const response = await fetch(TOKEN_LIST_URL);
            const data = await response.json();
            const updatedList = [{
                address: "PLS",
                symbol: "PLS",
                decimals: 18,
                logoURI: "https://assets.coingecko.com/coins/images/279/large/pulse.png"
            }, ...data.tokens];
            setTokenList(updatedList);
            setMessage("Token list loaded successfully.");
        } catch (error) {
            console.error("Error fetching token list:", error);
            setMessage("Failed to load token list.");
        }
        setTokenListLoading(false);
    };

    // Connect wallet and initialize provider and signer
    const connectWallet = async () => {
        if (window.ethereum) {
            const web3Provider = new ethers.providers.Web3Provider(window.ethereum);
            const accounts = await web3Provider.send("eth_requestAccounts", []);
            setWalletAddress(accounts[0]);
            setProvider(web3Provider);
            setSigner(web3Provider.getSigner());
            fetchNativeBalance(web3Provider, accounts[0]);
        } else {
            setMessage("Please install a Web3 wallet.");
        }
    };

    // Fetch native token balance via RPC
    const fetchNativeBalance = async (web3Provider, address) => {
        try {
            const balance = await web3Provider.getBalance(address);
            setNativeBalance(ethers.utils.formatEther(balance));
        } catch (error) {
            console.error("Error fetching native balance:", error);
        }
    };

    // Fetch token balances in batches
    const fetchTokenBalances = async () => {
        setLoading(true);
        setBalanceFetchStatus("Fetching token balances...");
        const batchSize = 50; // Number of tokens per batch
        const updatedBalances = { PLS: nativeBalance };

        try {
            for (let i = 0; i < tokenList.length; i += batchSize) {
                const batch = tokenList.slice(i, i + batchSize);
                await Promise.all(
                    batch.map(async (token) => {
                        if (token.address === "PLS") return;

                        const contract = new ethers.Contract(
                            token.address,
                            ["function balanceOf(address owner) view returns (uint256)", "function decimals() view returns (uint8)"],
                            provider
                        );
                        try {
                            const [balance, decimals] = await Promise.all([
                                contract.balanceOf(walletAddress),
                                contract.decimals(),
                            ]);
                            updatedBalances[token.address] = ethers.utils.formatUnits(balance, decimals);
                        } catch (err) {
                            updatedBalances[token.address] = "0";
                        }
                    })
                );
                // Introduce a small delay between batches
                await new Promise((resolve) => setTimeout(resolve, 100));
            }
            setBalances(updatedBalances);
            setBalanceFetchStatus("Token balances updated successfully.");
        } catch (error) {
            console.error("Error fetching token balances:", error);
            setBalanceFetchStatus("Failed to fetch token balances.");
        }
        setLoading(false);
    };

    // Fetch token details for a given address
    const fetchTokenDetails = async (tokenAddress, callback) => {
        if (!tokenAddress) {
            setMessage("Please enter a valid token address.");
            return;
        }

        try {
            const web3Provider = new ethers.providers.JsonRpcProvider(PULSECHAIN_RPC);
            const contract = new ethers.Contract(
                tokenAddress,
                ["function symbol() view returns (string)", "function balanceOf(address) view returns (uint256)", "function decimals() view returns (uint8)"],
                web3Provider
            );

            const [symbol, balance, decimals] = await Promise.all([
                contract.symbol(),
                contract.balanceOf(walletAddress),
                contract.decimals(),
            ]);

            const formattedBalance = ethers.utils.formatUnits(balance, decimals);
            callback({ symbol, balance: formattedBalance });
        } catch (error) {
            console.error("Error fetching token details:", error);
            setMessage("Failed to fetch token details. Make sure the address is correct.");
        }
    };

    // Check and approve ERC-20 token if necessary
    const checkAndApproveToken = async () => {
        if (inputToken === "PLS") return true; // No approval needed for PLS

        try {
            const erc20 = new ethers.Contract(
                inputToken,
                ["function allowance(address owner, address spender) view returns (uint256)", "function approve(address spender, uint256 amount) external returns (bool)"],
                signer
            );

            const allowance = await erc20.allowance(walletAddress, PITEAS_ROUTER_ADDRESS);
            const inputTokenDetails = tokenList.find(token => token.address === inputToken) || { decimals: 18 };
            const requiredAmount = ethers.utils.parseUnits(inputAmount, inputTokenDetails.decimals);

            if (allowance.gte(requiredAmount)) {
                return true; // Already approved
            }

            const tx = await erc20.approve(PITEAS_ROUTER_ADDRESS, ethers.constants.MaxUint256); // Approve unlimited
            await tx.wait();
            setMessage("Token approved successfully.");
            return true;
        } catch (error) {
            console.error("Error approving token:", error);
            setMessage("Failed to approve token.");
            return false;
        }
    };

    // Fetch swap quote
    let lastQuoteTimestamp = 0; // Timestamp of the last request
    const [isFetching, setIsFetching] = useState(false); // Tracks if a request is in progress

    const fetchQuote = async () => {
        const now = Date.now();
        const timeSinceLastQuote = now - lastQuoteTimestamp;

        if (timeSinceLastQuote < 12000) { // Check if 12 seconds have passed
            setMessage("Please wait at least 12 seconds before fetching a new quote.");
            return;
        }

        if (isFetching) {
            setMessage("Quote request is already in progress. Please wait.");
            return;
        }

        setIsFetching(true); // Update state when request starts
        try {
            if (!inputToken || !outputToken || !inputAmount) {
                setMessage("Please fill all fields.");
                setIsFetching(false);
                return;
            }

            const inputTokenDetails = tokenList.find(token => token.address === inputToken) || { decimals: 18 };
            const outputTokenDetails = tokenList.find(token => token.address === outputToken) || { decimals: 18 };

            const inputAmountInDecimals = ethers.utils.parseUnits(inputAmount, inputTokenDetails.decimals);

            // Construct the query parameters
            const query = new URLSearchParams({
                tokenInAddress: inputToken === "PLS" ? "PLS" : inputToken,
                tokenOutAddress: outputToken === "PLS" ? "PLS" : outputToken,
                amount: inputAmountInDecimals.toString(),
                allowedSlippage: slippage,
            });

            // Only add the account parameter if a wallet is connected
            if (walletAddress) {
                query.append("account", receiver || walletAddress);
            }

            const response = await fetch(`${QUOTE_API_URL}?${query.toString()}`);
            const data = await response.json();

            setQuote({
                inputToken: `${inputTokenDetails.symbol} (${inputToken})`,
                outputToken: `${outputTokenDetails.symbol} (${outputToken})`,
                inputAmount: parseFloat(inputAmount).toLocaleString(undefined, { minimumFractionDigits: 6 }),
                estimatedOutput: parseFloat(ethers.utils.formatUnits(data.destAmount, outputTokenDetails.decimals)).toLocaleString(undefined, {
                    minimumFractionDigits: outputTokenDetails.decimals,
                }),
                gasFee: data.gasUseEstimate,
                calldata: data.methodParameters.calldata,
            });
            setMessage("Quote fetched successfully.");
            lastQuoteTimestamp = now; // Update the timestamp of the last request
        } catch (error) {
            console.error("Error fetching quote:", error);
            setMessage("Failed to fetch quote.");
        } finally {
            setIsFetching(false); // Reset state when request is complete
        }
    };



    // Execute swap transaction
    const executeSwap = async () => {
        try {
            if (!quote || !signer) {
                setMessage("No quote available or wallet not connected.");
                return;
            }

            const approved = await checkAndApproveToken();
            if (!approved) return;

            const inputTokenDetails = tokenList.find(token => token.address === inputToken) || { decimals: 18 };

            const tx = await signer.sendTransaction({
                to: PITEAS_ROUTER_ADDRESS,
                data: quote.calldata,
                gasLimit: ethers.BigNumber.from(quote.gasFee || "300000"),
                value: inputToken === "PLS" ? ethers.utils.parseUnits(inputAmount, inputTokenDetails.decimals) : 0,
            });

            await tx.wait();
            setTransactionHash(tx.hash);
            setMessage("Swap executed successfully.");
        } catch (error) {
            console.error("Error executing swap:", error);
            setMessage("Failed to execute swap.");
        }
    };

    useEffect(() => {
        const timer = setTimeout(() => {
            setMessage("");
            setBalanceFetchStatus("");
        }, 10000);
        return () => clearTimeout(timer);
    }, [message, balanceFetchStatus]);

    return (
        <div className="container py-4">
            <h1 className="text-center mb-4 fs-4">Piteas API Monorepo</h1>

            <div className="text-center mb-3">
                {!walletAddress ? (
                    <button className="btn btn-primary" onClick={connectWallet}>Connect Wallet</button>
                ) : (
                    <div>
                        <p><strong>Connected Wallet:</strong> {walletAddress}</p>
                        <p><strong>PLS Balance:</strong> {parseFloat(nativeBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
                    </div>
                )}
            </div>

            <div className="form-check form-switch mb-3">
                <input
                    className="form-check-input"
                    type="checkbox"
                    id="tokenListToggle"
                    checked={useTokenList}
                    onChange={() => {
                        setUseTokenList(!useTokenList);
                        if (!useTokenList) fetchTokenList();
                    }}
                />
                <label className="form-check-label" htmlFor="tokenListToggle">
                    Advanced Mode (with token list)
                </label>
            </div>

            {useTokenList && (
                <button className="btn btn-secondary mb-3" onClick={fetchTokenBalances} disabled={loading}>
                    {loading ? "Fetching balances..." : "Fetch Token Balances"}
                </button>
            )}

            <div className="mb-3">
                <label>Input Token:</label>
                {useTokenList ? (
                    <select
                        className="form-select"
                        onChange={(e) => setInputToken(e.target.value)}
                        value={inputToken}
                    >
                        {tokenList.map((token) => (
                            <option key={token.address} value={token.address}>
                                {token.symbol} - {balances[token.address] || "0"}
                            </option>
                        ))}
                    </select>
                ) : (
                    <div className="input-group">
                        <input
                            className="form-control"
                            placeholder="Enter token address"
                            value={inputToken}
                            onChange={(e) => setInputToken(e.target.value)}
                        />
                        <button
                            className="btn btn-outline-secondary"
                            onClick={() =>
                                fetchTokenDetails(inputToken, (data) => setMessage(`${data.symbol} - ${data.balance}`))
                            }
                        >
                            Get Token
                        </button>
                    </div>
                )}
            </div>

            <div className="mb-3">
                <label>Output Token:</label>
                {useTokenList ? (
                    <select
                        className="form-select"
                        onChange={(e) => setOutputToken(e.target.value)}
                        value={outputToken}
                    >
                        {tokenList.map((token) => (
                            <option key={token.address} value={token.address}>
                                {token.symbol} - {balances[token.address] || "0"}
                            </option>
                        ))}
                    </select>
                ) : (
                    <div className="input-group">
                        <input
                            className="form-control"
                            placeholder="Enter token address"
                            value={outputToken}
                            onChange={(e) => setOutputToken(e.target.value)}
                        />
                        <button
                            className="btn btn-outline-secondary"
                            onClick={() =>
                                fetchTokenDetails(outputToken, (data) => setMessage(`${data.symbol} - ${data.balance}`))
                            }
                        >
                            Get Token
                        </button>
                    </div>
                )}
            </div>

            <div className="mb-3">
                <label>Input Amount:</label>
                <input
                    className="form-control"
                    type="number"
                    value={inputAmount}
                    onChange={(e) => setInputAmount(e.target.value)}
                />
            </div>

            <div className="mb-3">
                <label>Slippage:</label>
                <input
                    className="form-control"
                    type="number"
                    step="0.1"
                    min="0"
                    value={slippage}
                    onChange={(e) => setSlippage(e.target.value)}
                />
            </div>

            <div className="mb-3">
                <label>Receiver Address (optional):</label>
                <input
                    className="form-control"
                    placeholder="Enter receiver address"
                    value={receiver}
                    onChange={(e) => setReceiver(e.target.value)}
                />
                <small className="text-muted">
                    Please use this field only if you want to send tokens to another address. This may involve risk.
                </small>
            </div>

            <button
                className="btn btn-primary mb-3"
                onClick={fetchQuote}
                disabled={isFetching || !inputAmount || !inputToken || !outputToken || loading}
            >
                {isFetching ? "Fetching..." : "Get Quote"}
            </button>


            {quote && (
                <div className="mt-3">
                    <div className="p-3 border border-secondary rounded">
                        <p style={{ fontSize: "0.9rem", margin: "4px 0" }}>
                            <strong>Input Token:</strong> {quote.inputToken}
                        </p>
                        <p style={{ fontSize: "0.9rem", margin: "4px 0" }}>
                            <strong>Output Token:</strong> {quote.outputToken}
                        </p>
                        <p style={{ fontSize: "0.9rem", margin: "4px 0" }}>
                            <strong>Input Amount:</strong> {quote.inputAmount}
                        </p>
                        <p style={{ fontSize: "0.9rem", margin: "4px 0" }}>
                            <strong>Estimated Output:</strong> {quote.estimatedOutput}
                        </p>
                        <p style={{ fontSize: "0.9rem", margin: "4px 0" }}>
                            <strong>Gas Fee:</strong> {quote.gasFee}
                        </p>
                        {receiver && (
                            <p
                                style={{
                                    fontSize: "1rem",
                                    fontWeight: "bold",
                                    color: "#dc3545", // Bootstrap's danger color
                                    marginTop: "10px",
                                }}
                            >
                                <strong>Receiver Address:</strong> {receiver}
                            </p>
                        )}
                    </div>
                    <button
                        className="btn btn-success mt-2"
                        onClick={executeSwap}
                        disabled={
                            inputToken !== "PLS" &&
                            parseFloat(inputAmount) > parseFloat(balances[inputToken] || "0")
                        }
                    >
                        {parseFloat(inputAmount) >
                            parseFloat(balances[inputToken] || "0")
                            ? "Insufficient Balance"
                            : "Swap"}
                    </button>
                </div>
            )}


            {transactionHash && (
                <div className="mt-3">
                    <p>Transaction Successful! <a href={`https://otter-pulsechain.g4mm4.io/tx/${transactionHash}`} target="_blank" rel="noopener noreferrer">View on Explorer</a></p>
                </div>
            )}

            {message && (
                <div className="alert alert-info alert-dismissible fade show mt-3" role="alert">
                    {message}
                    <button type="button" className="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
                </div>
            )}

            {balanceFetchStatus && (
                <div className="alert alert-secondary mt-3">
                    {balanceFetchStatus}
                </div>
            )}
        </div>
    );
};

export default App;
