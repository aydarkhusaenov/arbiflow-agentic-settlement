const { expect } = require("chai");
const { ethers, network } = require("hardhat");

const ZERO_ADDRESS = ethers.ZeroAddress;
const ZERO_HASH = ethers.ZeroHash;
const HOUR = 60 * 60;
const DAY = 24 * HOUR;
const PermitAction = {
  Release: 0,
  RequestRefund: 1,
  Refund: 2,
  MarkDelivered: 3,
  MarkDisputed: 4,
  ProposeSettlement: 5,
  CancelSettlementProposal: 6,
  AcceptSettlement: 7
};

async function latestTimestamp() {
  const block = await ethers.provider.getBlock("latest");
  return block.timestamp;
}

async function increaseTime(seconds) {
  await network.provider.send("evm_increaseTime", [seconds]);
  await network.provider.send("evm_mine");
}

describe("InvoiceEscrow", function () {
  let escrow;
  let token;
  let feeToken;
  let creator;
  let recipient;
  let payer;
  let other;

  beforeEach(async function () {
    [creator, recipient, payer, other] = await ethers.getSigners();

    const Escrow = await ethers.getContractFactory("InvoiceEscrow");
    escrow = await Escrow.deploy();

    const MockERC20 = await ethers.getContractFactory("MockERC20");
    token = await MockERC20.deploy();

    const MockFeeERC20 = await ethers.getContractFactory("MockFeeERC20");
    feeToken = await MockFeeERC20.deploy();
  });

  async function createEthInvoice(overrides = {}) {
    const now = await latestTimestamp();
    const params = {
      recipient: recipient.address,
      token: ZERO_ADDRESS,
      amount: ethers.parseEther("1"),
      metadataHash: "ipfs://invoice-001",
      dueAt: now + DAY,
      timeout: DAY,
      ...overrides
    };

    const tx = await escrow
      .connect(creator)
      .createInvoice(params.recipient, params.token, params.amount, params.metadataHash, params.dueAt, params.timeout);
    const receipt = await tx.wait();
    const event = receipt.logs.find((log) => log.fragment && log.fragment.name === "InvoiceCreated");
    return { id: event.args.invoiceId, params };
  }

  async function signPaymentMandate(id, signer, authorizedPayer, overrides = {}) {
    const now = await latestTimestamp();
    const payerAgentHash = overrides.payerAgentHash ?? ethers.id("erc8004:payer-agent:signed-checkout");
    const recipientAgentHash = overrides.recipientAgentHash ?? ethers.id("erc8004:service-agent:signed-checkout");
    const mandateHash = overrides.mandateHash ?? ethers.id("ap2:signed user mandate");
    const policyHash = overrides.policyHash ?? ethers.id("policy:signed payment scope");
    const slaDeadline = overrides.slaDeadline ?? now + DAY;
    const mandateExpiresAt = overrides.mandateExpiresAt ?? now + DAY;
    const paymentRequirementHash = await escrow.paymentRequirementHash(id);
    const { chainId } = await ethers.provider.getNetwork();
    const domain = {
      name: "ArbiFlow Agentic Settlement",
      version: "1",
      chainId,
      verifyingContract: await escrow.getAddress()
    };
    const types = {
      PaymentMandate: [
        { name: "invoiceId", type: "uint256" },
        { name: "payer", type: "address" },
        { name: "paymentRequirementHash", type: "bytes32" },
        { name: "payerAgentHash", type: "bytes32" },
        { name: "recipientAgentHash", type: "bytes32" },
        { name: "mandateHash", type: "bytes32" },
        { name: "policyHash", type: "bytes32" },
        { name: "slaDeadline", type: "uint64" },
        { name: "expiresAt", type: "uint64" }
      ]
    };
    const value = {
      invoiceId: id,
      payer: authorizedPayer.address,
      paymentRequirementHash,
      payerAgentHash,
      recipientAgentHash,
      mandateHash,
      policyHash,
      slaDeadline,
      expiresAt: mandateExpiresAt
    };
    const signature = await signer.signTypedData(domain, types, value);
    return { payerAgentHash, recipientAgentHash, mandateHash, policyHash, slaDeadline, mandateExpiresAt, signature };
  }

  async function signActionPermit(id, signer, executor, action, recipientAmount = 0n, dataHash = "", nonce = 1n, overrides = {}) {
    const now = await latestTimestamp();
    const validAfter = overrides.validAfter ?? 0;
    const expiresAt = overrides.expiresAt ?? now + DAY;
    const paramsHash = await escrow.actionParamsHash(action, recipientAmount, dataHash);
    const { chainId } = await ethers.provider.getNetwork();
    const domain = {
      name: "ArbiFlow Agentic Settlement",
      version: "1",
      chainId,
      verifyingContract: await escrow.getAddress()
    };
    const types = {
      ActionPermit: [
        { name: "invoiceId", type: "uint256" },
        { name: "action", type: "uint8" },
        { name: "signer", type: "address" },
        { name: "executor", type: "address" },
        { name: "paramsHash", type: "bytes32" },
        { name: "validAfter", type: "uint64" },
        { name: "expiresAt", type: "uint64" },
        { name: "nonce", type: "uint256" }
      ]
    };
    const value = {
      invoiceId: id,
      action,
      signer: signer.address,
      executor,
      paramsHash,
      validAfter,
      expiresAt,
      nonce
    };
    const signature = await signer.signTypedData(domain, types, value);
    return {
      paramsHash,
      call: {
        invoiceId: id,
        action,
        signer: signer.address,
        executor,
        recipientAmount,
        dataHash,
        validAfter,
        expiresAt,
        nonce,
        signature
      }
    };
  }

  it("creates invoices with expected fields", async function () {
    const { id, params } = await createEthInvoice();

    const invoice = await escrow.getInvoice(id);
    expect(invoice.creator).to.equal(creator.address);
    expect(invoice.recipient).to.equal(recipient.address);
    expect(invoice.token).to.equal(params.token);
    expect(invoice.amount).to.equal(params.amount);
    expect(invoice.metadataHash).to.equal(params.metadataHash);
    expect(invoice.deliveryEvidenceCount).to.equal(0);
    expect(invoice.disputeEvidenceCount).to.equal(0);
    expect(invoice.deliveryEvidenceRoot).to.equal(ZERO_HASH);
    expect(invoice.disputeEvidenceRoot).to.equal(ZERO_HASH);
    expect(invoice.state).to.equal(0);
  });

  it("rejects invalid invoice inputs", async function () {
    await expect(
      escrow.connect(creator).createInvoice(ZERO_ADDRESS, ZERO_ADDRESS, 1, "bad", 0, DAY)
    ).to.be.revertedWithCustomError(escrow, "InvalidRecipient");

    await expect(
      escrow.connect(creator).createInvoice(recipient.address, ZERO_ADDRESS, 0, "bad", 0, DAY)
    ).to.be.revertedWithCustomError(escrow, "InvalidAmount");

    await expect(
      escrow.connect(creator).createInvoice(recipient.address, ZERO_ADDRESS, 1, "bad", 0, 0)
    ).to.be.revertedWithCustomError(escrow, "InvalidTimeout");
  });

  it("cancels unpaid invoices only by creator or recipient", async function () {
    const { id } = await createEthInvoice();

    await expect(escrow.connect(other).cancelUnpaid(id)).to.be.revertedWithCustomError(escrow, "Unauthorized");
    await escrow.connect(creator).cancelUnpaid(id);

    const invoice = await escrow.getInvoice(id);
    expect(invoice.state).to.equal(5);
  });

  it("pays an ETH invoice with exact value", async function () {
    const { id, params } = await createEthInvoice();

    await escrow.connect(payer).payInvoice(id, { value: params.amount });

    const invoice = await escrow.getInvoice(id);
    expect(invoice.payer).to.equal(payer.address);
    expect(invoice.state).to.equal(1);
    expect(await ethers.provider.getBalance(await escrow.getAddress())).to.equal(params.amount);
  });

  it("attaches agent mandate context and exposes receipt hash", async function () {
    const { id } = await createEthInvoice();
    const now = await latestTimestamp();
    const payerAgentHash = ethers.id("erc8004:payer-agent:invoice-risk-policy");
    const recipientAgentHash = ethers.id("erc8004:recipient-agent:web-delivery-service");
    const mandateHash = ethers.id("ap2-like mandate: buy landing page for 0.05 ETH");
    const policyHash = ethers.id("policy: release only after delivery evidence");
    const slaDeadline = now + DAY;

    await expect(
      escrow
        .connect(creator)
        .attachAgentMandate(id, payerAgentHash, recipientAgentHash, mandateHash, policyHash, slaDeadline)
    )
      .to.emit(escrow, "AgentMandateAttached")
      .withArgs(
        id,
        creator.address,
        payerAgentHash,
        recipientAgentHash,
        mandateHash,
        policyHash,
        slaDeadline,
        ZERO_ADDRESS,
        0
      );

    const context = await escrow.getAgentContext(id);
    expect(context.payerAgentHash).to.equal(payerAgentHash);
    expect(context.recipientAgentHash).to.equal(recipientAgentHash);
    expect(context.mandateHash).to.equal(mandateHash);
    expect(context.policyHash).to.equal(policyHash);
    expect(context.slaDeadline).to.equal(slaDeadline);
    expect(context.attachedBy).to.equal(creator.address);
    expect(context.authorizedPayer).to.equal(ZERO_ADDRESS);
    expect(context.mandateExpiresAt).to.equal(0);

    const receiptHash = await escrow.settlementReceiptHash(id);
    expect(receiptHash).to.not.equal(ZERO_HASH);
  });

  it("exposes an x402-style payment requirement hash bound to invoice terms", async function () {
    const { id } = await createEthInvoice();

    const requirementHash = await escrow.paymentRequirementHash(id);
    expect(requirementHash).to.not.equal(ZERO_HASH);

    const otherInvoice = await createEthInvoice({ metadataHash: "ipfs://invoice-002" });
    expect(await escrow.paymentRequirementHash(otherInvoice.id)).to.not.equal(requirementHash);
  });

  it("attaches a signed payment mandate and restricts payment to authorized payer", async function () {
    const { id, params } = await createEthInvoice();
    const signed = await signPaymentMandate(id, payer, payer);

    await expect(
      escrow
        .connect(other)
        .attachSignedAgentMandate(
          id,
          payer.address,
          signed.payerAgentHash,
          signed.recipientAgentHash,
          signed.mandateHash,
          signed.policyHash,
          signed.slaDeadline,
          signed.mandateExpiresAt,
          signed.signature
        )
    )
      .to.emit(escrow, "AgentMandateAttached")
      .withArgs(
        id,
        other.address,
        signed.payerAgentHash,
        signed.recipientAgentHash,
        signed.mandateHash,
        signed.policyHash,
        signed.slaDeadline,
        payer.address,
        signed.mandateExpiresAt
      );

    const context = await escrow.getAgentContext(id);
    expect(context.authorizedPayer).to.equal(payer.address);
    expect(context.mandateExpiresAt).to.equal(signed.mandateExpiresAt);

    await expect(escrow.connect(other).payInvoice(id, { value: params.amount })).to.be.revertedWithCustomError(
      escrow,
      "Unauthorized"
    );
    await escrow.connect(payer).payInvoice(id, { value: params.amount });

    const invoice = await escrow.getInvoice(id);
    expect(invoice.payer).to.equal(payer.address);
    expect(invoice.state).to.equal(1);
  });

  it("rejects signed mandates from the wrong signer", async function () {
    const { id } = await createEthInvoice();
    const signed = await signPaymentMandate(id, other, payer);

    await expect(
      escrow.attachSignedAgentMandate(
        id,
        payer.address,
        signed.payerAgentHash,
        signed.recipientAgentHash,
        signed.mandateHash,
        signed.policyHash,
        signed.slaDeadline,
        signed.mandateExpiresAt,
        signed.signature
      )
    ).to.be.revertedWithCustomError(escrow, "InvalidSignature");
  });

  it("rejects expired signed mandates and expired authorized payments", async function () {
    const { id, params } = await createEthInvoice({ timeout: HOUR });
    const now = await latestTimestamp();
    const expired = await signPaymentMandate(id, payer, payer, { mandateExpiresAt: now });

    await expect(
      escrow.attachSignedAgentMandate(
        id,
        payer.address,
        expired.payerAgentHash,
        expired.recipientAgentHash,
        expired.mandateHash,
        expired.policyHash,
        expired.slaDeadline,
        expired.mandateExpiresAt,
        expired.signature
      )
    ).to.be.revertedWithCustomError(escrow, "MandateExpired");

    const active = await signPaymentMandate(id, payer, payer, { mandateExpiresAt: now + HOUR });
    await escrow.attachSignedAgentMandate(
      id,
      payer.address,
      active.payerAgentHash,
      active.recipientAgentHash,
      active.mandateHash,
      active.policyHash,
      active.slaDeadline,
      active.mandateExpiresAt,
      active.signature
    );

    await increaseTime(HOUR + 1);
    await expect(escrow.connect(payer).payInvoice(id, { value: params.amount })).to.be.revertedWithCustomError(
      escrow,
      "MandateExpired"
    );
  });

  it("executes a payer-signed refund request permit once through the bound executor", async function () {
    const { id, params } = await createEthInvoice();
    await escrow.connect(payer).payInvoice(id, { value: params.amount });

    const permit = await signActionPermit(id, payer, other.address, PermitAction.RequestRefund, 0n, "", 11n);

    await expect(escrow.connect(other).executeActionPermit(permit.call))
      .to.emit(escrow, "ActionPermitExecuted")
      .withArgs(id, payer.address, other.address, PermitAction.RequestRefund, 11n, permit.paramsHash);

    const invoice = await escrow.getInvoice(id);
    expect(invoice.state).to.equal(2);
    expect(await escrow.usedActionNonces(payer.address, 11n)).to.equal(true);

    await expect(escrow.connect(other).executeActionPermit(permit.call)).to.be.revertedWithCustomError(
      escrow,
      "ActionPermitUsed"
    );
  });

  it("lets a recipient delegate exact delivery evidence while rejecting the wrong executor", async function () {
    const { id, params } = await createEthInvoice();
    await escrow.connect(payer).payInvoice(id, { value: params.amount });

    const permit = await signActionPermit(
      id,
      recipient,
      other.address,
      PermitAction.MarkDelivered,
      0n,
      "ipfs://agent-delivery-evidence",
      12n
    );

    await expect(escrow.connect(creator).executeActionPermit(permit.call)).to.be.revertedWithCustomError(
      escrow,
      "Unauthorized"
    );
    await escrow.connect(other).executeActionPermit(permit.call);

    const invoice = await escrow.getInvoice(id);
    expect(invoice.deliveryHash).to.equal("ipfs://agent-delivery-evidence");
    expect(invoice.deliveryEvidenceCount).to.equal(1);
    expect(await escrow.usedActionNonces(recipient.address, 12n)).to.equal(true);
  });

  it("binds settlement permits to exact amount and memo parameters", async function () {
    const { id, params } = await createEthInvoice();
    await escrow.connect(payer).payInvoice(id, { value: params.amount });

    const recipientAmount = ethers.parseEther("0.65");
    const permit = await signActionPermit(
      id,
      payer,
      other.address,
      PermitAction.ProposeSettlement,
      recipientAmount,
      "ipfs://agent-proposed-65-35",
      13n
    );
    const tampered = { ...permit.call, recipientAmount: recipientAmount + 1n };

    await expect(escrow.connect(other).executeActionPermit(tampered)).to.be.revertedWithCustomError(
      escrow,
      "InvalidSignature"
    );

    await escrow.connect(other).executeActionPermit(permit.call);
    const invoice = await escrow.getInvoice(id);
    expect(invoice.settlementProposedBy).to.equal(payer.address);
    expect(invoice.settlementRecipientAmount).to.equal(recipientAmount);
    expect(invoice.settlementMemoHash).to.equal("ipfs://agent-proposed-65-35");
  });

  it("rejects action permits outside their time window", async function () {
    const { id, params } = await createEthInvoice({ timeout: HOUR });
    await escrow.connect(payer).payInvoice(id, { value: params.amount });
    const now = await latestTimestamp();

    const expired = await signActionPermit(id, payer, other.address, PermitAction.RequestRefund, 0n, "", 14n, {
      expiresAt: now
    });
    await expect(escrow.connect(other).executeActionPermit(expired.call)).to.be.revertedWithCustomError(
      escrow,
      "ActionPermitExpired"
    );

    const inactive = await signActionPermit(id, payer, other.address, PermitAction.RequestRefund, 0n, "", 15n, {
      validAfter: now + HOUR
    });
    await expect(escrow.connect(other).executeActionPermit(inactive.call)).to.be.revertedWithCustomError(
      escrow,
      "ActionPermitNotActive"
    );
  });

  it("still checks invoice roles against the permit signer, not the relayer", async function () {
    const { id, params } = await createEthInvoice();
    await escrow.connect(payer).payInvoice(id, { value: params.amount });

    const permit = await signActionPermit(id, other, other.address, PermitAction.Release, 0n, "", 16n);

    await expect(escrow.connect(other).executeActionPermit(permit.call)).to.be.revertedWithCustomError(
      escrow,
      "Unauthorized"
    );
    expect(await escrow.usedActionNonces(other.address, 16n)).to.equal(false);
  });

  it("prevents agent mandate overwrite after first attachment", async function () {
    const { id } = await createEthInvoice();

    await escrow
      .connect(creator)
      .attachAgentMandate(id, ZERO_HASH, ZERO_HASH, ethers.id("original mandate"), ZERO_HASH, 0);

    await expect(
      escrow
      .connect(recipient)
      .attachAgentMandate(id, ZERO_HASH, ZERO_HASH, ethers.id("replacement mandate"), ZERO_HASH, 0)
    ).to.be.revertedWithCustomError(escrow, "MandateAlreadyAttached");
  });

  it("requires SLA mandates to be attached before payment with a future deadline", async function () {
    const { id, params } = await createEthInvoice();
    const now = await latestTimestamp();

    await expect(
      escrow
        .connect(creator)
        .attachAgentMandate(id, ZERO_HASH, ZERO_HASH, ethers.id("stale mandate"), ZERO_HASH, now)
    ).to.be.revertedWithCustomError(escrow, "InvalidSlaDeadline");

    await escrow.connect(recipient).postServiceBond(id, ethers.parseEther("0.1"), { value: ethers.parseEther("0.1") });
    await escrow.connect(payer).payInvoice(id, { value: params.amount });

    await expect(
      escrow
        .connect(payer)
        .attachAgentMandate(id, ZERO_HASH, ZERO_HASH, ethers.id("post-payment mandate"), ZERO_HASH, now + DAY)
    ).to.be.revertedWithCustomError(escrow, "InvalidState");
  });

  it("returns posted service bond to recipient on successful release", async function () {
    const { id, params } = await createEthInvoice();
    const bond = ethers.parseEther("0.25");

    await expect(() => escrow.connect(recipient).postServiceBond(id, bond, { value: bond })).to.changeEtherBalances(
      [recipient.address, await escrow.getAddress()],
      [-bond, bond]
    );

    await escrow.connect(payer).payInvoice(id, { value: params.amount });

    await expect(() => escrow.connect(payer).release(id)).to.changeEtherBalances(
      [await escrow.getAddress(), recipient.address],
      [-(params.amount + bond), params.amount + bond]
    );

    const bondContext = await escrow.getBondContext(id);
    expect(bondContext.activeAmount).to.equal(0);
    expect(bondContext.resolvedAmount).to.equal(bond);
    expect(bondContext.resolvedRecipient).to.equal(recipient.address);
    expect(bondContext.slashed).to.equal(false);
  });

  it("slashes service bond to payer when SLA is missed without timely delivery evidence", async function () {
    const { id, params } = await createEthInvoice({ timeout: HOUR });
    const now = await latestTimestamp();
    const bond = ethers.parseEther("0.2");

    await escrow
      .connect(creator)
      .attachAgentMandate(id, ZERO_HASH, ZERO_HASH, ethers.id("sla mandate"), ethers.id("delivery policy"), now + HOUR);
    await escrow.connect(recipient).postServiceBond(id, bond, { value: bond });
    await escrow.connect(payer).payInvoice(id, { value: params.amount });

    await increaseTime(HOUR + 1);
    await escrow.connect(payer).requestRefund(id);
    await increaseTime(HOUR + 1);

    await expect(() => escrow.connect(payer).refund(id)).to.changeEtherBalances(
      [await escrow.getAddress(), payer.address],
      [-(params.amount + bond), params.amount + bond]
    );

    const bondContext = await escrow.getBondContext(id);
    expect(bondContext.activeAmount).to.equal(0);
    expect(bondContext.resolvedAmount).to.equal(bond);
    expect(bondContext.resolvedRecipient).to.equal(payer.address);
    expect(bondContext.slashed).to.equal(true);
  });

  it("does not slash service bond when delivery evidence exists", async function () {
    const { id, params } = await createEthInvoice({ timeout: HOUR });
    const now = await latestTimestamp();
    const bond = ethers.parseEther("0.2");

    await escrow
      .connect(creator)
      .attachAgentMandate(id, ZERO_HASH, ZERO_HASH, ethers.id("delivery mandate"), ZERO_HASH, now + HOUR);
    await escrow.connect(recipient).postServiceBond(id, bond, { value: bond });
    await escrow.connect(payer).payInvoice(id, { value: params.amount });
    await escrow.connect(recipient).markDelivered(id, "ipfs://delivery-proof-before-refund");

    await increaseTime(HOUR + 1);
    await escrow.connect(payer).requestRefund(id);
    await increaseTime(HOUR + 1);

    await expect(() => escrow.connect(payer).refund(id)).to.changeEtherBalances(
      [await escrow.getAddress(), payer.address, recipient.address],
      [-(params.amount + bond), params.amount, bond]
    );

    const bondContext = await escrow.getBondContext(id);
    expect(bondContext.resolvedRecipient).to.equal(recipient.address);
    expect(bondContext.slashed).to.equal(false);
  });

  it("slashes service bond when delivery evidence is posted after SLA", async function () {
    const { id, params } = await createEthInvoice({ timeout: HOUR });
    const now = await latestTimestamp();
    const bond = ethers.parseEther("0.2");

    await escrow
      .connect(creator)
      .attachAgentMandate(id, ZERO_HASH, ZERO_HASH, ethers.id("late evidence mandate"), ZERO_HASH, now + HOUR);
    await escrow.connect(recipient).postServiceBond(id, bond, { value: bond });
    await escrow.connect(payer).payInvoice(id, { value: params.amount });

    await increaseTime(HOUR + 1);
    await escrow.connect(recipient).markDelivered(id, "ipfs://late-delivery-proof");
    await escrow.connect(payer).requestRefund(id);
    await increaseTime(HOUR + 1);

    await escrow.connect(payer).refund(id);

    const invoice = await escrow.getInvoice(id);
    const bondContext = await escrow.getBondContext(id);
    expect(invoice.deliveryMarkedAt).to.be.gt(invoice.paidAt);
    expect(bondContext.resolvedRecipient).to.equal(payer.address);
    expect(bondContext.slashed).to.equal(true);
  });

  it("validates mandate authorization and required mandate hash", async function () {
    const { id, params } = await createEthInvoice();

    await expect(
      escrow.connect(other).attachAgentMandate(id, ZERO_HASH, ZERO_HASH, ethers.id("mandate"), ZERO_HASH, 0)
    ).to.be.revertedWithCustomError(escrow, "Unauthorized");

    await expect(
      escrow.connect(creator).attachAgentMandate(id, ZERO_HASH, ZERO_HASH, ZERO_HASH, ZERO_HASH, 0)
    ).to.be.revertedWithCustomError(escrow, "InvalidMandate");

    await escrow.connect(payer).payInvoice(id, { value: params.amount });
    await escrow.connect(payer).release(id);

    await expect(
      escrow.connect(creator).attachAgentMandate(id, ZERO_HASH, ZERO_HASH, ethers.id("too-late"), ZERO_HASH, 0)
    ).to.be.revertedWithCustomError(escrow, "InvalidState");
  });

  it("rejects wrong ETH payment amount and double payment", async function () {
    const { id, params } = await createEthInvoice();

    await expect(escrow.connect(payer).payInvoice(id, { value: params.amount - 1n })).to.be.revertedWithCustomError(
      escrow,
      "IncorrectPayment"
    );

    await escrow.connect(payer).payInvoice(id, { value: params.amount });
    await expect(escrow.connect(other).payInvoice(id, { value: params.amount })).to.be.revertedWithCustomError(
      escrow,
      "InvalidState"
    );
  });

  it("rejects payments after due date", async function () {
    const now = await latestTimestamp();
    const { id, params } = await createEthInvoice({ dueAt: now + HOUR });

    await increaseTime(HOUR + 1);
    await expect(escrow.connect(payer).payInvoice(id, { value: params.amount })).to.be.revertedWithCustomError(
      escrow,
      "InvoicePastDue"
    );
  });

  it("allows payer to release funds to recipient", async function () {
    const { id, params } = await createEthInvoice();
    await escrow.connect(payer).payInvoice(id, { value: params.amount });

    await expect(() => escrow.connect(payer).release(id)).to.changeEtherBalances(
      [await escrow.getAddress(), recipient.address],
      [-params.amount, params.amount]
    );

    const invoice = await escrow.getInvoice(id);
    expect(invoice.state).to.equal(3);
  });

  it("emits a portable settlement receipt when funds are released", async function () {
    const { id, params } = await createEthInvoice();
    await escrow
      .connect(creator)
      .attachAgentMandate(
        id,
        ethers.id("payer-agent"),
        ethers.id("recipient-agent"),
        ethers.id("signed mandate"),
        ethers.id("agent policy"),
        (await latestTimestamp()) + DAY
      );
    await escrow.connect(payer).payInvoice(id, { value: params.amount });

    const tx = await escrow.connect(payer).release(id);
    const receipt = await tx.wait();
    const receiptEvent = receipt.logs.find((log) => log.fragment && log.fragment.name === "SettlementReceiptFinalized");

    expect(receiptEvent.args.invoiceId).to.equal(id);
    expect(receiptEvent.args.finalState).to.equal(3);
    expect(receiptEvent.args.receiptHash).to.equal(await escrow.settlementReceiptHash(id));
  });

  it("accepts post-settlement agent feedback bound to the receipt hash", async function () {
    const { id, params } = await createEthInvoice();
    const payerAgentHash = ethers.id("payer-agent-feedback");
    const recipientAgentHash = ethers.id("recipient-agent-feedback");

    await escrow
      .connect(creator)
      .attachAgentMandate(
        id,
        payerAgentHash,
        recipientAgentHash,
        ethers.id("feedback mandate"),
        ethers.id("feedback policy"),
        (await latestTimestamp()) + DAY
      );
    await escrow.connect(payer).payInvoice(id, { value: params.amount });
    await escrow.connect(payer).release(id);

    const receiptHash = await escrow.settlementReceiptHash(id);
    const feedbackTx = await escrow
      .connect(payer)
      .submitAgentFeedback(
        id,
        true,
        88,
        "delivery",
        "on-time",
        "ipfs://payer-feedback",
        ethers.id("payer feedback payload")
      );
    const feedbackReceipt = await feedbackTx.wait();
    const feedbackEvent = feedbackReceipt.logs.find((log) => log.fragment && log.fragment.name === "AgentFeedbackSubmitted");

    const first = await escrow.getFeedbackContext(id);
    expect(first.count).to.equal(1);
    expect(first.root).to.not.equal(ZERO_HASH);
    expect(feedbackEvent.args.invoiceId).to.equal(id);
    expect(feedbackEvent.args.reviewer).to.equal(payer.address);
    expect(feedbackEvent.args.agentHash).to.equal(recipientAgentHash);
    expect(feedbackEvent.args.recipientAgent).to.equal(true);
    expect(feedbackEvent.args.score).to.equal(88);
    expect(feedbackEvent.args.receiptHash).to.equal(receiptHash);
    expect(feedbackEvent.args.feedbackCount).to.equal(1);
    expect(feedbackEvent.args.feedbackRoot).to.equal(first.root);

    await escrow
      .connect(recipient)
      .submitAgentFeedback(id, false, 75, "payment", "clear", "ipfs://recipient-feedback", ethers.id("recipient feedback payload"));

    const second = await escrow.getFeedbackContext(id);
    expect(second.count).to.equal(2);
    expect(second.root).to.not.equal(first.root);
  });

  it("restricts agent feedback to settled counterparties and valid scores", async function () {
    const { id, params } = await createEthInvoice();
    await escrow
      .connect(creator)
      .attachAgentMandate(
        id,
        ethers.id("payer-agent-feedback-restrictions"),
        ethers.id("recipient-agent-feedback-restrictions"),
        ethers.id("feedback restrictions mandate"),
        ZERO_HASH,
        0
      );

    await expect(
      escrow.connect(payer).submitAgentFeedback(id, true, 50, "early", "", "ipfs://early", ZERO_HASH)
    ).to.be.revertedWithCustomError(escrow, "InvalidState");

    await escrow.connect(payer).payInvoice(id, { value: params.amount });
    await escrow.connect(payer).release(id);

    await expect(
      escrow.connect(other).submitAgentFeedback(id, true, 50, "bad", "", "ipfs://bad", ZERO_HASH)
    ).to.be.revertedWithCustomError(escrow, "Unauthorized");

    await expect(
      escrow.connect(payer).submitAgentFeedback(id, true, 101, "too-high", "", "ipfs://bad", ZERO_HASH)
    ).to.be.revertedWithCustomError(escrow, "InvalidFeedback");

    await expect(
      escrow.connect(payer).submitAgentFeedback(id, false, 50, "wrong-side", "", "ipfs://bad", ZERO_HASH)
    ).to.be.revertedWithCustomError(escrow, "Unauthorized");
  });

  it("prevents wrong caller release before timeout and double release", async function () {
    const { id, params } = await createEthInvoice();
    await escrow.connect(payer).payInvoice(id, { value: params.amount });

    await expect(escrow.connect(other).release(id)).to.be.revertedWithCustomError(escrow, "Unauthorized");
    await expect(escrow.connect(recipient).release(id)).to.be.revertedWithCustomError(escrow, "Unauthorized");

    await escrow.connect(payer).release(id);
    await expect(escrow.connect(payer).release(id)).to.be.revertedWithCustomError(escrow, "InvalidState");
  });

  it("allows recipient timeout release when payer is inactive", async function () {
    const { id, params } = await createEthInvoice({ timeout: HOUR });
    await escrow.connect(payer).payInvoice(id, { value: params.amount });

    await increaseTime(HOUR + 1);
    await escrow.connect(recipient).release(id);

    const invoice = await escrow.getInvoice(id);
    expect(invoice.state).to.equal(3);
  });

  it("blocks recipient timeout release when SLA requires timely delivery evidence", async function () {
    const { id, params } = await createEthInvoice({ timeout: HOUR });
    const now = await latestTimestamp();

    await escrow
      .connect(creator)
      .attachAgentMandate(id, ZERO_HASH, ZERO_HASH, ethers.id("timely release mandate"), ZERO_HASH, now + HOUR);
    await escrow.connect(payer).payInvoice(id, { value: params.amount });

    await increaseTime(HOUR + 1);
    await expect(escrow.connect(recipient).release(id)).to.be.revertedWithCustomError(escrow, "Unauthorized");
  });

  it("allows recipient timeout release when delivery evidence was posted before SLA", async function () {
    const { id, params } = await createEthInvoice({ timeout: HOUR });
    const now = await latestTimestamp();

    await escrow
      .connect(creator)
      .attachAgentMandate(id, ZERO_HASH, ZERO_HASH, ethers.id("timely evidence mandate"), ZERO_HASH, now + HOUR);
    await escrow.connect(payer).payInvoice(id, { value: params.amount });
    await escrow.connect(recipient).markDelivered(id, "ipfs://timely-delivery-proof");

    await increaseTime(HOUR + 1);
    await escrow.connect(recipient).release(id);

    const invoice = await escrow.getInvoice(id);
    expect(invoice.state).to.equal(3);
  });

  it("supports refund request and recipient-approved refund", async function () {
    const { id, params } = await createEthInvoice();
    await escrow.connect(payer).payInvoice(id, { value: params.amount });
    await escrow.connect(payer).requestRefund(id);

    await expect(() => escrow.connect(recipient).refund(id)).to.changeEtherBalances(
      [await escrow.getAddress(), payer.address],
      [-params.amount, params.amount]
    );

    const invoice = await escrow.getInvoice(id);
    expect(invoice.state).to.equal(4);
  });

  it("lets recipient attach delivery evidence while funds are escrowed", async function () {
    const { id, params } = await createEthInvoice();
    await escrow.connect(payer).payInvoice(id, { value: params.amount });

    await expect(escrow.connect(other).markDelivered(id, "ipfs://delivery-proof")).to.be.revertedWithCustomError(
      escrow,
      "Unauthorized"
    );

    await expect(escrow.connect(recipient).markDelivered(id, "ipfs://delivery-proof"))
      .to.emit(escrow, "DeliveryMarked")
      .withArgs(id, recipient.address, "ipfs://delivery-proof");

    const invoice = await escrow.getInvoice(id);
    expect(invoice.deliveryHash).to.equal("ipfs://delivery-proof");
    expect(invoice.deliveryEvidenceCount).to.equal(1);
    expect(invoice.deliveryEvidenceRoot).to.not.equal(ZERO_HASH);
  });

  it("appends delivery evidence without overwriting first SLA timestamp", async function () {
    const { id, params } = await createEthInvoice({ timeout: HOUR });
    const now = await latestTimestamp();

    await escrow
      .connect(creator)
      .attachAgentMandate(id, ZERO_HASH, ZERO_HASH, ethers.id("append delivery mandate"), ZERO_HASH, now + HOUR);
    await escrow.connect(payer).payInvoice(id, { value: params.amount });
    await escrow.connect(recipient).markDelivered(id, "ipfs://first-delivery-proof");

    const first = await escrow.getInvoice(id);
    await increaseTime(HOUR + 1);
    await escrow.connect(recipient).markDelivered(id, "ipfs://supplemental-delivery-proof");

    const second = await escrow.getInvoice(id);
    expect(second.deliveryHash).to.equal("ipfs://first-delivery-proof");
    expect(second.deliveryMarkedAt).to.equal(first.deliveryMarkedAt);
    expect(second.deliveryEvidenceCount).to.equal(2);
    expect(second.deliveryEvidenceRoot).to.not.equal(first.deliveryEvidenceRoot);
  });

  it("lets recipient attach delivery evidence after refund request", async function () {
    const { id, params } = await createEthInvoice();
    await escrow.connect(payer).payInvoice(id, { value: params.amount });
    await escrow.connect(payer).requestRefund(id);

    await escrow.connect(recipient).markDelivered(id, "ipfs://late-delivery-proof");

    const invoice = await escrow.getInvoice(id);
    expect(invoice.deliveryHash).to.equal("ipfs://late-delivery-proof");
  });

  it("lets payer attach dispute evidence while funds are escrowed or refund requested", async function () {
    const { id, params } = await createEthInvoice();
    await escrow.connect(payer).payInvoice(id, { value: params.amount });

    await expect(escrow.connect(other).markDisputed(id, "ipfs://bad-dispute")).to.be.revertedWithCustomError(
      escrow,
      "Unauthorized"
    );

    await expect(escrow.connect(payer).markDisputed(id, "ipfs://initial-dispute-proof"))
      .to.emit(escrow, "DisputeMarked")
      .withArgs(id, payer.address, "ipfs://initial-dispute-proof");

    const first = await escrow.getInvoice(id);
    expect(first.disputeHash).to.equal("ipfs://initial-dispute-proof");
    expect(first.disputeEvidenceCount).to.equal(1);
    expect(first.disputeEvidenceRoot).to.not.equal(ZERO_HASH);

    await escrow.connect(payer).requestRefund(id);
    await escrow.connect(payer).markDisputed(id, "ipfs://supplemental-dispute-proof");

    const second = await escrow.getInvoice(id);
    expect(second.disputeHash).to.equal("ipfs://initial-dispute-proof");
    expect(second.disputeMarkedAt).to.equal(first.disputeMarkedAt);
    expect(second.disputeEvidenceCount).to.equal(2);
    expect(second.disputeEvidenceRoot).to.not.equal(first.disputeEvidenceRoot);
  });

  it("rejects empty delivery and dispute evidence", async function () {
    const { id, params } = await createEthInvoice();
    await escrow.connect(payer).payInvoice(id, { value: params.amount });

    await expect(escrow.connect(recipient).markDelivered(id, "")).to.be.revertedWithCustomError(
      escrow,
      "InvalidEvidence"
    );
    await expect(escrow.connect(payer).markDisputed(id, "")).to.be.revertedWithCustomError(
      escrow,
      "InvalidEvidence"
    );
  });

  it("prevents timeout refund before waiting period", async function () {
    const { id, params } = await createEthInvoice({ timeout: HOUR });
    await escrow.connect(payer).payInvoice(id, { value: params.amount });
    await escrow.connect(payer).requestRefund(id);

    await expect(escrow.connect(payer).refund(id)).to.be.revertedWithCustomError(escrow, "RefundTimeoutNotReached");
  });

  it("allows payer timeout refund after refund request timeout", async function () {
    const { id, params } = await createEthInvoice({ timeout: HOUR });
    await escrow.connect(payer).payInvoice(id, { value: params.amount });
    await escrow.connect(payer).requestRefund(id);

    await increaseTime(HOUR + 1);
    await expect(() => escrow.connect(payer).refund(id)).to.changeEtherBalances(
      [await escrow.getAddress(), payer.address],
      [-params.amount, params.amount]
    );

    const invoice = await escrow.getInvoice(id);
    expect(invoice.state).to.equal(4);
  });

  it("supports negotiated ETH settlement with partial recipient payout", async function () {
    const { id, params } = await createEthInvoice();
    await escrow.connect(payer).payInvoice(id, { value: params.amount });

    const recipientAmount = ethers.parseEther("0.7");
    const payerAmount = params.amount - recipientAmount;

    await expect(escrow.connect(payer).proposeSettlement(id, recipientAmount, "ipfs://settlement-70-30"))
      .to.emit(escrow, "SettlementProposed")
      .withArgs(id, payer.address, recipientAmount, payerAmount, "ipfs://settlement-70-30");

    let invoice = await escrow.getInvoice(id);
    expect(invoice.settlementProposedBy).to.equal(payer.address);
    expect(invoice.settlementRecipientAmount).to.equal(recipientAmount);
    expect(invoice.settlementMemoHash).to.equal("ipfs://settlement-70-30");

    await expect(() => escrow.connect(recipient).acceptSettlement(id)).to.changeEtherBalances(
      [await escrow.getAddress(), recipient.address, payer.address],
      [-params.amount, recipientAmount, payerAmount]
    );

    invoice = await escrow.getInvoice(id);
    expect(invoice.state).to.equal(6);
  });

  it("prevents proposer from accepting their own settlement proposal", async function () {
    const { id, params } = await createEthInvoice();
    await escrow.connect(payer).payInvoice(id, { value: params.amount });
    await escrow.connect(recipient).proposeSettlement(id, ethers.parseEther("0.8"), "ipfs://recipient-proposal");

    await expect(escrow.connect(recipient).acceptSettlement(id)).to.be.revertedWithCustomError(escrow, "Unauthorized");
    await escrow.connect(payer).acceptSettlement(id);

    const invoice = await escrow.getInvoice(id);
    expect(invoice.state).to.equal(6);
  });

  it("lets settlement proposer cancel a stale proposal", async function () {
    const { id, params } = await createEthInvoice();
    await escrow.connect(payer).payInvoice(id, { value: params.amount });
    await escrow.connect(payer).proposeSettlement(id, ethers.parseEther("0.8"), "ipfs://payer-proposal");

    await expect(escrow.connect(recipient).cancelSettlementProposal(id)).to.be.revertedWithCustomError(
      escrow,
      "Unauthorized"
    );
    await expect(escrow.connect(payer).cancelSettlementProposal(id))
      .to.emit(escrow, "SettlementProposalCancelled")
      .withArgs(id, payer.address);

    const invoice = await escrow.getInvoice(id);
    expect(invoice.settlementProposedBy).to.equal(ZERO_ADDRESS);
    expect(invoice.settlementRecipientAmount).to.equal(0);
    expect(invoice.settlementMemoHash).to.equal("");
    await expect(escrow.connect(recipient).acceptSettlement(id)).to.be.revertedWithCustomError(
      escrow,
      "NoSettlementProposal"
    );
  });

  it("validates settlement proposal state, caller, and amount", async function () {
    const { id, params } = await createEthInvoice();

    await expect(
      escrow.connect(payer).proposeSettlement(id, params.amount, "ipfs://too-early")
    ).to.be.revertedWithCustomError(escrow, "InvalidState");

    await escrow.connect(payer).payInvoice(id, { value: params.amount });

    await expect(
      escrow.connect(other).proposeSettlement(id, params.amount, "ipfs://bad-caller")
    ).to.be.revertedWithCustomError(escrow, "Unauthorized");

    await expect(
      escrow.connect(payer).proposeSettlement(id, params.amount + 1n, "ipfs://too-large")
    ).to.be.revertedWithCustomError(escrow, "InvalidSettlementAmount");

    await expect(escrow.connect(payer).acceptSettlement(id)).to.be.revertedWithCustomError(
      escrow,
      "NoSettlementProposal"
    );
  });

  it("handles ERC20 pay and release path", async function () {
    const amount = ethers.parseUnits("250", 18);
    await token.mint(payer.address, amount);

    const now = await latestTimestamp();
    const tx = await escrow
      .connect(creator)
      .createInvoice(recipient.address, await token.getAddress(), amount, "ipfs://erc20-invoice", now + DAY, DAY);
    const receipt = await tx.wait();
    const id = receipt.logs.find((log) => log.fragment && log.fragment.name === "InvoiceCreated").args.invoiceId;

    await token.connect(payer).approve(await escrow.getAddress(), amount);
    await escrow.connect(payer).payInvoice(id);
    expect(await token.balanceOf(await escrow.getAddress())).to.equal(amount);

    await escrow.connect(payer).release(id);
    expect(await token.balanceOf(recipient.address)).to.equal(amount);
  });

  it("handles ERC20 negotiated settlement split", async function () {
    const amount = ethers.parseUnits("300", 18);
    await token.mint(payer.address, amount);

    const now = await latestTimestamp();
    const tx = await escrow
      .connect(creator)
      .createInvoice(recipient.address, await token.getAddress(), amount, "ipfs://erc20-settlement", now + DAY, DAY);
    const receipt = await tx.wait();
    const id = receipt.logs.find((log) => log.fragment && log.fragment.name === "InvoiceCreated").args.invoiceId;

    await token.connect(payer).approve(await escrow.getAddress(), amount);
    await escrow.connect(payer).payInvoice(id);

    const recipientAmount = ethers.parseUnits("225", 18);
    const payerAmount = amount - recipientAmount;
    await escrow.connect(recipient).proposeSettlement(id, recipientAmount, "ipfs://erc20-split");
    await escrow.connect(payer).acceptSettlement(id);

    expect(await token.balanceOf(recipient.address)).to.equal(recipientAmount);
    expect(await token.balanceOf(payer.address)).to.equal(payerAmount);
    expect(await token.balanceOf(await escrow.getAddress())).to.equal(0);
  });

  it("handles ERC20 service bond return on settlement", async function () {
    const amount = ethers.parseUnits("300", 18);
    const bond = ethers.parseUnits("30", 18);
    await token.mint(payer.address, amount);
    await token.mint(recipient.address, bond);

    const now = await latestTimestamp();
    const tx = await escrow
      .connect(creator)
      .createInvoice(recipient.address, await token.getAddress(), amount, "ipfs://erc20-bond", now + DAY, DAY);
    const receipt = await tx.wait();
    const id = receipt.logs.find((log) => log.fragment && log.fragment.name === "InvoiceCreated").args.invoiceId;

    await token.connect(recipient).approve(await escrow.getAddress(), bond);
    await escrow.connect(recipient).postServiceBond(id, bond);

    await token.connect(payer).approve(await escrow.getAddress(), amount);
    await escrow.connect(payer).payInvoice(id);

    const recipientAmount = ethers.parseUnits("240", 18);
    await escrow.connect(payer).proposeSettlement(id, recipientAmount, "ipfs://erc20-bonded-settlement");
    await escrow.connect(recipient).acceptSettlement(id);

    expect(await token.balanceOf(recipient.address)).to.equal(recipientAmount + bond);
    expect(await token.balanceOf(await escrow.getAddress())).to.equal(0);
  });

  it("rejects ETH value on ERC20 invoice", async function () {
    const amount = ethers.parseUnits("10", 18);
    const now = await latestTimestamp();
    const tx = await escrow
      .connect(creator)
      .createInvoice(recipient.address, await token.getAddress(), amount, "ipfs://bad-erc20-pay", now + DAY, DAY);
    const receipt = await tx.wait();
    const id = receipt.logs.find((log) => log.fragment && log.fragment.name === "InvoiceCreated").args.invoiceId;

    await expect(escrow.connect(payer).payInvoice(id, { value: 1 })).to.be.revertedWithCustomError(
      escrow,
      "IncorrectPayment"
    );
  });

  it("rejects fee-on-transfer ERC20 invoice payment that receives less than requested", async function () {
    const amount = ethers.parseUnits("100", 18);
    await feeToken.mint(payer.address, amount);

    const now = await latestTimestamp();
    const tx = await escrow
      .connect(creator)
      .createInvoice(recipient.address, await feeToken.getAddress(), amount, "ipfs://fee-token", now + DAY, DAY);
    const receipt = await tx.wait();
    const id = receipt.logs.find((log) => log.fragment && log.fragment.name === "InvoiceCreated").args.invoiceId;

    await feeToken.connect(payer).approve(await escrow.getAddress(), amount);
    await expect(escrow.connect(payer).payInvoice(id)).to.be.revertedWithCustomError(escrow, "IncorrectPayment");
  });

  it("rejects fee-on-transfer ERC20 service bond that receives less than requested", async function () {
    const amount = ethers.parseUnits("100", 18);
    const bond = ethers.parseUnits("10", 18);
    await feeToken.mint(recipient.address, bond);

    const now = await latestTimestamp();
    const tx = await escrow
      .connect(creator)
      .createInvoice(recipient.address, await feeToken.getAddress(), amount, "ipfs://fee-bond", now + DAY, DAY);
    const receipt = await tx.wait();
    const id = receipt.logs.find((log) => log.fragment && log.fragment.name === "InvoiceCreated").args.invoiceId;

    await feeToken.connect(recipient).approve(await escrow.getAddress(), bond);
    await expect(escrow.connect(recipient).postServiceBond(id, bond)).to.be.revertedWithCustomError(
      escrow,
      "IncorrectPayment"
    );
  });
});
