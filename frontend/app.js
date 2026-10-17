/* WarrantyChain frontend – MetaMask + Ethers.js v6 */

const { ethers } = window;
const { CONTRACT_ADDRESS, CONTRACT_ABI } = window.WARRANTY_CONFIG;

const NETWORKS = {
  1337: "Ganache",
  5777: "Ganache",
  31337: "Hardhat",
  11155111: "Sepolia",
  17000: "Holesky",
};
const CLAIM_STATUS = ["Pending", "Approved", "Rejected"];

let provider, signer, contract, account;

const $ = (id) => document.getElementById(id);
const short = (a) => (a ? `${a.slice(0, 6)}…${a.slice(-4)}` : "–");
const fmtDate = (ts) => new Date(Number(ts) * 1000).toLocaleString();

// ---------------------------------------------------------------------------
// Logging & error handling
// ---------------------------------------------------------------------------

function log(message, type = "info") {
  const li = document.createElement("li");
  li.className = type;
  li.innerHTML = `<time>${new Date().toLocaleTimeString()}</time>${message}`;
  $("txLog").prepend(li);
  return li;
}

function errorMessage(e) {
  if (e?.code === "ACTION_REJECTED" || e?.info?.error?.code === 4001) return "Transaction rejected in MetaMask by the user.";
  const candidates = [
    e?.reason,
    e?.revert?.args?.[0],
    e?.info?.error?.data?.message,
    e?.info?.error?.message,
    e?.error?.message,
    e?.shortMessage,
    e?.message,
  ];
  const msg = candidates.find((m) => typeof m === "string" && m.length) || "Unknown error";
  return msg.replace(/^.*reverted with reason string '?/, "").replace(/'$/, "").replace(/^execution reverted:?\s*/i, "");
}

// ---------------------------------------------------------------------------
// Wallet connection
// ---------------------------------------------------------------------------

async function connect() {
  if (!window.ethereum) {
    log("MetaMask not detected. Install the MetaMask extension and reload.", "error");
    alert("MetaMask is not installed.");
    return;
  }
  if (!ethers.isAddress(CONTRACT_ADDRESS) || CONTRACT_ADDRESS === ethers.ZeroAddress) {
    log("Set CONTRACT_ADDRESS in frontend/config.js to your deployed contract address.", "error");
    return;
  }
  try {
    provider = new ethers.BrowserProvider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    signer = await provider.getSigner();
    account = await signer.getAddress();

    const code = await provider.getCode(CONTRACT_ADDRESS);
    if (code === "0x") {
      log(`No contract found at ${CONTRACT_ADDRESS} on this network. Check the selected network in MetaMask.`, "error");
      return;
    }
    contract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, signer);

    const net = await provider.getNetwork();
    const chainId = Number(net.chainId);
    $("networkBadge").textContent = `${NETWORKS[chainId] || "Chain"} (${chainId})`;
    $("networkBadge").className = "badge ok";
    $("accountLabel").textContent = short(account);
    $("accountLabel").title = account;
    $("connectBtn").textContent = "Connected";
    $("connectBtn").disabled = true;
    $("refreshBtn").disabled = false;
    $("loadMineBtn").disabled = false;

    log(`Connected ${account} on chain ${chainId}`, "success");
    await refreshAll();
    subscribeEvents();
  } catch (e) {
    log(`Connection failed: ${errorMessage(e)}`, "error");
  }
}

async function detectRole() {
  const [owner, isRetailer] = await Promise.all([contract.manufacturer(), contract.authorizedRetailers(account)]);
  const isOwner = owner.toLowerCase() === account.toLowerCase();
  const badge = $("roleBadge");
  badge.classList.remove("hidden");
  if (isOwner) { badge.textContent = "Manufacturer"; badge.className = "badge owner"; }
  else if (isRetailer) { badge.textContent = "Retailer"; badge.className = "badge retailer"; }
  else { badge.textContent = "Customer"; badge.className = "badge customer"; }

  document.querySelectorAll(".role-owner").forEach((el) => el.classList.toggle("locked", !isOwner));
  document.querySelectorAll(".role-retailer").forEach((el) => el.classList.toggle("locked", !isRetailer));
}

// ---------------------------------------------------------------------------
// Reading blockchain data
// ---------------------------------------------------------------------------

async function refreshAll() {
  await Promise.all([loadOverview(), detectRole(), loadMine()]);
}

async function loadOverview() {
  const [brand, owner, max, total, claims] = await Promise.all([
    contract.brandName(),
    contract.manufacturer(),
    contract.maxWarrantyDays(),
    contract.totalWarranties(),
    contract.totalClaims(),
  ]);
  $("statBrand").textContent = brand;
  $("statOwner").textContent = short(owner);
  $("statOwner").title = owner;
  $("statMax").textContent = `${max} days`;
  $("statTotal").textContent = total.toString();
  $("statClaims").textContent = claims.toString();
  $("statAddress").textContent = short(CONTRACT_ADDRESS);
  $("statAddress").title = CONTRACT_ADDRESS;
}

async function loadMine() {
  const ul = $("myList");
  const serials = await contract.getWarrantiesOf(account);
  ul.innerHTML = "";
  if (!serials.length) {
    ul.innerHTML = '<li class="muted">No warranties held by this account.</li>';
    return;
  }
  for (const s of serials) {
    const valid = await contract.isWarrantyValid(s);
    const li = document.createElement("li");
    li.innerHTML = `<a data-serial="${s}">${s}</a><span class="status ${valid ? "valid" : "invalid"}">${valid ? "Valid" : "Expired / void"}</span>`;
    ul.appendChild(li);
  }
}

async function verify(serial) {
  const box = $("verifyResult");
  box.classList.remove("hidden", "valid", "invalid");
  try {
    const w = await contract.getWarranty(serial);
    const valid = await contract.isWarrantyValid(serial);
    const ids = await contract.getClaimIds(serial);
    const claims = await Promise.all(ids.map((id) => contract.getClaim(id)));
    const daysLeft = Math.max(0, Math.ceil((Number(w.expiryDate) * 1000 - Date.now()) / 86400000));

    box.classList.add(valid ? "valid" : "invalid");
    box.innerHTML = `
      <span class="status ${valid ? "valid" : "invalid"}">${valid ? "✔ VALID WARRANTY" : w.voided ? "✖ VOIDED" : "✖ EXPIRED"}</span>
      <dl>
        <dt>Serial</dt><dd>${w.serialNumber}</dd>
        <dt>Model</dt><dd>${w.productModel}</dd>
        <dt>Holder</dt><dd class="mono">${w.holder}</dd>
        <dt>Retailer</dt><dd class="mono">${w.retailer}</dd>
        <dt>Purchased</dt><dd>${fmtDate(w.purchaseDate)}</dd>
        <dt>Expires</dt><dd>${fmtDate(w.expiryDate)}${valid ? ` (${daysLeft} days left)` : ""}</dd>
        <dt>Transfers</dt><dd>${w.transferCount}</dd>
      </dl>
      <div class="claims">
        <h4>Claim history (${claims.length})</h4>
        ${claims.length ? claims.map((c) => `
          <div class="claim">#${c.id} · <b>${CLAIM_STATUS[Number(c.status)]}</b> · ${fmtDate(c.filedAt)}<br/>${c.issue}</div>`).join("") : '<div class="muted">No claims filed.</div>'}
      </div>`;
    log(`Read warranty ${serial} from chain (${valid ? "valid" : "not valid"})`, "info");
  } catch (e) {
    box.classList.add("invalid");
    box.innerHTML = `<span class="status invalid">✖ ${errorMessage(e)}</span>`;
    log(`Verify "${serial}" failed: ${errorMessage(e)}`, "error");
  }
}

// ---------------------------------------------------------------------------
// Sending transactions
// ---------------------------------------------------------------------------

async function sendTx(label, fn, ...args) {
  if (!contract) { log("Connect MetaMask first.", "error"); return false; }
  const entry = log(`${label}: waiting for MetaMask confirmation…`, "pending");
  try {
    const tx = await contract[fn](...args);
    entry.innerHTML = `<time>${new Date().toLocaleTimeString()}</time>${label}: submitted <span class="mono">${tx.hash}</span>`;
    const receipt = await tx.wait();
    entry.className = "success";
    entry.innerHTML = `<time>${new Date().toLocaleTimeString()}</time>✔ ${label} confirmed in block ${receipt.blockNumber} · gas ${receipt.gasUsed} · tx <span class="mono">${tx.hash}</span>`;
    await refreshAll();
    return true;
  } catch (e) {
    entry.className = "error";
    entry.innerHTML = `<time>${new Date().toLocaleTimeString()}</time>✖ ${label} failed: <b>${errorMessage(e)}</b>`;
    return false;
  }
}

function requireAddress(value, field) {
  if (!ethers.isAddress(value.trim())) {
    log(`Invalid input: "${value}" is not a valid Ethereum address (${field}).`, "error");
    return null;
  }
  return ethers.getAddress(value.trim());
}

// Client-side checks are intentionally light: the smart contract is the
// source of truth for validation, so invalid inputs still reach it and
// its revert reason is shown in the log.

$("issueForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const buyer = requireAddress($("issueBuyer").value, "buyer");
  if (!buyer) return;
  const ok = await sendTx("Issue warranty", "issueWarranty",
    $("issueSerial").value.trim(), $("issueModel").value.trim(), buyer, BigInt($("issueDays").value || 0));
  if (ok) ev.target.reset();
});

$("transferForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const to = requireAddress($("transferTo").value, "new holder");
  if (!to) return;
  const ok = await sendTx("Transfer warranty", "transferWarranty", $("transferSerial").value.trim(), to);
  if (ok) ev.target.reset();
});

$("claimForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const ok = await sendTx("File claim", "fileClaim", $("claimSerial").value.trim(), $("claimIssue").value.trim());
  if (ok) ev.target.reset();
});

$("retailerForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const authorize = ev.submitter?.dataset.auth === "true";
  const addr = requireAddress($("retailerAddr").value, "retailer");
  if (!addr) return;
  await sendTx(authorize ? "Authorize retailer" : "Revoke retailer", "setRetailer", addr, authorize);
});

$("checkRetailerForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  if (!contract) return log("Connect MetaMask first.", "error");
  const addr = requireAddress($("checkRetailerAddr").value, "retailer");
  if (!addr) return;
  const yes = await contract.authorizedRetailers(addr);
  $("retailerResult").textContent = `${short(addr)} is ${yes ? "an AUTHORIZED retailer" : "NOT an authorized retailer"}.`;
});

$("resolveForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const approve = ev.submitter?.dataset.approve === "true";
  await sendTx(approve ? "Approve claim" : "Reject claim", "resolveClaim", BigInt($("resolveId").value || 0), approve);
});

$("voidForm").addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const ok = await sendTx("Void warranty", "voidWarranty", $("voidSerial").value.trim(), $("voidReason").value.trim());
  if (ok) ev.target.reset();
});

$("verifyForm").addEventListener("submit", (ev) => {
  ev.preventDefault();
  if (!contract) return log("Connect MetaMask first.", "error");
  verify($("verifySerial").value.trim());
});

$("myList").addEventListener("click", (ev) => {
  const serial = ev.target.dataset?.serial;
  if (serial) { $("verifySerial").value = serial; verify(serial); }
});

$("connectBtn").addEventListener("click", connect);
$("refreshBtn").addEventListener("click", () => refreshAll().then(() => log("Data refreshed from chain", "info")));
$("loadMineBtn").addEventListener("click", loadMine);
$("clearLogBtn").addEventListener("click", () => ($("txLog").innerHTML = ""));

// ---------------------------------------------------------------------------
// Live events & MetaMask changes
// ---------------------------------------------------------------------------

let subscribed = false;
function subscribeEvents() {
  if (subscribed) return;
  subscribed = true;
  contract.on("WarrantyIssued", (serial, holder) => log(`Event: WarrantyIssued ${serial} → ${short(holder)}`, "info"));
  contract.on("WarrantyTransferred", (serial, from, to) => log(`Event: WarrantyTransferred ${serial} ${short(from)} → ${short(to)}`, "info"));
  contract.on("ClaimFiled", (id, serial) => log(`Event: ClaimFiled #${id} for ${serial}`, "info"));
  contract.on("ClaimResolved", (id, status) => log(`Event: ClaimResolved #${id} → ${CLAIM_STATUS[Number(status)]}`, "info"));
}

if (window.ethereum) {
  window.ethereum.on("accountsChanged", () => window.location.reload());
  window.ethereum.on("chainChanged", () => window.location.reload());
}
