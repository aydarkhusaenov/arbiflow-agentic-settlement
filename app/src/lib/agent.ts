import { formatEther, zeroAddress } from "viem";

export const stateLabels = ["Created", "Paid", "Refund requested", "Released", "Refunded", "Cancelled", "Settled"] as const;

export type InvoiceRecord = {
  id: bigint;
  creator: `0x${string}`;
  payer: `0x${string}`;
  recipient: `0x${string}`;
  token: `0x${string}`;
  amount: bigint;
  dueAt: bigint;
  paidAt: bigint;
  timeout: bigint;
  refundRequestedAt: bigint;
  settlementProposedAt: bigint;
  state: number;
  metadataHash: string;
  deliveryHash: string;
  settlementMemoHash: string;
  settlementProposedBy: `0x${string}`;
  settlementRecipientAmount: bigint;
};

export type AgentAction = {
  id: "pay" | "release" | "requestRefund" | "refund" | "cancel" | "acceptSettlement";
  label: string;
  enabled: boolean;
  reason: string;
};

export type AgentAssessment = {
  headline: string;
  risk: "low" | "medium" | "closed";
  actions: AgentAction[];
  notes: string[];
};

const sameAddress = (a?: string, b?: string) => Boolean(a && b && a.toLowerCase() === b.toLowerCase());

export function assessInvoice(
  invoice: InvoiceRecord,
  account?: `0x${string}`,
  nowSeconds = Math.floor(Date.now() / 1000)
): AgentAssessment {
  const isCreator = sameAddress(account, invoice.creator);
  const isRecipient = sameAddress(account, invoice.recipient);
  const isPayer = sameAddress(account, invoice.payer);
  const duePassed = invoice.dueAt > 0n && BigInt(nowSeconds) > invoice.dueAt;
  const paidReleaseAt = Number(invoice.paidAt + invoice.timeout);
  const refundAvailableAt = Number(invoice.refundRequestedAt + invoice.timeout);
  const tokenLabel = invoice.token === zeroAddress ? "ETH" : "ERC20";
  const settlementOpen = invoice.settlementProposedBy !== zeroAddress;
  const isSettlementProposer = sameAddress(account, invoice.settlementProposedBy);
  const canAcceptSettlement = settlementOpen && (isPayer || isRecipient) && !isSettlementProposer;
  const settlementNote = settlementOpen
    ? `Settlement proposal: ${formatAmount(invoice.settlementRecipientAmount)} to recipient, ${formatAmount(
        invoice.amount - invoice.settlementRecipientAmount
      )} back to payer.`
    : "No split settlement proposal is open.";

  if (invoice.state === 0) {
    return {
      headline: duePassed ? "Invoice is unpaid and past due." : `Invoice is ready for ${tokenLabel} payment.`,
      risk: duePassed ? "medium" : "low",
      actions: [
        {
          id: "pay",
          label: "Pay invoice",
          enabled: Boolean(account && !duePassed),
          reason: duePassed ? "Payment deadline has passed." : "Any connected wallet can fund this escrow."
        },
        {
          id: "cancel",
          label: "Cancel unpaid",
          enabled: isCreator || isRecipient,
          reason: isCreator || isRecipient ? "Creator or recipient can cancel before payment." : "Only creator or recipient can cancel."
        }
      ],
      notes: [invoice.metadataHash || "No metadata hash attached."]
    };
  }

  if (invoice.state === 1) {
    const recipientCanRelease = isRecipient && nowSeconds >= paidReleaseAt;
    return {
      headline: settlementOpen ? "Funds are escrowed and a settlement proposal is open." : "Funds are locked in escrow.",
      risk: settlementOpen ? "medium" : "low",
      actions: [
        ...(settlementOpen
          ? [
              {
                id: "acceptSettlement" as const,
                label: "Accept split settlement",
                enabled: Boolean(canAcceptSettlement),
                reason: canAcceptSettlement
                  ? "Counterparty can accept the proposed payout split."
                  : "Only the counterparty can accept this proposal."
              }
            ]
          : []),
        {
          id: "release",
          label: "Release funds",
          enabled: isPayer || recipientCanRelease,
          reason: isPayer
            ? "Payer can release to recipient now."
            : recipientCanRelease
              ? "Recipient timeout release is available."
              : "Only payer can release before timeout."
        },
        {
          id: "requestRefund",
          label: "Request refund",
          enabled: isPayer,
          reason: isPayer ? "Payer can open a refund window." : "Only payer can request a refund."
        }
      ],
      notes: [
        `Recipient timeout release: ${formatUnix(paidReleaseAt)}.`,
        settlementNote,
        invoice.deliveryHash ? `Delivery evidence: ${invoice.deliveryHash}.` : "No delivery evidence has been attached."
      ]
    };
  }

  if (invoice.state === 2) {
    const payerCanRefund = isPayer && nowSeconds >= refundAvailableAt;
    return {
      headline: settlementOpen ? "Refund window is active with a proposed compromise." : "Refund window is active.",
      risk: "medium",
      actions: [
        ...(settlementOpen
          ? [
              {
                id: "acceptSettlement" as const,
                label: "Accept split settlement",
                enabled: Boolean(canAcceptSettlement),
                reason: canAcceptSettlement
                  ? "Counterparty can accept the proposed payout split."
                  : "Only the counterparty can accept this proposal."
              }
            ]
          : []),
        {
          id: "refund",
          label: "Refund payer",
          enabled: isRecipient || payerCanRefund,
          reason: isRecipient
            ? "Recipient can approve refund now."
            : payerCanRefund
              ? "Refund timeout has passed."
              : "Payer must wait for timeout."
        }
      ],
      notes: [
        `Payer timeout refund: ${formatUnix(refundAvailableAt)}.`,
        settlementNote,
        invoice.deliveryHash ? `Delivery evidence: ${invoice.deliveryHash}.` : "Delivery evidence is still missing."
      ]
    };
  }

  return {
    headline: `Invoice is ${stateLabels[invoice.state]?.toLowerCase() ?? "closed"}.`,
    risk: "closed",
    actions: [],
    notes: ["No further escrow action is available."]
  };
}

function formatAmount(value: bigint) {
  return `${trimDecimal(formatEther(value))} ETH-equivalent`;
}

function trimDecimal(value: string) {
  return value.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
}

function formatUnix(seconds: number) {
  if (!Number.isFinite(seconds) || seconds <= 0) return "not scheduled";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(seconds * 1000));
}
