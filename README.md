# Piteas Monorepo

The **Piteas API/SDK Monorepo** provides a comprehensive development environment to interact with the Piteas API. It offers two modes of operation: **Basic** and **Advanced**, designed to cater to developers of varying needs and expertise. 

## Features

### Basic Mode
- Simple interface for quick quotes and swaps.
- Only requires:
  - Input token address.
  - Output token address.
  - Input amount.
  - Slippage settings.
  - (Optional) Receiver address.

### Advanced Mode
- Full-featured DApp with:
  - Wallet connection support.
  - Token list integration.
  - Balance fetching.
  - Approval mechanism for ERC-20 tokens.
  - User-friendly interface with enhanced features.

## Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/piteasio/piteas-api-monorepo.git
   ```

2. Navigate to the project directory:
   ```bash
   cd piteas-api-monorepo
   ```

3. Install dependencies:
   ```bash
   npm install
   ```

4. Start the development server:
   ```bash
   npm start
   ```

   The application will be available at `http://localhost:3000`.

## Usage

### Switching Modes
Upon launching the application, you will see two options: **Basic Mode** and **Advanced Mode**. Select the desired mode to begin.

### Basic Mode
1. Enter the input token address.
2. Enter the output token address.
3. Specify the input amount and slippage.
4. (Optional) Provide a receiver address.
5. Click **Get Quote** to fetch a swap quote.
6. If satisfied, click **Swap** to execute the transaction.

### Advanced Mode
1. Connect your wallet to enable advanced features.
2. Use the token list to select input and output tokens or provide addresses manually.
3. Fetch balances for a comprehensive overview.
4. Enter the input amount, slippage, and receiver address if applicable.
5. Approve ERC-20 tokens for swap if required.
6. Click **Get Quote** to view detailed quote information.
7. Execute the swap with the **Swap** button.

## Architecture

The monorepo contains modular components that developers can easily integrate into their own projects:
- **SDK/API Integration**: Core logic for interacting with the Piteas API.
- **UI Components**: Flexible components for user interactions.
- **Modes**: Dynamically loadable modules for Basic and Advanced functionalities.

## API Reference

The Piteas Monorepo interacts with the following API endpoints:
- **Active Chain**: Pulsechain
- **Quote API**: `https://sdk.piteas.io/quote`
- **Token List**: `https://raw.githubusercontent.com/piteasio/app-tokens/main/piteas-tokenlist.json`
- **RPC Provider**: `https://rpc.pulsechain.com`

## Contributing

Contributions are welcome! Feel free to open issues or submit pull requests to improve this monorepo.

## License

This project is licensed under the MIT License. See the [LICENSE](LICENSE) file for details.

---

**Happy Coding!**
