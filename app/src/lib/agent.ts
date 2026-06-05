import { formatEther, zeroAddress, zeroHash } from "viem";

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
  deliveryMarkedAt: bigint;
  state: number;
  metadataHash: string;
  deliveryHash: string;
  settlementMemoHash: string;
  settlementProposedBy: `0x${string}`;
  settlementRecipientAmount: bigint;
  serviceBondAmount: bigint;
  resolvedBondAmount: bigint;
  resolvedBondRecipient: `0x${string}`;
  serviceBondSlashed: boolean;
};

export type AgentContextRecord = {
  payerAgentHash: `0x${string}`;
  recipientAgentHash: `0x${string}`;
  mandateHash: `0x${string}`;
  policyHash: `0x${string}`;
  slaDeadline: bigint;
  attachedAt: bigint;
  attachedBy: `0x${string}`;
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
  nowSeconds = Math.floor(Date.now() / 1000),
  agentContext?: AgentContextRecord,
  receiptHash?: `0x${string}`
): AgentAssessment {
  const isCreator = sameAddress(account, invoice.creator);
  const isRecipient = sameAddress(account, invoice.recipient);
  const isPayer = sameAddress(account, invoice.payer);
  const duePassed = invoice.dueAt > 0n && BigInt(nowSeconds) > invoice.dueAt;
  const paidReleaseAt = Number(invoice.paidAt + invoice.timeout);
  const refundAvailableAt = Number(invoice.refundRequestedAt + invoice.timeout);
  const tokenLabel = invoice.token === zeroAddress ? "ETH" : "ERC20";
  const mandateAttached = Boolean(agentContext && agentContext.mandateHash !== zeroHash);
  const slaDeadline = agentContext?.slaDeadline ?? 0n;
  const slaRequiresTimelyDelivery = slaDeadline > 0n;
  const slaPassed = Boolean(slaRequiresTimelyDelivery && BigInt(nowSeconds) > slaDeadline);
  const hasDeliveryEvidence = Boolean(invoice.deliveryHash && invoice.deliveryMarkedAt > 0n);
  const hasTimelyDelivery = Boolean(
    hasDeliveryEvidence && (!slaRequiresTimelyDelivery || invoice.deliveryMarkedAt <= slaDeadline)
  );
  const deliveryEvidenceNote = hasDeliveryEvidence
    ? `Delivery evidence: ${invoice.deliveryHash} at ${formatUnix(Number(invoice.deliveryMarkedAt))}${
        slaRequiresTimelyDelivery && !hasTimelyDelivery ? " (after SLA)" : ""
      }.`
    : "No delivery evidence has been attached.";
  const accountabilityNotes = [
    mandateAttached ? `Agent mandate attached: ${shortHash(agentContext?.mandateHash)}.` : "No agent mandate is attached yet.",
    receiptHash ? `Portable receipt hash: ${shortHash(receiptHash)}.` : "Receipt hash will be available from the contract.",
    slaRequiresTimelyDelivery
      ? `SLA deadline: ${formatUnix(Number(slaDeadline))}${slaPassed ? " (passed)" : ""}.`
      : "No SLA deadline is encoded."
  ];
  const settlementOpen = invoice.settlementProposedBy !== zeroAddress;
  const isSettlementProposer = sameAddress(account, invoice.settlementProposedBy);
  const canAcceptSettlement = settlementOpen && (isPayer || isRecipient) && !isSettlementProposer;
  const settlementNote = settlementOpen
    ? `Settlement proposal: ${formatAmount(invoice.settlementRecipientAmount)} to recipient, ${formatAmount(
        invoice.amount - invoice.settlementRecipientAmount
      )} back to payer.`
    : "No split settlement proposal is open.";
  const bondNotes = [
    invoice.serviceBondAmount > 0n
      ? `Service bond active: ${formatAmount(invoice.serviceBondAmount)} at risk if SLA is missed without timely evidence.`
      : invoice.resolvedBondAmount > 0n
        ? `Service bond resolved: ${formatAmount(invoice.resolvedBondAmount)} ${
            invoice.serviceBondSlashed ? "slashed to payer" : "returned to provider"
          }.`
        : "No provider service bond is posted."
  ];

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
      notes: [invoice.metadataHash || "No metadata hash attached.", ...accountabilityNotes, ...bondNotes]
    };
  }

  if (invoice.state === 1) {
    const recipientTimeoutReached = isRecipient && nowSeconds >= paidReleaseAt;
    const recipientCanRelease = Boolean(
      recipientTimeoutReached && (!slaRequiresTimelyDelivery || hasTimelyDelivery)
    );
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
              : recipientTimeoutReached && slaRequiresTimelyDelivery
                ? "SLA mandate requires timely delivery evidence before recipient timeout release."
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
        deliveryEvidenceNote,
        ...accountabilityNotes,
        ...bondNotes
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
        hasDeliveryEvidence ? deliveryEvidenceNote : "Delivery evidence is still missing.",
        ...accountabilityNotes,
        ...bondNotes
      ]
    };
  }

  return {
    headline: `Invoice is ${stateLabels[invoice.state]?.toLowerCase() ?? "closed"}.`,
    risk: "closed",
    actions: [],
    notes: ["No further escrow action is available.", ...accountabilityNotes, ...bondNotes]
  };
}

function formatAmount(value: bigint) {
  return `${trimDecimal(formatEther(value))} ETH-equivalent`;
}

function trimDecimal(value: string) {
  return value.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
}

function shortHash(value?: string) {
  if (!value) return "missing";
  return `${value.slice(0, 10)}...${value.slice(-6)}`;
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
