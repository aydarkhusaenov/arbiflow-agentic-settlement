"use client";

import {
  Ban,
  CheckCircle2,
  Copy,
  ExternalLink,
  FilePlus2,
  Link2,
  Loader2,
  LogOut,
  RefreshCw,
  RotateCcw,
  Send,
  ShieldCheck,
  Undo2,
  Wallet
} from "lucide-react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { formatEther, isAddress, keccak256, parseEther, parseUnits, toBytes, zeroAddress, zeroHash } from "viem";
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useSwitchChain,
  useWriteContract
} from "wagmi";
import { arbitrumSepolia, hardhat } from "wagmi/chains";
import { assessInvoice, AgentAction, AgentContextRecord, InvoiceRecord, stateLabels } from "@/lib/agent";
import { invoiceEscrowAbi } from "@/lib/abi";

const DAY = 24 * 60 * 60;
const HOUR = 60 * 60;

type CreateForm = {
  recipient: string;
  token: string;
  tokenDecimals: string;
  amount: string;
  metadataHash: string;
  dueDays: string;
  timeoutHours: string;
};

type MandateForm = {
  payerAgent: string;
  recipientAgent: string;
  mandate: string;
  policy: string;
  slaHours: string;
};

const defaultForm: CreateForm = {
  recipient: "",
  token: "",
  tokenDecimals: "18",
  amount: "0.05",
  metadataHash: "ipfs://arbiflow-invoice-demo",
  dueDays: "7",
  timeoutHours: "72"
};

const defaultMandateForm: MandateForm = {
  payerAgent: "erc8004:payer-agent:max-spend-and-refund-rights",
  recipientAgent: "erc8004:service-agent:delivery-proof-required",
  mandate: "Pay for the invoice only under the attached metadata, delivery evidence, and settlement rules.",
  policy: "Release on buyer confirmation, attach evidence for disputes, allow counterparty-approved split settlement.",
  slaHours: "72"
};

export default function Home() {
  const { address, isConnected, chain } = useAccount();
  const chainId = useChainId();
  const { connect, connectors, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [form, setForm] = useState<CreateForm>(defaultForm);
  const [mandateForm, setMandateForm] = useState<MandateForm>(defaultMandateForm);
  const [selectedId, setSelectedId] = useState<bigint | null>(null);
  const [addressOverride, setAddressOverride] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [txError, setTxError] = useState("");
  const [deliveryHash, setDeliveryHash] = useState("ipfs://arbiflow-delivery-proof");
  const [settlementAmount, setSettlementAmount] = useState("");
  const [settlementMemoHash, setSettlementMemoHash] = useState("ipfs://arbiflow-settlement-plan");

  useEffect(() => {
    const storedAddress = window.localStorage.getItem("arbiflow-contract-address");
    if (storedAddress) setAddressOverride(storedAddress);
  }, []);

  useEffect(() => {
    if (address && !form.recipient) {
      setForm((current) => ({ ...current, recipient: address }));
    }
  }, [address, form.recipient]);

  const contractAddress = useMemo(() => {
    const envAddress = process.env.NEXT_PUBLIC_ESCROW_ADDRESS;
    const candidate = addressOverride || envAddress || "";
    return isAddress(candidate) ? (candidate as `0x${string}`) : undefined;
  }, [addressOverride]);

  const {
    data: invoiceCount,
    refetch: refetchCount,
    isLoading: countLoading
  } = useReadContract({
    address: contractAddress,
    abi: invoiceEscrowAbi,
    functionName: "invoiceCount",
    query: { enabled: Boolean(contractAddress) }
  });

  const invoiceIds = useMemo(() => {
    const count = Number(invoiceCount ?? 0n);
    const length = Math.min(count, 16);
    return Array.from({ length }, (_, index) => BigInt(count - 1 - index));
  }, [invoiceCount]);

  const invoiceContracts = useMemo(
    () =>
      invoiceIds.map((id) => ({
        address: contractAddress,
        abi: invoiceEscrowAbi,
        functionName: "getInvoice" as const,
        args: [id] as const
      })),
    [contractAddress, invoiceIds]
  );

  const {
    data: invoiceReadData,
    refetch: refetchInvoices,
    isLoading: invoicesLoading
  } = useReadContracts({
    contracts: invoiceContracts,
    query: { enabled: Boolean(contractAddress && invoiceContracts.length > 0) }
  });

  const invoices = useMemo(() => {
    return (invoiceReadData ?? [])
      .map((item, index) => (item.status === "success" && item.result ? toInvoiceRecord(invoiceIds[index], item.result) : null))
      .filter((invoice): invoice is InvoiceRecord => Boolean(invoice));
  }, [invoiceReadData, invoiceIds]);

  useEffect(() => {
    if (!selectedId && invoices.length > 0) {
      setSelectedId(invoices[0].id);
    }
  }, [invoices, selectedId]);

  const selectedInvoice = invoices.find((invoice) => invoice.id === selectedId) ?? invoices[0];

  const {
    data: selectedAgentContextData,
    refetch: refetchAgentContext
  } = useReadContract({
    address: contractAddress,
    abi: invoiceEscrowAbi,
    functionName: "getAgentContext",
    args: selectedInvoice ? [selectedInvoice.id] : undefined,
    query: { enabled: Boolean(contractAddress && selectedInvoice) }
  });

  const {
    data: selectedReceiptHash,
    refetch: refetchReceiptHash
  } = useReadContract({
    address: contractAddress,
    abi: invoiceEscrowAbi,
    functionName: "settlementReceiptHash",
    args: selectedInvoice ? [selectedInvoice.id] : undefined,
    query: { enabled: Boolean(contractAddress && selectedInvoice) }
  });

  const selectedAgentContext = selectedAgentContextData ? toAgentContextRecord(selectedAgentContextData) : undefined;
  const assessment = selectedInvoice ? assessInvoice(selectedInvoice, address, undefined, selectedAgentContext, selectedReceiptHash) : null;
  const wrongChain = isConnected && chainId !== arbitrumSepolia.id && chainId !== hardhat.id;
  const explorerBase = chainId === hardhat.id ? "" : "https://sepolia.arbiscan.io";
  const selectedInvoiceId = selectedInvoice?.id.toString();
  const isSelectedActive = selectedInvoice ? selectedInvoice.state === 1 || selectedInvoice.state === 2 : false;
  const isSelectedRecipient = Boolean(
    selectedInvoice && address && selectedInvoice.recipient.toLowerCase() === address.toLowerCase()
  );
  const isSelectedPayer = Boolean(selectedInvoice && address && selectedInvoice.payer.toLowerCase() === address.toLowerCase());
  const canProposeSettlement = Boolean(selectedInvoice && isSelectedActive && (isSelectedRecipient || isSelectedPayer));
  const settlementOpen = Boolean(selectedInvoice && selectedInvoice.settlementProposedBy !== zeroAddress);
  const mandateAttached = Boolean(selectedAgentContext && selectedAgentContext.mandateHash !== zeroHash);
  const canAcceptSettlement = Boolean(
    selectedInvoice &&
      settlementOpen &&
      (isSelectedRecipient || isSelectedPayer) &&
      address &&
      selectedInvoice.settlementProposedBy.toLowerCase() !== address.toLowerCase()
  );

  useEffect(() => {
    if (!selectedInvoice) return;
    const suggested = (selectedInvoice.amount * 8n) / 10n;
    setSettlementAmount(trimDecimal(formatEther(suggested)));
  }, [selectedInvoiceId]);

  function updateContractAddress(nextAddress: string) {
    setAddressOverride(nextAddress);
    window.localStorage.setItem("arbiflow-contract-address", nextAddress);
  }

  async function refreshAll() {
    await refetchCount();
    await refetchInvoices();
    await refetchAgentContext();
    await refetchReceiptHash();
  }

  async function submitCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setTxError("");

    if (!contractAddress) {
      setTxError("Contract address is required.");
      return;
    }
    if (!isAddress(form.recipient)) {
      setTxError("Recipient address is invalid.");
      return;
    }

    const token = form.token.trim() ? form.token.trim() : zeroAddress;
    if (!isAddress(token)) {
      setTxError("Token address is invalid.");
      return;
    }

    let amount: bigint;
    try {
      const parsedDecimals = Number(form.tokenDecimals || "18");
      const tokenDecimals = Number.isFinite(parsedDecimals) ? Math.min(36, Math.max(0, Math.round(parsedDecimals))) : 18;
      amount =
        token === zeroAddress
          ? parseEther(form.amount || "0")
          : parseUnits(form.amount || "0", tokenDecimals);
    } catch {
      setTxError("Amount is invalid.");
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const dueDays = Math.max(0, Number(form.dueDays || "0"));
    const timeoutHours = Math.max(1, Number(form.timeoutHours || "1"));
    const dueAt = BigInt(now + Math.round(dueDays * DAY));
    const timeout = BigInt(Math.round(timeoutHours * HOUR));
    await runWrite("createInvoice", [
      form.recipient as `0x${string}`,
      token as `0x${string}`,
      amount,
      form.metadataHash || "ipfs://arbiflow-invoice",
      dueAt,
      timeout
    ]);
  }

  async function runAction(action: AgentAction["id"], invoice: InvoiceRecord) {
    if (action === "pay") {
      await runWrite("payInvoice", [invoice.id], invoice.token === zeroAddress ? invoice.amount : undefined);
      return;
    }
    if (action === "release") {
      await runWrite("release", [invoice.id]);
      return;
    }
    if (action === "requestRefund") {
      await runWrite("requestRefund", [invoice.id]);
      return;
    }
    if (action === "refund") {
      await runWrite("refund", [invoice.id]);
      return;
    }
    if (action === "acceptSettlement") {
      await runWrite("acceptSettlement", [invoice.id]);
      return;
    }
    await runWrite("cancelUnpaid", [invoice.id]);
  }

  async function submitDelivery(invoice: InvoiceRecord) {
    const evidence = deliveryHash.trim();
    if (!evidence) {
      setTxError("Delivery evidence hash is required.");
      return;
    }
    await runWrite("markDelivered", [invoice.id, evidence]);
  }

  async function submitSettlement(invoice: InvoiceRecord) {
    let recipientAmount: bigint;
    try {
      recipientAmount = parseEther(settlementAmount || "0");
    } catch {
      setTxError("Settlement amount is invalid.");
      return;
    }
    if (recipientAmount > invoice.amount) {
      setTxError("Settlement recipient amount cannot exceed invoice amount.");
      return;
    }
    await runWrite("proposeSettlement", [invoice.id, recipientAmount, settlementMemoHash || "ipfs://arbiflow-settlement"]);
  }

  async function submitMandate(invoice: InvoiceRecord) {
    const mandate = mandateForm.mandate.trim();
    if (!mandate) {
      setTxError("Agent mandate text or hash is required.");
      return;
    }
    const slaHours = Math.max(0, Number(mandateForm.slaHours || "0"));
    const slaDeadline = BigInt(Math.floor(Date.now() / 1000) + Math.round(slaHours * HOUR));
    await runWrite("attachAgentMandate", [
      invoice.id,
      hashOrZero(mandateForm.payerAgent),
      hashOrZero(mandateForm.recipientAgent),
      hashText(mandate),
      hashOrZero(mandateForm.policy),
      slaDeadline
    ]);
  }

  async function runWrite(functionName: string, args: readonly unknown[], value?: bigint) {
    if (!contractAddress) {
      setTxError("Contract address is required.");
      return;
    }

    try {
      setPendingAction(functionName);
      setTxError("");
      const hash = await writeContractAsync({
        address: contractAddress,
        abi: invoiceEscrowAbi,
        functionName,
        args,
        value
      } as never);
      setTxHash(hash);
      if (publicClient) {
        await publicClient.waitForTransactionReceipt({ hash });
      }
      await refreshAll();
    } catch (error) {
      setTxError(getErrorMessage(error));
    } finally {
      setPendingAction(null);
    }
  }

  const activeConnector = connectors[0];

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brandMark">AF</div>
          <div>
            <h1>ArbiFlow</h1>
            <span>Arbitrum Sepolia settlement desk</span>
          </div>
        </div>

        <div className="walletControls">
          {wrongChain ? (
            <button className="button warning" type="button" onClick={() => switchChain({ chainId: arbitrumSepolia.id })}>
              <Link2 aria-hidden />
              Arbitrum Sepolia
            </button>
          ) : null}

          {isConnected ? (
            <>
              <span className="addressPill">{shortAddress(address)}</span>
              <button className="iconButton" type="button" title="Disconnect wallet" onClick={() => disconnect()}>
                <LogOut aria-hidden />
              </button>
            </>
          ) : (
            <button className="button primary" type="button" disabled={!activeConnector || isConnecting} onClick={() => connect({ connector: activeConnector })}>
              {isConnecting ? <Loader2 className="spin" aria-hidden /> : <Wallet aria-hidden />}
              Connect
            </button>
          )}
        </div>
      </header>

      <section className="summaryRail" aria-label="Project status">
        <StatusTile label="Contract" value={contractAddress ? shortAddress(contractAddress) : "unset"} tone={contractAddress ? "good" : "warn"} />
        <StatusTile label="Invoices" value={countLoading ? "..." : String(invoiceCount ?? 0n)} tone="neutral" />
        <StatusTile label="Chain" value={chain?.name ?? "wallet off"} tone={wrongChain ? "warn" : "good"} />
        <StatusTile label="Agent" value="state aware" tone="good" />
      </section>

      <section className="contractBar">
        <label htmlFor="contractAddress">Contract address</label>
        <input
          id="contractAddress"
          value={addressOverride}
          onChange={(event) => updateContractAddress(event.target.value)}
          placeholder={process.env.NEXT_PUBLIC_ESCROW_ADDRESS || "0x..."}
          spellCheck={false}
        />
        {contractAddress && explorerBase ? (
          <a className="iconButton linkButton" href={`${explorerBase}/address/${contractAddress}`} target="_blank" rel="noreferrer" title="Open explorer">
            <ExternalLink aria-hidden />
          </a>
        ) : null}
        <button className="iconButton" type="button" onClick={refreshAll} title="Refresh invoices">
          <RefreshCw aria-hidden />
        </button>
      </section>

      <div className="workspace">
        <section className="panel createPanel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">New invoice</span>
              <h2>Create escrow</h2>
            </div>
            <FilePlus2 aria-hidden />
          </div>

          <form className="formGrid" onSubmit={submitCreate}>
            <label>
              Recipient
              <input
                value={form.recipient}
                onChange={(event) => setForm({ ...form, recipient: event.target.value })}
                placeholder="0x..."
                spellCheck={false}
              />
            </label>

            <label>
              Amount
              <input
                value={form.amount}
                onChange={(event) => setForm({ ...form, amount: event.target.value })}
                inputMode="decimal"
                placeholder="0.05"
              />
            </label>

            <label>
              Token
              <input
                value={form.token}
                onChange={(event) => setForm({ ...form, token: event.target.value })}
                placeholder="ETH"
                spellCheck={false}
              />
            </label>

            <label>
              Decimals
              <input
                value={form.tokenDecimals}
                onChange={(event) => setForm({ ...form, tokenDecimals: event.target.value })}
                inputMode="numeric"
                placeholder="18"
              />
            </label>

            <label>
              Metadata
              <input
                value={form.metadataHash}
                onChange={(event) => setForm({ ...form, metadataHash: event.target.value })}
                placeholder="ipfs://..."
                spellCheck={false}
              />
            </label>

            <label>
              Due days
              <input
                value={form.dueDays}
                onChange={(event) => setForm({ ...form, dueDays: event.target.value })}
                inputMode="decimal"
                placeholder="7"
              />
            </label>

            <label>
              Timeout hours
              <input
                value={form.timeoutHours}
                onChange={(event) => setForm({ ...form, timeoutHours: event.target.value })}
                inputMode="decimal"
                placeholder="72"
              />
            </label>

            <button className="button primary fullWidth" disabled={!isConnected || Boolean(pendingAction)} type="submit">
              {pendingAction === "createInvoice" ? <Loader2 className="spin" aria-hidden /> : <FilePlus2 aria-hidden />}
              Create
            </button>
          </form>
        </section>

        <section className="panel ledgerPanel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Live ledger</span>
              <h2>Invoices</h2>
            </div>
            <button className="iconButton" type="button" onClick={refreshAll} title="Refresh ledger">
              <RefreshCw aria-hidden />
            </button>
          </div>

          <div className="invoiceList">
            {invoicesLoading ? <div className="emptyState">Loading invoices</div> : null}
            {!invoicesLoading && invoices.length === 0 ? <div className="emptyState">No invoices found</div> : null}
            {invoices.map((invoice) => (
              <button
                key={invoice.id.toString()}
                className={`invoiceRow ${selectedInvoice?.id === invoice.id ? "selected" : ""}`}
                type="button"
                onClick={() => setSelectedId(invoice.id)}
              >
                <div>
                  <strong>#{invoice.id.toString()}</strong>
                  <span>{invoice.metadataHash}</span>
                </div>
                <div className="invoiceMeta">
                  <StatusBadge state={invoice.state} />
                  <span>{formatAmount(invoice)}</span>
                </div>
              </button>
            ))}
          </div>
        </section>

        <aside className="panel agentPanel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Agent</span>
              <h2>Next action</h2>
            </div>
            <ShieldCheck aria-hidden />
          </div>

          {selectedInvoice && assessment ? (
            <>
              <div className={`agentCallout ${assessment.risk}`}>
                <span>{stateLabels[selectedInvoice.state]}</span>
                <p>{assessment.headline}</p>
              </div>

              <dl className="detailList">
                <div>
                  <dt>Recipient</dt>
                  <dd>{shortAddress(selectedInvoice.recipient)}</dd>
                </div>
                <div>
                  <dt>Payer</dt>
                  <dd>{selectedInvoice.payer === zeroAddress ? "open" : shortAddress(selectedInvoice.payer)}</dd>
                </div>
                <div>
                  <dt>Due</dt>
                  <dd>{formatTimestamp(selectedInvoice.dueAt)}</dd>
                </div>
                <div>
                  <dt>Timeout</dt>
                  <dd>{formatDuration(selectedInvoice.timeout)}</dd>
                </div>
                <div>
                  <dt>Delivery</dt>
                  <dd>{selectedInvoice.deliveryHash ? "attached" : "missing"}</dd>
                </div>
                <div>
                  <dt>Settlement</dt>
                  <dd>{settlementOpen ? "proposed" : "none"}</dd>
                </div>
                <div>
                  <dt>Mandate</dt>
                  <dd>{mandateAttached ? "attached" : "missing"}</dd>
                </div>
                <div>
                  <dt>Receipt</dt>
                  <dd>{selectedReceiptHash ? shortHash(selectedReceiptHash) : "pending"}</dd>
                </div>
              </dl>

              <div className="actionStack">
                {assessment.actions.map((action) => (
                  <button
                    key={action.id}
                    className="button action"
                    type="button"
                    disabled={!action.enabled || !isConnected || Boolean(pendingAction)}
                    title={action.reason}
                    onClick={() => runAction(action.id, selectedInvoice)}
                  >
                    {actionIcon(action.id, pendingAction)}
                    {action.label}
                  </button>
                ))}
              </div>

              <section className="mandateDesk" aria-label="Agent mandate">
                <label>
                  Payer agent
                  <input
                    value={mandateForm.payerAgent}
                    onChange={(event) => setMandateForm({ ...mandateForm, payerAgent: event.target.value })}
                    placeholder="erc8004:payer-agent"
                    spellCheck={false}
                  />
                </label>
                <label>
                  Service agent
                  <input
                    value={mandateForm.recipientAgent}
                    onChange={(event) => setMandateForm({ ...mandateForm, recipientAgent: event.target.value })}
                    placeholder="erc8004:service-agent"
                    spellCheck={false}
                  />
                </label>
                <label>
                  Mandate
                  <input
                    value={mandateForm.mandate}
                    onChange={(event) => setMandateForm({ ...mandateForm, mandate: event.target.value })}
                    placeholder="signed payment intent or 0x hash"
                    spellCheck={false}
                  />
                </label>
                <label>
                  Policy
                  <input
                    value={mandateForm.policy}
                    onChange={(event) => setMandateForm({ ...mandateForm, policy: event.target.value })}
                    placeholder="agent risk policy or 0x hash"
                    spellCheck={false}
                  />
                </label>
                <label>
                  SLA hours
                  <input
                    value={mandateForm.slaHours}
                    onChange={(event) => setMandateForm({ ...mandateForm, slaHours: event.target.value })}
                    inputMode="decimal"
                    placeholder="72"
                  />
                </label>
                <button
                  className="button action"
                  type="button"
                  disabled={!isConnected || !selectedInvoice || selectedInvoice.state >= 3 || Boolean(pendingAction)}
                  title="Attach a hashed agent mandate, identity references, risk policy, and SLA deadline."
                  onClick={() => submitMandate(selectedInvoice)}
                >
                  {pendingAction === "attachAgentMandate" ? <Loader2 className="spin" aria-hidden /> : <ShieldCheck aria-hidden />}
                  Attach mandate
                </button>
                {selectedAgentContext && mandateAttached ? (
                  <div className="proposalBox">
                    <span>Portable receipt</span>
                    <strong>{selectedReceiptHash ? shortHash(selectedReceiptHash) : "pending"}</strong>
                    <small>Mandate {shortHash(selectedAgentContext.mandateHash)} · Policy {shortHash(selectedAgentContext.policyHash)}</small>
                  </div>
                ) : null}
              </section>

              <section className="settlementDesk" aria-label="Settlement tools">
                <label>
                  Delivery evidence
                  <input
                    value={deliveryHash}
                    onChange={(event) => setDeliveryHash(event.target.value)}
                    placeholder="ipfs://delivery-proof"
                    spellCheck={false}
                  />
                </label>
                <button
                  className="button action"
                  type="button"
                  disabled={!isConnected || !isSelectedRecipient || !isSelectedActive || Boolean(pendingAction)}
                  title="Recipient can attach delivery evidence while the invoice is paid or refund requested."
                  onClick={() => submitDelivery(selectedInvoice)}
                >
                  {pendingAction === "markDelivered" ? <Loader2 className="spin" aria-hidden /> : <CheckCircle2 aria-hidden />}
                  Mark delivered
                </button>

                <div className="splitInputs">
                  <label>
                    Recipient payout
                    <input
                      value={settlementAmount}
                      onChange={(event) => setSettlementAmount(event.target.value)}
                      inputMode="decimal"
                      placeholder="0.04"
                    />
                  </label>
                  <label>
                    Memo
                    <input
                      value={settlementMemoHash}
                      onChange={(event) => setSettlementMemoHash(event.target.value)}
                      placeholder="ipfs://settlement-plan"
                      spellCheck={false}
                    />
                  </label>
                </div>

                <button
                  className="button action"
                  type="button"
                  disabled={!isConnected || !canProposeSettlement || Boolean(pendingAction)}
                  title="Payer or recipient can propose a split settlement for the counterparty to accept."
                  onClick={() => submitSettlement(selectedInvoice)}
                >
                  {pendingAction === "proposeSettlement" ? <Loader2 className="spin" aria-hidden /> : <Send aria-hidden />}
                  Propose split
                </button>

                {settlementOpen ? (
                  <div className="proposalBox">
                    <span>Open split proposal</span>
                    <strong>{formatSettlement(selectedInvoice)}</strong>
                    <button
                      className="button primary"
                      type="button"
                      disabled={!isConnected || !canAcceptSettlement || Boolean(pendingAction)}
                      title="Only the counterparty can accept a settlement proposal."
                      onClick={() => runWrite("acceptSettlement", [selectedInvoice.id])}
                    >
                      {pendingAction === "acceptSettlement" ? <Loader2 className="spin" aria-hidden /> : <CheckCircle2 aria-hidden />}
                      Accept split
                    </button>
                  </div>
                ) : null}
              </section>

              <ul className="agentNotes">
                {assessment.notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </>
          ) : (
            <div className="emptyState">Select an invoice</div>
          )}

          {txHash ? (
            <div className="txBox">
              <span>Last transaction</span>
              <div>
                <code>{shortAddress(txHash)}</code>
                <button className="iconButton" type="button" title="Copy transaction hash" onClick={() => navigator.clipboard.writeText(txHash)}>
                  <Copy aria-hidden />
                </button>
                {explorerBase ? (
                  <a className="iconButton linkButton" href={`${explorerBase}/tx/${txHash}`} target="_blank" rel="noreferrer" title="Open transaction">
                    <ExternalLink aria-hidden />
                  </a>
                ) : null}
              </div>
            </div>
          ) : null}

          {txError ? <div className="errorBox">{txError}</div> : null}
        </aside>
      </div>
    </main>
  );
}

function StatusTile({ label, value, tone }: { label: string; value: string; tone: "good" | "warn" | "neutral" }) {
  return (
    <div className={`statusTile ${tone}`}>
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusBadge({ state }: { state: number }) {
  return (
    <span className={`statusBadge state${state}`}>
      <CheckCircle2 aria-hidden />
      {stateLabels[state] ?? "Unknown"}
    </span>
  );
}

function actionIcon(action: AgentAction["id"], pendingAction: string | null) {
  const spinning = pendingAction && pendingAction !== "";
  if (spinning) return <Loader2 className="spin" aria-hidden />;
  if (action === "pay") return <Send aria-hidden />;
  if (action === "release") return <CheckCircle2 aria-hidden />;
  if (action === "acceptSettlement") return <CheckCircle2 aria-hidden />;
  if (action === "requestRefund") return <Undo2 aria-hidden />;
  if (action === "refund") return <RotateCcw aria-hidden />;
  return <Ban aria-hidden />;
}

function toInvoiceRecord(id: bigint, raw: unknown): InvoiceRecord {
  const value = raw as Record<string, unknown> & readonly unknown[];
  return {
    id,
    creator: (value.creator ?? value[0]) as `0x${string}`,
    payer: (value.payer ?? value[1]) as `0x${string}`,
    recipient: (value.recipient ?? value[2]) as `0x${string}`,
    token: (value.token ?? value[3]) as `0x${string}`,
    amount: BigInt(value.amount as bigint | string | number | undefined ?? (value[4] as bigint)),
    dueAt: BigInt(value.dueAt as bigint | string | number | undefined ?? (value[5] as bigint)),
    paidAt: BigInt(value.paidAt as bigint | string | number | undefined ?? (value[6] as bigint)),
    timeout: BigInt(value.timeout as bigint | string | number | undefined ?? (value[7] as bigint)),
    refundRequestedAt: BigInt(value.refundRequestedAt as bigint | string | number | undefined ?? (value[8] as bigint)),
    settlementProposedAt: BigInt(value.settlementProposedAt as bigint | string | number | undefined ?? (value[9] as bigint)),
    state: Number(value.state ?? value[10]),
    metadataHash: String(value.metadataHash ?? value[11] ?? ""),
    deliveryHash: String(value.deliveryHash ?? value[12] ?? ""),
    settlementMemoHash: String(value.settlementMemoHash ?? value[13] ?? ""),
    settlementProposedBy: (value.settlementProposedBy ?? value[14] ?? zeroAddress) as `0x${string}`,
    settlementRecipientAmount: BigInt(
      value.settlementRecipientAmount as bigint | string | number | undefined ?? (value[15] as bigint | undefined) ?? 0n
    )
  };
}

function toAgentContextRecord(raw: unknown): AgentContextRecord {
  const value = raw as Record<string, unknown> & readonly unknown[];
  return {
    payerAgentHash: (value.payerAgentHash ?? value[0] ?? zeroHash) as `0x${string}`,
    recipientAgentHash: (value.recipientAgentHash ?? value[1] ?? zeroHash) as `0x${string}`,
    mandateHash: (value.mandateHash ?? value[2] ?? zeroHash) as `0x${string}`,
    policyHash: (value.policyHash ?? value[3] ?? zeroHash) as `0x${string}`,
    slaDeadline: BigInt(value.slaDeadline as bigint | string | number | undefined ?? (value[4] as bigint | undefined) ?? 0n),
    attachedAt: BigInt(value.attachedAt as bigint | string | number | undefined ?? (value[5] as bigint | undefined) ?? 0n),
    attachedBy: (value.attachedBy ?? value[6] ?? zeroAddress) as `0x${string}`
  };
}

function shortAddress(value?: string) {
  if (!value) return "not connected";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function shortHash(value?: string) {
  if (!value) return "missing";
  if (value.length <= 18) return value;
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}

function hashText(value: string) {
  const trimmed = value.trim();
  if (/^0x[0-9a-fA-F]{64}$/.test(trimmed)) return trimmed as `0x${string}`;
  return keccak256(toBytes(trimmed));
}

function hashOrZero(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return zeroHash;
  return hashText(trimmed);
}

function formatAmount(invoice: InvoiceRecord) {
  const suffix = invoice.token === zeroAddress ? "ETH" : "TOKEN";
  return `${trimDecimal(formatEther(invoice.amount))} ${suffix}`;
}

function formatSettlement(invoice: InvoiceRecord) {
  const recipient = trimDecimal(formatEther(invoice.settlementRecipientAmount));
  const payer = trimDecimal(formatEther(invoice.amount - invoice.settlementRecipientAmount));
  const suffix = invoice.token === zeroAddress ? "ETH" : "TOKEN";
  return `${recipient} ${suffix} to recipient, ${payer} ${suffix} back`;
}

function formatTimestamp(value: bigint) {
  if (value === 0n) return "open";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(Number(value) * 1000));
}

function formatDuration(value: bigint) {
  const hours = Number(value) / HOUR;
  if (hours < 24) return `${Math.round(hours)}h`;
  return `${Math.round(hours / 24)}d`;
}

function trimDecimal(value: string) {
  return value.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.split("\n")[0];
  }
  return "Transaction failed.";
}
