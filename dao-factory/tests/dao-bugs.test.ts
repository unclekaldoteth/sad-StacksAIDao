import { describe, it, expect } from "vitest";
import {
  Cl,
  type ClarityValue,
  ClarityType,
  cvToValue,
  isClarityType,
} from "@stacks/transactions";

describe("DAO bug fixes", () => {
  const accounts = simnet.getAccounts();
  const deployer = accounts.get("deployer")!;
  const wallet1 = accounts.get("wallet_1")!;
  const wallet2 = accounts.get("wallet_2")!;

  function toBigIntValue(value: unknown): bigint {
    if (typeof value === "bigint") {
      return value;
    }
    if (typeof value === "number" || typeof value === "string") {
      return BigInt(value);
    }
    if (value && typeof value === "object" && "value" in value) {
      return toBigIntValue((value as { value: unknown }).value);
    }
    throw new Error("expected bigint-compatible value");
  }

  function unwrapResponseOkUint(cv: ClarityValue): bigint {
    if (!isClarityType(cv, ClarityType.ResponseOk)) {
      throw new Error("expected response ok");
    }
    return toBigIntValue(cvToValue(cv.value));
  }

  function getTupleUint(cv: ClarityValue, key: string): bigint {
    const tuple = cvToValue(cv) as Record<string, unknown>;
    const field = tuple[key];
    if (field === undefined || field === null) {
      throw new Error(`expected uint tuple field: ${key}`);
    }
    return toBigIntValue(field);
  }

  it("clamps voting power underflow", () => {
    const balanceRes = simnet.callReadOnlyFn(
      "governance-token",
      "get-stx-balance",
      [Cl.principal(wallet1)],
      wallet1
    );
    const balance = cvToValue(balanceRes.result) as bigint;

    const delegateRes = simnet.callPublicFn(
      "governance-token",
      "delegate",
      [Cl.principal(wallet2), Cl.uint(balance)],
      wallet1
    );
    expect(delegateRes.result).toBeOk(Cl.bool(true));

    const transferRes = simnet.transferSTX(1n, wallet2, wallet1);
    expect(transferRes.result).toBeOk(Cl.bool(true));

    const powerRes = simnet.callReadOnlyFn(
      "governance-token",
      "get-voting-power",
      [Cl.principal(wallet1)],
      wallet1
    );
    expect(powerRes.result).toBeOk(Cl.uint(0));
  });

  it("rejects invalid vote option", () => {
    const proposeRes = simnet.callPublicFn(
      "proposal-submission",
      "propose",
      [Cl.stringAscii("Title"), Cl.stringUtf8("Desc"), Cl.none()],
      wallet1
    );
    expect(proposeRes.result).toBeOk(Cl.uint(1));

    simnet.mineEmptyBlocks(144);

    const activateRes = simnet.callPublicFn(
      "proposal-submission",
      "activate-proposal",
      [Cl.uint(1)],
      wallet1
    );
    expect(activateRes.result).toBeOk(Cl.bool(true));

    const voteRes = simnet.callPublicFn(
      "proposal-voting",
      "vote",
      [Cl.uint(1), Cl.uint(99)],
      wallet1
    );
    expect(voteRes.result).toBeErr(Cl.uint(6008));
  });

  it("conclude updates proposal status", () => {
    const enableRes = simnet.callPublicFn(
      "dao-core",
      "set-extension",
      [Cl.contractPrincipal(deployer, "proposal-voting"), Cl.bool(true)],
      deployer
    );
    expect(enableRes.result).toBeOk(Cl.bool(true));

    const proposeRes = simnet.callPublicFn(
      "proposal-submission",
      "propose",
      [Cl.stringAscii("Title"), Cl.stringUtf8("Desc"), Cl.none()],
      wallet1
    );
    expect(proposeRes.result).toBeOk(Cl.uint(1));

    simnet.mineEmptyBlocks(144);

    const activateRes = simnet.callPublicFn(
      "proposal-submission",
      "activate-proposal",
      [Cl.uint(1)],
      wallet1
    );
    expect(activateRes.result).toBeOk(Cl.bool(true));

    const voteRes = simnet.callPublicFn(
      "proposal-voting",
      "vote",
      [Cl.uint(1), Cl.uint(1)],
      wallet1
    );
    expect(voteRes.result).toBeOk(Cl.bool(true));

    simnet.mineEmptyBlocks(1441);

    const concludeRes = simnet.callPublicFn(
      "proposal-voting",
      "conclude",
      [Cl.uint(1)],
      wallet1
    );
    expect(concludeRes.result).toBeOk(expect.anything());

    const statusRes = simnet.callReadOnlyFn(
      "proposal-submission",
      "get-proposal-status",
      [Cl.uint(1)],
      wallet1
    );
    if (!isClarityType(statusRes.result, ClarityType.OptionalSome)) {
      throw new Error("expected proposal status to be set");
    }
    const status = cvToValue(statusRes.result.value) as bigint;
    expect([3n, 4n]).toContain(status);
  });

  it("records execution only on success", () => {
    const enableRes = simnet.callPublicFn(
      "dao-core",
      "set-extension",
      [Cl.contractPrincipal(deployer, "test-executor"), Cl.bool(true)],
      deployer
    );
    expect(enableRes.result).toBeOk(Cl.bool(true));

    const setFailRes = simnet.callPublicFn(
      "mock-proposal",
      "set-should-fail",
      [Cl.bool(true)],
      deployer
    );
    expect(setFailRes.result).toBeOk(Cl.bool(true));

    const execFailRes = simnet.callPublicFn(
      "test-executor",
      "execute-proposal",
      [Cl.contractPrincipal(deployer, "mock-proposal"), Cl.principal(wallet1)],
      deployer
    );
    expect(execFailRes.result).toBeErr(Cl.uint(1));

    const executedNoneRes = simnet.callReadOnlyFn(
      "dao-core",
      "executed-at",
      [Cl.contractPrincipal(deployer, "mock-proposal")],
      deployer
    );
    expect(executedNoneRes.result).toBeNone();

    const setOkRes = simnet.callPublicFn(
      "mock-proposal",
      "set-should-fail",
      [Cl.bool(false)],
      deployer
    );
    expect(setOkRes.result).toBeOk(Cl.bool(true));

    const execOkRes = simnet.callPublicFn(
      "test-executor",
      "execute-proposal",
      [Cl.contractPrincipal(deployer, "mock-proposal"), Cl.principal(wallet1)],
      deployer
    );
    expect(execOkRes.result).toBeOk(Cl.bool(true));

    const executedSomeRes = simnet.callReadOnlyFn(
      "dao-core",
      "executed-at",
      [Cl.contractPrincipal(deployer, "mock-proposal")],
      deployer
    );
    if (!isClarityType(executedSomeRes.result, ClarityType.OptionalSome)) {
      throw new Error("expected executed-at to be set");
    }
  });

  it("uses delegated governance-token power for vote tally", () => {
    const enableRes = simnet.callPublicFn(
      "dao-core",
      "set-extension",
      [Cl.contractPrincipal(deployer, "proposal-voting"), Cl.bool(true)],
      deployer
    );
    expect(enableRes.result).toBeOk(Cl.bool(true));

    const delegateRes = simnet.callPublicFn(
      "governance-token",
      "delegate",
      [Cl.principal(wallet2), Cl.uint(1_000_000)],
      wallet1
    );
    expect(delegateRes.result).toBeOk(Cl.bool(true));

    const proposeRes = simnet.callPublicFn(
      "proposal-submission",
      "propose",
      [Cl.stringAscii("Delegation Vote"), Cl.stringUtf8("Desc"), Cl.none()],
      wallet2
    );
    expect(proposeRes.result).toBeOk(Cl.uint(1));

    simnet.mineEmptyBlocks(144);

    const activateRes = simnet.callPublicFn(
      "proposal-submission",
      "activate-proposal",
      [Cl.uint(1)],
      wallet2
    );
    expect(activateRes.result).toBeOk(Cl.bool(true));

    const expectedPowerRes = simnet.callReadOnlyFn(
      "governance-token",
      "get-voting-power",
      [Cl.principal(wallet2)],
      wallet2
    );
    const expectedPower = unwrapResponseOkUint(expectedPowerRes.result);

    const voteRes = simnet.callPublicFn(
      "proposal-voting",
      "vote",
      [Cl.uint(1), Cl.uint(1)],
      wallet2
    );
    expect(voteRes.result).toBeOk(Cl.bool(true));

    const votesRes = simnet.callReadOnlyFn(
      "proposal-voting",
      "get-proposal-votes",
      [Cl.uint(1)],
      wallet2
    );
    expect(getTupleUint(votesRes.result, "votes-for")).toBe(expectedPower);

    const snapshotRes = simnet.callReadOnlyFn(
      "governance-token",
      "get-snapshot-power",
      [Cl.principal(wallet2), Cl.uint(1)],
      wallet2
    );
    if (!isClarityType(snapshotRes.result, ClarityType.OptionalSome)) {
      throw new Error("expected snapshot power");
    }
    if (!isClarityType(snapshotRes.result.value, ClarityType.UInt)) {
      throw new Error("expected uint snapshot power");
    }
    expect(snapshotRes.result.value.value).toBe(expectedPower);
  });

  it("keeps vote weight fixed after post-vote transfers", () => {
    const enableRes = simnet.callPublicFn(
      "dao-core",
      "set-extension",
      [Cl.contractPrincipal(deployer, "proposal-voting"), Cl.bool(true)],
      deployer
    );
    expect(enableRes.result).toBeOk(Cl.bool(true));

    const proposeRes = simnet.callPublicFn(
      "proposal-submission",
      "propose",
      [Cl.stringAscii("Transfer Invariant"), Cl.stringUtf8("Desc"), Cl.none()],
      wallet1
    );
    expect(proposeRes.result).toBeOk(Cl.uint(1));

    simnet.mineEmptyBlocks(144);

    const activateRes = simnet.callPublicFn(
      "proposal-submission",
      "activate-proposal",
      [Cl.uint(1)],
      wallet1
    );
    expect(activateRes.result).toBeOk(Cl.bool(true));

    const voteRes = simnet.callPublicFn(
      "proposal-voting",
      "vote",
      [Cl.uint(1), Cl.uint(1)],
      wallet1
    );
    expect(voteRes.result).toBeOk(Cl.bool(true));

    const votesBefore = simnet.callReadOnlyFn(
      "proposal-voting",
      "get-proposal-votes",
      [Cl.uint(1)],
      wallet1
    );
    const votesForBefore = getTupleUint(votesBefore.result, "votes-for");

    const transferRes = simnet.transferSTX(2_000_000n, wallet1, wallet2);
    expect(transferRes.result).toBeOk(Cl.bool(true));

    const votesAfter = simnet.callReadOnlyFn(
      "proposal-voting",
      "get-proposal-votes",
      [Cl.uint(1)],
      wallet1
    );
    const votesForAfter = getTupleUint(votesAfter.result, "votes-for");
    expect(votesForAfter).toBe(votesForBefore);

    const voterRecordRes = simnet.callReadOnlyFn(
      "proposal-voting",
      "get-voter-record",
      [Cl.uint(1), Cl.principal(wallet1)],
      wallet1
    );
    if (!isClarityType(voterRecordRes.result, ClarityType.OptionalSome)) {
      throw new Error("expected voter record");
    }
    const recordedPower = getTupleUint(voterRecordRes.result.value, "power");
    expect(recordedPower).toBe(votesForBefore);

    const snapshotRes = simnet.callReadOnlyFn(
      "governance-token",
      "get-snapshot-power",
      [Cl.principal(wallet1), Cl.uint(1)],
      wallet1
    );
    if (!isClarityType(snapshotRes.result, ClarityType.OptionalSome)) {
      throw new Error("expected snapshot power");
    }
    if (!isClarityType(snapshotRes.result.value, ClarityType.UInt)) {
      throw new Error("expected uint snapshot power");
    }
    expect(snapshotRes.result.value.value).toBe(votesForBefore);
  });
});
