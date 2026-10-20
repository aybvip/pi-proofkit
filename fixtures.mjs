// fixtures.mjs — a worked example pack, built from a measurement this project
// family already recorded elsewhere. It exists so the CLI has something real to
// show and the tests have something real to verify.
//
// The values are the MEASURED facts recorded in pi-soroban-events and
// pi-api-contract-registry on 2026-10-19. The pack itself does not re-measure
// them; it packages them WITH their basis, so a reader can go and re-measure.

export const SAMPLE_SCOPE = {
  endpoint: "https://rpc.testnet.minepi.com",
  tool: "pi-proofkit --example",
  version: "node 28.0.1 / protocol 28",
  measuredAt: "2026-10-19",
};

export const SAMPLE_CLAIMS = [
  {
    key: "network.passphrase",
    kind: "measured",
    value: "Pi Testnet",
    basis: "getNetwork.result.passphrase",
  },
  {
    key: "node.version",
    kind: "measured",
    value: "28.0.1",
    basis: "getVersionInfo.result.version",
  },
  {
    key: "protocol.version",
    kind: "measured",
    value: 28,
    basis: "getVersionInfo.result.protocolVersion",
  },
  {
    key: "events.pageCap",
    kind: "measured",
    value: 100,
    basis: "getEvents returned exactly 100 events for a full window; a larger limit is ignored",
  },
  {
    key: "ledger.retentionWindow",
    kind: "measured",
    value: 120960,
    basis: "getHealth.result.ledgerRetentionWindow, and the independent measurement in pi-soroban-events",
  },
  {
    key: "ledger.retentionDays",
    kind: "derived",
    value: 7,
    basis: "120960 ledgers * 5 s / 86400 s per day = 7 days",
  },
  {
    key: "endLedger.exclusive",
    kind: "measured",
    value: true,
    basis: "getEvents with [L, L] returned 0 events; with [L, L+1] returned ledger L",
  },
  {
    key: "mainnet.sorobanRpc.reachable",
    kind: "measured",
    value: false,
    basis: "GET rpc.mainnet.minepi.com returned HTTP 503",
  },
];

export const SAMPLE_EVIDENCE = {
  "network.passphrase": "node registry-cli.mjs --conformance   # C-NET-1 checks this live",
  "node.version": "node registry-cli.mjs --conformance   # C-VER-1 checks this live",
  "protocol.version": "node registry-cli.mjs --conformance   # C-NET-1 checks this live",
  "events.pageCap": "node registry-cli.mjs --conformance   # C-EVT-1 checks this live",
  "ledger.retentionWindow": "node registry-cli.mjs --conformance   # C-HEALTH-1 checks this live",
  "ledger.retentionDays": "arithmetic on the measured retention window; no measurement of its own",
  "endLedger.exclusive": "node pi-soroban-events/…   # the exclusive-endLedger measurement",
  "mainnet.sorobanRpc.reachable": "a plain GET to rpc.mainnet.minepi.com; observed HTTP 503",
};
