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
    }

    uint256 public invoiceCount;
    mapping(uint256 invoiceId => Invoice) private invoices;

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
    event InvoiceReleased(uint256 indexed invoiceId, address indexed payer, address indexed recipient, uint256 amount);
    event RefundRequested(uint256 indexed invoiceId, address indexed payer, uint64 refundAvailableAt);
    event InvoiceRefunded(uint256 indexed invoiceId, address indexed payer, uint256 amount);
    event InvoiceCancelled(uint256 indexed invoiceId);
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
            settlementRecipientAmount: 0
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

    function release(uint256 invoiceId) external nonReentrant {
        Invoice storage invoice = _invoice(invoiceId);
        if (invoice.state != State.Paid) revert InvalidState(State.Paid, invoice.state);

        bool payerRelease = msg.sender == invoice.payer;
        bool recipientTimeoutRelease = msg.sender == invoice.recipient && block.timestamp >= invoice.paidAt + invoice.timeout;
        if (!payerRelease && !recipientTimeoutRelease) revert Unauthorized();

        invoice.state = State.Released;
        _transferOut(invoice.token, invoice.recipient, invoice.amount);

        emit InvoiceReleased(invoiceId, invoice.payer, invoice.recipient, invoice.amount);
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

        emit SettlementAccepted(invoiceId, msg.sender, recipientAmount, payerAmount);
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

        emit InvoiceRefunded(invoiceId, payer, amount);
    }

    function cancelUnpaid(uint256 invoiceId) external {
        Invoice storage invoice = _invoice(invoiceId);
        if (invoice.state != State.Created) revert InvalidState(State.Created, invoice.state);
        if (msg.sender != invoice.creator && msg.sender != invoice.recipient) revert Unauthorized();

        invoice.state = State.Cancelled;

        emit InvoiceCancelled(invoiceId);
    }

    function getInvoice(uint256 invoiceId) external view returns (Invoice memory) {
        return _invoiceView(invoiceId);
    }

    function _invoice(uint256 invoiceId) private view returns (Invoice storage invoice) {
        if (invoiceId >= invoiceCount) revert InvoiceNotFound();
        invoice = invoices[invoiceId];
    }

    function _invoiceView(uint256 invoiceId) private view returns (Invoice memory invoice) {
        if (invoiceId >= invoiceCount) revert InvoiceNotFound();
        invoice = invoices[invoiceId];
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
