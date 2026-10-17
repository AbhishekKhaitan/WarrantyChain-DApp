# Screenshots – what to capture

Save the images in this folder with exactly these names so they appear in the main README.

| File | What to capture |
|---|---|
| `01-compile.png` | Remix **Solidity Compiler** tab with the green tick for `WarrantyChain.sol` (show compiler version + EVM version) |
| `02-deploy.png` | Remix **Deploy & Run** tab with the constructor args and the deployed contract under *Deployed Contracts*, plus the green ✔ deployment line in the Remix terminal |
| `03-metamask-connect.png` | The DApp after clicking **Connect MetaMask** – network badge, role badge, account, and the MetaMask popup / connected status |
| `04-success-tx.png` | MetaMask confirmation popup for `issueWarranty`, and/or the green ✔ entry in the DApp **Transaction log** with tx hash and block number |
| `05-failed-tx.png` | A red ✖ entry in the **Transaction log**, e.g. *Unauthorized: only manufacturer* (Customer tries to authorize a retailer) or *Serial already registered*. Tip: in Remix, call a function that reverts – Remix shows "Gas estimation failed"; click **Send Transaction** to get a failed (status 0) transaction in Ganache and screenshot the red ✖ in the Remix terminal |
| `06-ui-data.png` | **Verify a warranty** result for `SN-1001` (✔ VALID, holder, expiry, claim history) and the **Contract overview** card |
| `07-remix-tests.png` | Remix **Solidity Unit Testing** plugin showing all tests passing |
| `08-ganache-txs.png` | Ganache **Transactions** tab listing the contract creation and calls |

⚠️ Before taking screenshots, make sure no private key or seed phrase is visible (e.g. close the Ganache key dialog).
