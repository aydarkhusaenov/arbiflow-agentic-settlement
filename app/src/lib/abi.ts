export const invoiceEscrowAbi = [
  {
    type: "function",
    name: "invoiceCount",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256", internalType: "uint256" }]
  },
  {
    type: "function",
    name: "getInvoice",
    stateMutability: "view",
    inputs: [{ name: "invoiceId", type: "uint256", internalType: "uint256" }],
    outputs: [
      {
        name: "",
        type: "tuple",
        internalType: "struct InvoiceEscrow.Invoice",
        components: [
          { name: "creator", type: "address", internalType: "address" },
          { name: "payer", type: "address", internalType: "address" },
          { name: "recipient", type: "address", internalType: "address" },
          { name: "token", type: "address", internalType: "address" },
          { name: "amount", type: "uint256", internalType: "uint256" },
          { name: "dueAt", type: "uint64", internalType: "uint64" },
          { name: "paidAt", type: "uint64", internalType: "uint64" },
          { name: "timeout", type: "uint64", internalType: "uint64" },
          { name: "refundRequestedAt", type: "uint64", internalType: "uint64" },
          { name: "state", type: "uint8", internalType: "enum InvoiceEscrow.State" },
          { name: "metadataHash", type: "string", internalType: "string" }
        ]
      }
    ]
  },
  {
    type: "function",
    name: "createInvoice",
    stateMutability: "nonpayable",
    inputs: [
      { name: "recipient", type: "address", internalType: "address" },
      { name: "token", type: "address", internalType: "address" },
      { name: "amount", type: "uint256", internalType: "uint256" },
      { name: "metadataHash", type: "string", internalType: "string" },
      { name: "dueAt", type: "uint64", internalType: "uint64" },
      { name: "timeout", type: "uint64", internalType: "uint64" }
    ],
    outputs: [{ name: "invoiceId", type: "uint256", internalType: "uint256" }]
  },
  {
    type: "function",
    name: "payInvoice",
    stateMutability: "payable",
    inputs: [{ name: "invoiceId", type: "uint256", internalType: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "release",
    stateMutability: "nonpayable",
    inputs: [{ name: "invoiceId", type: "uint256", internalType: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "requestRefund",
    stateMutability: "nonpayable",
    inputs: [{ name: "invoiceId", type: "uint256", internalType: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "refund",
    stateMutability: "nonpayable",
    inputs: [{ name: "invoiceId", type: "uint256", internalType: "uint256" }],
    outputs: []
  },
  {
    type: "function",
    name: "cancelUnpaid",
    stateMutability: "nonpayable",
    inputs: [{ name: "invoiceId", type: "uint256", internalType: "uint256" }],
    outputs: []
  }
] as const;
