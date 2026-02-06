import { describe, it, expect } from "vitest";
import {
  Cl,
  ClarityType,
  cvToValue,
  isClarityType,
} from "@stacks/transactions";

describe("DAO bug fixes", () => {
  const accounts = simnet.getAccounts();
  const deployer = accounts.get("deployer")!;
  const wallet1 = accounts.get("wallet_1")!;
  const wallet2 = accounts.get("wallet_2")!;

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
});
