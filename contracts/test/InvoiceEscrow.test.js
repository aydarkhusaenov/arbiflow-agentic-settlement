const { expect } = require("chai");
const { ethers, network } = require("hardhat");

const ZERO_ADDRESS = ethers.ZeroAddress;
const ZERO_HASH = ethers.ZeroHash;
const HOUR = 60 * 60;
const DAY = 24 * HOUR;

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

  it("creates invoices with expected fields", async function () {
    const { id, params } = await createEthInvoice();

    const invoice = await escrow.getInvoice(id);
    expect(invoice.creator).to.equal(creator.address);
    expect(invoice.recipient).to.equal(recipient.address);
    expect(invoice.token).to.equal(params.token);
    expect(invoice.amount).to.equal(params.amount);
    expect(invoice.metadataHash).to.equal(params.metadataHash);
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
      .withArgs(id, creator.address, payerAgentHash, recipientAgentHash, mandateHash, policyHash, slaDeadline);

    const context = await escrow.getAgentContext(id);
    expect(context.payerAgentHash).to.equal(payerAgentHash);
    expect(context.recipientAgentHash).to.equal(recipientAgentHash);
    expect(context.mandateHash).to.equal(mandateHash);
    expect(context.policyHash).to.equal(policyHash);
    expect(context.slaDeadline).to.equal(slaDeadline);
    expect(context.attachedBy).to.equal(creator.address);

    const receiptHash = await escrow.settlementReceiptHash(id);
    expect(receiptHash).to.not.equal(ZERO_HASH);
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
  });

  it("lets recipient attach delivery evidence after refund request", async function () {
    const { id, params } = await createEthInvoice();
    await escrow.connect(payer).payInvoice(id, { value: params.amount });
    await escrow.connect(payer).requestRefund(id);

    await escrow.connect(recipient).markDelivered(id, "ipfs://late-delivery-proof");

    const invoice = await escrow.getInvoice(id);
    expect(invoice.deliveryHash).to.equal("ipfs://late-delivery-proof");
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
