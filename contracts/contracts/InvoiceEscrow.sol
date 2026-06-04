// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

contract InvoiceEscrow is ReentrancyGuard {
    using SafeERC20 for IERC20;

    enum State {
        Created,
        Paid,
        RefundRequested,
        Released,
        Refunded,
        Cancelled,
        Settled
    }

    struct Invoice {
        address creator;
        address payer;
        address recipient;
        address token;
        uint256 amount;
        uint64 dueAt;
        uint64 paidAt;
        uint64 timeout;
        uint64 refundRequestedAt;
        uint64 settlementProposedAt;
        State state;
        string metadataHash;
        string deliveryHash;
        string settlementMemoHash;
        address settlementProposedBy;
        uint256 settlementRecipientAmount;
        uint256 serviceBondAmount;
        uint256 resolvedBondAmount;
        address resolvedBondRecipient;
        bool serviceBondSlashed;
    }

    struct AgentContext {
        bytes32 payerAgentHash;
        bytes32 recipientAgentHash;
        bytes32 mandateHash;
        bytes32 policyHash;
        uint64 slaDeadline;
        uint64 attachedAt;
        address attachedBy;
    }

    uint256 public invoiceCount;
    mapping(uint256 invoiceId => Invoice) private invoices;
    mapping(uint256 invoiceId => AgentContext) private agentContexts;

    event InvoiceCreated(
        uint256 indexed invoiceId,
        address indexed creator,
        address indexed recipient,
        address token,
        uint256 amount,
        uint64 dueAt,
        uint64 timeout,
        string metadataHash
    );
    event InvoicePaid(uint256 indexed invoiceId, address indexed payer, address token, uint256 amount);
    event ServiceBondPosted(uint256 indexed invoiceId, address indexed recipient, address token, uint256 amount);
    event ServiceBondResolved(
        uint256 indexed invoiceId,
        address indexed beneficiary,
        uint256 amount,
        bool slashed
    );
    event InvoiceReleased(uint256 indexed invoiceId, address indexed payer, address indexed recipient, uint256 amount);
    event RefundRequested(uint256 indexed invoiceId, address indexed payer, uint64 refundAvailableAt);
    event InvoiceRefunded(uint256 indexed invoiceId, address indexed payer, uint256 amount);
    event InvoiceCancelled(uint256 indexed invoiceId);
    event AgentMandateAttached(
        uint256 indexed invoiceId,
        address indexed attachedBy,
        bytes32 payerAgentHash,
        bytes32 recipientAgentHash,
        bytes32 mandateHash,
        bytes32 policyHash,
        uint64 slaDeadline
    );
    event DeliveryMarked(uint256 indexed invoiceId, address indexed recipient, string deliveryHash);
    event SettlementProposed(
        uint256 indexed invoiceId,
        address indexed proposedBy,
        uint256 recipientAmount,
        uint256 payerAmount,
        string memoHash
    );
    event SettlementAccepted(
        uint256 indexed invoiceId,
        address indexed acceptedBy,
        uint256 recipientAmount,
        uint256 payerAmount
    );
    event SettlementReceiptFinalized(uint256 indexed invoiceId, bytes32 indexed receiptHash, State finalState);

    error InvalidRecipient();
    error InvalidAmount();
    error InvalidTimeout();
    error InvoiceNotFound();
    error InvalidState(State expected, State actual);
    error Unauthorized();
    error InvoicePastDue();
    error IncorrectPayment();
    error RefundTimeoutNotReached(uint256 availableAt);
    error InvalidSettlementAmount();
    error NoSettlementProposal();
    error InvalidMandate();
    error InvalidBondAmount();

    function createInvoice(
        address recipient,
        address token,
        uint256 amount,
        string calldata metadataHash,
        uint64 dueAt,
        uint64 timeout
    ) external returns (uint256 invoiceId) {
        if (recipient == address(0)) revert InvalidRecipient();
        if (amount == 0) revert InvalidAmount();
        if (timeout == 0) revert InvalidTimeout();

        invoiceId = invoiceCount++;
        invoices[invoiceId] = Invoice({
            creator: msg.sender,
            payer: address(0),
            recipient: recipient,
            token: token,
            amount: amount,
            dueAt: dueAt,
            paidAt: 0,
            timeout: timeout,
            refundRequestedAt: 0,
            settlementProposedAt: 0,
            state: State.Created,
            metadataHash: metadataHash,
            deliveryHash: "",
            settlementMemoHash: "",
            settlementProposedBy: address(0),
            settlementRecipientAmount: 0,
            serviceBondAmount: 0,
            resolvedBondAmount: 0,
            resolvedBondRecipient: address(0),
            serviceBondSlashed: false
        });

        emit InvoiceCreated(invoiceId, msg.sender, recipient, token, amount, dueAt, timeout, metadataHash);
    }

    function payInvoice(uint256 invoiceId) external payable nonReentrant {
        Invoice storage invoice = _invoice(invoiceId);
        if (invoice.state != State.Created) revert InvalidState(State.Created, invoice.state);
        if (invoice.dueAt != 0 && block.timestamp > invoice.dueAt) revert InvoicePastDue();

        invoice.payer = msg.sender;
        invoice.paidAt = uint64(block.timestamp);
        invoice.state = State.Paid;

        if (invoice.token == address(0)) {
            if (msg.value != invoice.amount) revert IncorrectPayment();
        } else {
            if (msg.value != 0) revert IncorrectPayment();
            IERC20(invoice.token).safeTransferFrom(msg.sender, address(this), invoice.amount);
        }

        emit InvoicePaid(invoiceId, msg.sender, invoice.token, invoice.amount);
    }

    function attachAgentMandate(
        uint256 invoiceId,
        bytes32 payerAgentHash,
        bytes32 recipientAgentHash,
        bytes32 mandateHash,
        bytes32 policyHash,
        uint64 slaDeadline
    ) external {
        Invoice storage invoice = _invoice(invoiceId);
        if (
            msg.sender != invoice.creator && msg.sender != invoice.recipient
                && (invoice.payer == address(0) || msg.sender != invoice.payer)
        ) revert Unauthorized();
        if (invoice.state >= State.Released) revert InvalidState(State.Created, invoice.state);
        if (mandateHash == bytes32(0)) revert InvalidMandate();

        agentContexts[invoiceId] = AgentContext({
            payerAgentHash: payerAgentHash,
            recipientAgentHash: recipientAgentHash,
            mandateHash: mandateHash,
            policyHash: policyHash,
            slaDeadline: slaDeadline,
            attachedAt: uint64(block.timestamp),
            attachedBy: msg.sender
        });

        emit AgentMandateAttached(
            invoiceId,
            msg.sender,
            payerAgentHash,
            recipientAgentHash,
            mandateHash,
            policyHash,
            slaDeadline
        );
    }

    function postServiceBond(uint256 invoiceId, uint256 amount) external payable nonReentrant {
        Invoice storage invoice = _invoice(invoiceId);
        if (msg.sender != invoice.recipient) revert Unauthorized();
        if (invoice.state >= State.Released) revert InvalidState(State.Created, invoice.state);
        if (amount == 0) revert InvalidBondAmount();

        invoice.serviceBondAmount += amount;

        if (invoice.token == address(0)) {
            if (msg.value != amount) revert IncorrectPayment();
        } else {
            if (msg.value != 0) revert IncorrectPayment();
            IERC20(invoice.token).safeTransferFrom(msg.sender, address(this), amount);
        }

        emit ServiceBondPosted(invoiceId, msg.sender, invoice.token, amount);
    }

    function release(uint256 invoiceId) external nonReentrant {
        Invoice storage invoice = _invoice(invoiceId);
        if (invoice.state != State.Paid) revert InvalidState(State.Paid, invoice.state);

        bool payerRelease = msg.sender == invoice.payer;
        bool recipientTimeoutRelease = msg.sender == invoice.recipient && block.timestamp >= invoice.paidAt + invoice.timeout;
        if (!payerRelease && !recipientTimeoutRelease) revert Unauthorized();

        invoice.state = State.Released;
        _transferOut(invoice.token, invoice.recipient, invoice.amount);
        _resolveServiceBond(invoiceId, invoice, true);

        emit InvoiceReleased(invoiceId, invoice.payer, invoice.recipient, invoice.amount);
        emit SettlementReceiptFinalized(invoiceId, settlementReceiptHash(invoiceId), invoice.state);
    }

    function requestRefund(uint256 invoiceId) external {
        Invoice storage invoice = _invoice(invoiceId);
        if (invoice.state != State.Paid) revert InvalidState(State.Paid, invoice.state);
        if (msg.sender != invoice.payer) revert Unauthorized();

        invoice.refundRequestedAt = uint64(block.timestamp);
        invoice.state = State.RefundRequested;

        emit RefundRequested(invoiceId, msg.sender, uint64(block.timestamp) + invoice.timeout);
    }

    function markDelivered(uint256 invoiceId, string calldata deliveryHash) external {
        Invoice storage invoice = _invoice(invoiceId);
        if (invoice.state != State.Paid && invoice.state != State.RefundRequested) {
            revert InvalidState(State.Paid, invoice.state);
        }
        if (msg.sender != invoice.recipient) revert Unauthorized();

        invoice.deliveryHash = deliveryHash;

        emit DeliveryMarked(invoiceId, msg.sender, deliveryHash);
    }

    function proposeSettlement(
        uint256 invoiceId,
        uint256 recipientAmount,
        string calldata memoHash
    ) external {
        Invoice storage invoice = _invoice(invoiceId);
        if (invoice.state != State.Paid && invoice.state != State.RefundRequested) {
            revert InvalidState(State.Paid, invoice.state);
        }
        if (msg.sender != invoice.payer && msg.sender != invoice.recipient) revert Unauthorized();
        if (recipientAmount > invoice.amount) revert InvalidSettlementAmount();

        invoice.settlementProposedBy = msg.sender;
        invoice.settlementRecipientAmount = recipientAmount;
        invoice.settlementProposedAt = uint64(block.timestamp);
        invoice.settlementMemoHash = memoHash;

        emit SettlementProposed(invoiceId, msg.sender, recipientAmount, invoice.amount - recipientAmount, memoHash);
    }

    function acceptSettlement(uint256 invoiceId) external nonReentrant {
        Invoice storage invoice = _invoice(invoiceId);
        if (invoice.state != State.Paid && invoice.state != State.RefundRequested) {
            revert InvalidState(State.Paid, invoice.state);
        }
        if (invoice.settlementProposedBy == address(0)) revert NoSettlementProposal();
        if (msg.sender != invoice.payer && msg.sender != invoice.recipient) revert Unauthorized();
        if (msg.sender == invoice.settlementProposedBy) revert Unauthorized();

        uint256 recipientAmount = invoice.settlementRecipientAmount;
        uint256 payerAmount = invoice.amount - recipientAmount;
        invoice.state = State.Settled;

        if (recipientAmount != 0) {
            _transferOut(invoice.token, invoice.recipient, recipientAmount);
        }
        if (payerAmount != 0) {
            _transferOut(invoice.token, invoice.payer, payerAmount);
        }
        _resolveServiceBond(invoiceId, invoice, true);

        emit SettlementAccepted(invoiceId, msg.sender, recipientAmount, payerAmount);
        emit SettlementReceiptFinalized(invoiceId, settlementReceiptHash(invoiceId), invoice.state);
    }

    function refund(uint256 invoiceId) external nonReentrant {
        Invoice storage invoice = _invoice(invoiceId);
        if (invoice.state != State.RefundRequested) revert InvalidState(State.RefundRequested, invoice.state);

        uint256 refundAvailableAt = invoice.refundRequestedAt + invoice.timeout;
        bool recipientApproves = msg.sender == invoice.recipient;
        bool payerTimeoutClaim = msg.sender == invoice.payer && block.timestamp >= refundAvailableAt;
        if (!recipientApproves && !payerTimeoutClaim) {
            if (msg.sender == invoice.payer) revert RefundTimeoutNotReached(refundAvailableAt);
            revert Unauthorized();
        }

        address payer = invoice.payer;
        uint256 amount = invoice.amount;
        invoice.state = State.Refunded;
        _transferOut(invoice.token, payer, amount);
        _resolveServiceBond(invoiceId, invoice, false);

        emit InvoiceRefunded(invoiceId, payer, amount);
        emit SettlementReceiptFinalized(invoiceId, settlementReceiptHash(invoiceId), invoice.state);
    }

    function cancelUnpaid(uint256 invoiceId) external nonReentrant {
        Invoice storage invoice = _invoice(invoiceId);
        if (invoice.state != State.Created) revert InvalidState(State.Created, invoice.state);
        if (msg.sender != invoice.creator && msg.sender != invoice.recipient) revert Unauthorized();

        invoice.state = State.Cancelled;
        _resolveServiceBond(invoiceId, invoice, true);

        emit InvoiceCancelled(invoiceId);
        emit SettlementReceiptFinalized(invoiceId, settlementReceiptHash(invoiceId), invoice.state);
    }

    function getInvoice(uint256 invoiceId) external view returns (Invoice memory) {
        return _invoiceView(invoiceId);
    }

    function getAgentContext(uint256 invoiceId) external view returns (AgentContext memory) {
        _invoiceView(invoiceId);
        return agentContexts[invoiceId];
    }

    function settlementReceiptHash(uint256 invoiceId) public view returns (bytes32) {
        Invoice storage invoice = _invoice(invoiceId);
        AgentContext storage context = agentContexts[invoiceId];
        bytes32 invoiceHash = keccak256(
            abi.encode(
                invoice.creator,
                invoice.payer,
                invoice.recipient,
                invoice.token,
                invoice.amount,
                invoice.state,
                invoice.metadataHash,
                invoice.deliveryHash,
                invoice.settlementMemoHash,
                invoice.settlementRecipientAmount,
                invoice.resolvedBondAmount,
                invoice.resolvedBondRecipient,
                invoice.serviceBondSlashed
            )
        );
        bytes32 contextHash = keccak256(
            abi.encode(
                context.payerAgentHash,
                context.recipientAgentHash,
                context.mandateHash,
                context.policyHash,
                context.slaDeadline
            )
        );
        return keccak256(
            abi.encode(
                "ARBIFLOW_AGENT_SETTLEMENT_RECEIPT_V1",
                block.chainid,
                address(this),
                invoiceId,
                invoiceHash,
                contextHash
            )
        );
    }

    function _invoice(uint256 invoiceId) private view returns (Invoice storage invoice) {
        if (invoiceId >= invoiceCount) revert InvoiceNotFound();
        invoice = invoices[invoiceId];
    }

    function _invoiceView(uint256 invoiceId) private view returns (Invoice memory invoice) {
        if (invoiceId >= invoiceCount) revert InvoiceNotFound();
        invoice = invoices[invoiceId];
    }

    function _resolveServiceBond(uint256 invoiceId, Invoice storage invoice, bool successfulOutcome) private {
        uint256 amount = invoice.serviceBondAmount;
        if (amount == 0) return;

        AgentContext storage context = agentContexts[invoiceId];
        bool missedSla = context.slaDeadline != 0 && block.timestamp > context.slaDeadline;
        bool hasDeliveryEvidence = bytes(invoice.deliveryHash).length != 0;
        bool slashBond = !successfulOutcome && missedSla && !hasDeliveryEvidence && invoice.payer != address(0);
        address beneficiary = slashBond ? invoice.payer : invoice.recipient;

        invoice.serviceBondAmount = 0;
        invoice.resolvedBondAmount = amount;
        invoice.resolvedBondRecipient = beneficiary;
        invoice.serviceBondSlashed = slashBond;

        _transferOut(invoice.token, beneficiary, amount);

        emit ServiceBondResolved(invoiceId, beneficiary, amount, slashBond);
    }

    function _transferOut(address token, address to, uint256 amount) private {
        if (token == address(0)) {
            (bool ok,) = payable(to).call{value: amount}("");
            require(ok, "ETH_TRANSFER_FAILED");
        } else {
            IERC20(token).safeTransfer(to, amount);
        }
    }
}
