"use client";

import { ExternalLink, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { isAddress, parseAbiItem, zeroAddress } from "viem";
import { useChainId, usePublicClient, useReadContract, useReadContracts } from "wagmi";
import { invoiceEscrowAbi } from "@/lib/abi";
import { stateLabels } from "@/lib/agent";
import { explorerBaseForChain, hardhat } from "@/lib/chains";
import { formatTokenAmount } from "@/lib/tokens";

const trackedEvents = [
  parseAbiItem("event InvoiceCreated(uint256 indexed invoiceId,address indexed creator,address indexed recipient,address token,uint256 amount,uint64 dueAt,uint64 timeout,string metadataHash)"),
  parseAbiItem("event InvoicePaid(uint256 indexed invoiceId,address indexed payer,address token,uint256 amount)"),
  parseAbiItem("event SettlementReceiptFinalized(uint256 indexed invoiceId,bytes32 indexed receiptHash,uint8 finalState)"),
  parseAbiItem("event AgentFeedbackSubmitted(uint256 indexed invoiceId,address indexed reviewer,bytes32 indexed agentHash,bool recipientAgent,int128 score,string tag1,string tag2,string feedbackURI,bytes32 feedbackHash,bytes32 receiptHash,uint64 feedbackCount,bytes32 feedbackRoot)"),
  parseAbiItem("event AgentValidationSubmitted(uint256 indexed invoiceId,address indexed validator,bytes32 indexed subjectAgentHash,bytes32 validatorAgentHash,bool approved,int128 score,bytes32 schemaHash,string evidenceURI,bytes32 evidenceHash,bytes32 receiptHash,uint64 validationCount,bytes32 validationRoot)")
] as const;

type InvoiceTuple = readonly unknown[] & {
  token?: `0x${string}`;
  amount?: bigint;
  state?: number;
};

type ActivityLog = {
  name: string;
  invoiceId: string;
  transactionHash: `0x${string}`;
  blockNumber: bigint;
};

export default function ActivityPage() {
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const [addressOverride, setAddressOverride] = useState("");
  const [logs, setLogs] = useState<ActivityLog[]>([]);
  const [loadingLogs, setLoadingLogs] = useState(false);
  const [logError, setLogError] = useState("");

  useEffect(() => {
    setAddressOverride(window.localStorage.getItem("arbiflow-contract-address") ?? "");
  }, []);

  const contractAddress = useMemo(() => {
    const candidate = addressOverride || process.env.NEXT_PUBLIC_ESCROW_ADDRESS || "";
    return isAddress(candidate) ? (candidate as `0x${string}`) : undefined;
  }, [addressOverride]);

  const explorerBase = explorerBaseForChain(chainId);

  const { data: invoiceCount, refetch: refetchCount } = useReadContract({
    address: contractAddress,
    abi: invoiceEscrowAbi,
    functionName: "invoiceCount",
    query: { enabled: Boolean(contractAddress) }
  });

  const invoiceIds = useMemo(() => {
    const count = Number(invoiceCount ?? 0n);
    return Array.from({ length: Math.min(count, 48) }, (_, index) => BigInt(count - 1 - index));
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

  const { data: invoiceReads, refetch: refetchInvoices } = useReadContracts({
    contracts: invoiceContracts,
    query: { enabled: Boolean(contractAddress && invoiceContracts.length > 0) }
  });

  const invoices = useMemo(
    () => (invoiceReads ?? []).filter((item) => item.status === "success").map((item) => item.result as InvoiceTuple),
    [invoiceReads]
  );

  const totals = useMemo(() => {
    const settled = invoices.filter((invoice) => Number(invoice.state ?? invoice[16]) >= 3).length;
    const active = invoices.filter((invoice) => Number(invoice.state ?? invoice[16]) === 1 || Number(invoice.state ?? invoice[16]) === 2).length;
    const ethEscrowed = invoices.reduce((sum, invoice) => {
      const token = (invoice.token ?? invoice[3]) as `0x${string}`;
      const state = Number(invoice.state ?? invoice[16]);
      const amount = BigInt((invoice.amount ?? invoice[4]) as bigint);
      return token === zeroAddress && (state === 1 || state === 2) ? sum + amount : sum;
    }, 0n);
    return { active, settled, ethEscrowed };
  }, [invoices]);

  async function refreshLogs() {
    if (!publicClient || !contractAddress) return;
    setLoadingLogs(true);
    setLogError("");
    try {
      const latest = await publicClient.getBlockNumber();
      const fromBlock = chainId === hardhat.id ? 0n : latest > 200_000n ? latest - 200_000n : 0n;
      const batches = await Promise.all(
        trackedEvents.map(async (event) => {
          const eventLogs = await publicClient.getLogs({ address: contractAddress, event, fromBlock, toBlock: latest });
          return eventLogs.map((log) => ({
            name: String(log.eventName),
            invoiceId: String((log.args as Record<string, unknown>).invoiceId ?? "?"),
            transactionHash: log.transactionHash,
            blockNumber: log.blockNumber
          }));
        })
      );
      setLogs(
        batches
          .flat()
          .sort((a, b) => Number(b.blockNumber - a.blockNumber))
          .slice(0, 24)
      );
    } catch (error) {
      setLogError(error instanceof Error ? error.message.split("\n")[0] : "Failed to load event logs.");
    } finally {
      setLoadingLogs(false);
    }
  }

  async function refreshAll() {
    await refetchCount();
    await refetchInvoices();
    await refreshLogs();
  }

  useEffect(() => {
    refreshLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contractAddress, chainId]);

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brandMark">AF</div>
          <div>
            <h1>ArbiFlow Activity</h1>
            <span>Live settlement counters and on-chain proof</span>
          </div>
        </div>
        <button className="button action compactAction" type="button" onClick={refreshAll} disabled={!contractAddress || loadingLogs}>
          <RefreshCw className={loadingLogs ? "spin" : undefined} aria-hidden />
          Refresh
        </button>
      </header>

      <section className="contractBar">
        <label htmlFor="activityContract">Contract</label>
        <input
          id="activityContract"
          value={addressOverride}
          onChange={(event) => {
            setAddressOverride(event.target.value);
            window.localStorage.setItem("arbiflow-contract-address", event.target.value);
          }}
          placeholder={process.env.NEXT_PUBLIC_ESCROW_ADDRESS || "0x..."}
          spellCheck={false}
        />
        {contractAddress && explorerBase ? (
          <a className="iconButton linkButton" href={`${explorerBase}/address/${contractAddress}`} target="_blank" rel="noreferrer" title="Open contract">
            <ExternalLink aria-hidden />
          </a>
        ) : null}
      </section>

      <section className="summaryRail">
        <Status label="Invoices" value={String(invoiceCount ?? 0n)} />
        <Status label="Active" value={String(totals.active)} />
        <Status label="Finalized" value={String(totals.settled)} />
        <Status label="ETH Escrowed" value={formatValue(totals.ethEscrowed, zeroAddress)} />
      </section>

      <div className="workspace activityWorkspace">
        <section className="panel ledgerPanel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Recent invoices</span>
              <h2>Settlement states</h2>
            </div>
          </div>
          <div className="invoiceList">
            {!contractAddress ? <div className="emptyState">Set a contract address</div> : null}
            {contractAddress && invoices.length === 0 ? <div className="emptyState">No invoices loaded</div> : null}
            {invoices.map((invoice, index) => {
              const state = Number(invoice.state ?? invoice[16]);
              const token = (invoice.token ?? invoice[3]) as `0x${string}`;
              const amount = BigInt((invoice.amount ?? invoice[4]) as bigint);
              return (
                <div className="invoiceRow staticRow" key={`${index}-${state}`}>
                  <div>
                    <strong>#{invoiceIds[index]?.toString() ?? index}</strong>
                    <span>{String(invoice[17] ?? "")}</span>
                  </div>
                  <div className="invoiceMeta">
                    <span className={`statusBadge state${state}`}>{stateLabels[state] ?? "Unknown"}</span>
                    <span>{formatValue(amount, token)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        <section className="panel agentPanel">
          <div className="panelHeader">
            <div>
              <span className="eyebrow">Event proof</span>
              <h2>Recent contract logs</h2>
            </div>
          </div>
          <div className="invoiceList">
            {logError ? <div className="errorBox">{logError}</div> : null}
            {!logError && logs.length === 0 ? <div className="emptyState">{loadingLogs ? "Loading logs" : "No recent logs"}</div> : null}
            {logs.map((log) => (
              <div className="invoiceRow staticRow" key={`${log.transactionHash}-${log.name}-${log.invoiceId}`}>
                <div>
                  <strong>{log.name}</strong>
                  <span>invoice #{log.invoiceId} · block {log.blockNumber.toString()}</span>
                </div>
                {explorerBase ? (
                  <a className="iconButton linkButton" href={`${explorerBase}/tx/${log.transactionHash}`} target="_blank" rel="noreferrer" title="Open transaction">
                    <ExternalLink aria-hidden />
                  </a>
                ) : (
                  <span>{shortHash(log.transactionHash)}</span>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Status({ label, value }: { label: string; value: string }) {
  return (
    <div className="statusTile neutral">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatValue(value: bigint, token: `0x${string}`) {
  return formatTokenAmount(value, token);
}

function shortHash(value: string) {
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
}
