const { expect } = require("chai");
const { ethers, network } = require("hardhat");

const ZERO_ADDRESS = ethers.ZeroAddress;
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
});
