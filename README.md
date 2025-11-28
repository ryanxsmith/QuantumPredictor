# QuantumPredictor

QuantumPredictor is a fully homomorphic encryption (FHE) powered prediction market. Creators launch predictions with 2 to 4 options, users cast encrypted choices, and counts stay confidential on-chain until anyone closes the market to make totals publicly decryptable. The stack pairs a Solidity FHE contract with a React + Vite frontend that reads through viem, writes through ethers, and relies on Zama's relayer for encryption and public decryption.

## Why it matters
- Private by default: votes are encrypted end to end, preventing copy trading and manipulation while the market is live.
- Trustless reveal: anyone can close a prediction and trigger public decryption of counts; no central operator decides when results are shown.
- On-chain integrity: all state changes live on Sepolia with FHE-aware Solidity; there are no off-chain tallies or mock data paths.
- Developer ready: Hardhat tasks, tests, and deployment scripts are included for local mocks and Sepolia.

## Core capabilities
- Create predictions with 2-4 labeled options stored on-chain.
- Submit encrypted choices using Zama FHE handles; duplicate votes per address are blocked.
- Keep per-option counts encrypted while open; expose public totals after closure.
- Read flows use viem, write flows use ethers; encryption and decryption use the Zama relayer SDK.
- React frontend shows live markets, voting, closing, and public decryption without localhost networks or local storage.

## Architecture and tech
- Smart contracts: Solidity 0.8.27 with `@fhevm/solidity`, configured through Hardhat, hardhat-deploy, and TypeChain.
- Encryption: `@fhevm/hardhat-plugin` for mocks and CLI encryption helpers; Zama relayer SDK for runtime encryption and public decryption.
- Frontend: React + Vite, RainbowKit/wagmi for wallet UX, viem for reads, ethers for writes, custom CSS (no Tailwind).
- Tooling: Mocha/Chai tests, ESLint/Prettier/Solhint, solidity-coverage, hardhat-gas-reporter.

## Repository layout
- `contracts/QuantumPredictor.sol`: FHE prediction-market contract.
- `deploy/deploy.ts`: hardhat-deploy script to publish the contract.
- `tasks/`: CLI tasks for creating predictions, casting encrypted votes, decrypting counts, and printing addresses.
- `test/`: local mock tests and Sepolia integration test.
- `frontend/`: React + Vite app; configure contract address and ABI under `frontend/src/config/`.
- `docs/`: Zama FHE and relayer references used by the project.

## How the contract works
1) `createPrediction`: deploys a prediction with 2-4 options, initializes encrypted counts to zero, and grants contract ACL permissions.
2) `submitChoice`: accepts an encrypted option index, increments the matching encrypted counter, and rejects duplicate voters.
3) `closePrediction`: stops new votes and marks each encrypted count as publicly decryptable.
4) `getPrediction` and `getEncryptedCounts`: expose data for the frontend and for relayer-based public decryption.

## Local development
### Prerequisites
- Node.js 20+
- npm

### Install dependencies
```bash
npm install
```

### Environment
Create a `.env` in the project root using a funded private key (no mnemonic) and your Infura key:
```
PRIVATE_KEY=0x...
INFURA_API_KEY=your_infura_project_id
ETHERSCAN_API_KEY=optional_for_verification
REPORT_GAS=true # optional
```
The Hardhat config reads `PRIVATE_KEY` and `INFURA_API_KEY` directly; mnemonics are not used.

### Build and test
```bash
npm run compile
npm test
npm run coverage   # optional
npm run lint       # solhint + eslint + prettier check
```
For a local node:
```bash
npm run chain              # start Hardhat node
npm run deploy:localhost   # deploy to the local node
```

## Deploying to Sepolia
1) Ensure `.env` contains `PRIVATE_KEY` (with funds) and `INFURA_API_KEY`.
2) Deploy: `npm run deploy:sepolia`.
3) Verify (optional): `npm run verify:sepolia -- <contract_address>`.
4) After deployment, copy the generated ABI from `deployments/sepolia/QuantumPredictor.json` and update the frontend config to use the real address and ABI.

## Hardhat tasks
- `npx hardhat task:predictor-address --network sepolia` - print the deployed address.
- `npx hardhat task:create-prediction --name "Title" optionA optionB [...] --network sepolia` - create a prediction with 2-4 options.
- `npx hardhat task:vote --prediction <id> --option <index> --network sepolia` - submit an encrypted vote using the CLI encryption helper.
- `npx hardhat task:decrypt-counts --prediction <id> --network sepolia` - decrypt totals after the market is closed.

## Frontend
1) Install: `cd frontend && npm install`.
2) Configure: set `CONTRACT_ADDRESS` in `frontend/src/config/contracts.ts` and replace `CONTRACT_ABI` with the ABI generated in `deployments/sepolia`. No environment variables are used in the frontend.
3) Run: `npm run dev` (development) or `npm run build && npm run preview` (production preview).
4) Behavior: reads on-chain data via viem, writes via ethers, and performs encryption/public decryption with the Zama relayer SDK. No mock data or localhost networks are used.

## Problem statement and advantages
- Problem: typical prediction markets expose order flow and vote totals in real time, enabling frontrunning and herding. Off-chain or obfuscated counts often reduce trust.
- Solution: encrypt every vote handle with Zama FHE so only ciphertext touches the chain while the market is open. Anyone can later close the market to make counts publicly decryptable, delivering verifiable fairness without leaking intermediate totals.
- Additional benefits: deterministic on-chain logic, censorship resistance for closing, and a unified frontend that handles encryption transparently for end users.

## Testing and quality gates
- Unit tests with the FHEVM mock: `npm test`.
- Sepolia integration test (requires deployment): `npm run test:sepolia`.
- Static analysis: `npm run lint` plus `npm run coverage` for instrumentation when needed.
- Gas insights: enable `REPORT_GAS=true` to collect estimates.

## Future roadmap
- Multiple prediction categories with filtering and sorting in the UI.
- Historical archive of closed markets with decrypted result snapshots.
- Event-driven frontend refresh via viem watch functions instead of manual refresh.
- Notification hooks and shareable links for newly created predictions.
- Optional staking or reward modules once the encrypted voting core is battle-tested.
