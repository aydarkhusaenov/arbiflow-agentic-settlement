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
import { formatEther, isAddress, parseEther, zeroAddress } from "viem";
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
import { assessInvoice, AgentAction, InvoiceRecord, stateLabels } from "@/lib/agent";
import { invoiceEscrowAbi } from "@/lib/abi";

const DAY = 24 * 60 * 60;
const HOUR = 60 * 60;

type CreateForm = {
  recipient: string;
  token: string;
  amount: string;
  metadataHash: string;
  dueDays: string;
  timeoutHours: string;
};

const defaultForm: CreateForm = {
  recipient: "",
  token: "",
  amount: "0.05",
  metadataHash: "ipfs://arbiflow-invoice-demo",
  dueDays: "7",
  timeoutHours: "72"
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
  const [selectedId, setSelectedId] = useState<bigint | null>(null);
  const [addressOverride, setAddressOverride] = useState("");
  const [pendingAction, setPendingAction] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<`0x${string}` | null>(null);
  const [txError, setTxError] = useState("");

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
  const assessment = selectedInvoice ? assessInvoice(selectedInvoice, address) : null;
  const wrongChain = isConnected && chainId !== arbitrumSepolia.id && chainId !== hardhat.id;
  const explorerBase = chainId === hardhat.id ? "" : "https://sepolia.arbiscan.io";

  function updateContractAddress(nextAddress: string) {
    setAddressOverride(nextAddress);
    window.localStorage.setItem("arbiflow-contract-address", nextAddress);
  }

  async function refreshAll() {
    await refetchCount();
    await refetchInvoices();
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
      amount = parseEther(form.amount || "0");
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
    await runWrite("cancelUnpaid", [invoice.id]);
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
    state: Number(value.state ?? value[9]),
    metadataHash: String(value.metadataHash ?? value[10] ?? "")
  };
}

function shortAddress(value?: string) {
  if (!value) return "not connected";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function formatAmount(invoice: InvoiceRecord) {
  const suffix = invoice.token === zeroAddress ? "ETH" : "TOKEN";
  return `${trimDecimal(formatEther(invoice.amount))} ${suffix}`;
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
