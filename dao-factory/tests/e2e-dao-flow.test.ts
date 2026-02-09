/**
 * End-to-End DAO Creation Flow Test
 * 
 * Tests the complete DAO lifecycle:
 * 1. Register DAO in factory
 * 2. Initialize DAO core
 * 3. Enable governance extensions
 * 4. Mint governance tokens
 * 5. Create proposal
 * 6. Vote on proposal
 * 7. Conclude proposal
 * 8. Treasury operations
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
    Cl,
    ClarityType,
    cvToValue,
    isClarityType,
} from "@stacks/transactions";

describe("End-to-End DAO Creation Flow", () => {
    const accounts = simnet.getAccounts();
    const deployer = accounts.get("deployer")!;
    const alice = accounts.get("wallet_1")!;
    const bob = accounts.get("wallet_2")!;

    /**
     * Phase 1: DAO Registration
     * Register a new DAO in the factory
     */
    describe("Phase 1: DAO Registration", () => {
        it("registers a new DAO in the factory", () => {
            const result = simnet.callPublicFn(
                "dao-factory",
                "register-dao",
                [
                    Cl.stringAscii("TestDAO"),
                    Cl.contractPrincipal(deployer, "dao-core"),
                    Cl.uint(1), // template-id
                ],
                deployer
            );

            expect(result.result).toBeOk(Cl.uint(1));
        });

        it("retrieves registered DAO info", () => {
            // Register first
            simnet.callPublicFn(
                "dao-factory",
                "register-dao",
                [
                    Cl.stringAscii("MyDAO"),
                    Cl.contractPrincipal(deployer, "dao-core"),
                    Cl.uint(1),
                ],
                deployer
            );

            // Get info
            const result = simnet.callReadOnlyFn(
                "dao-factory",
                "get-dao-by-name",
                [Cl.stringAscii("MyDAO")],
                deployer
            );

            expect(result.result).not.toBeNone();
            if (isClarityType(result.result, ClarityType.OptionalSome)) {
                const daoInfo = cvToValue(result.result.value) as any;
                // cvToValue returns { type, value } for string-ascii
                const name = daoInfo.name?.value ?? daoInfo.name;
                expect(name).toBe("MyDAO");
            }
        });

        it("prevents duplicate DAO names", () => {
            simnet.callPublicFn(
                "dao-factory",
                "register-dao",
                [
                    Cl.stringAscii("UniqueDAO"),
                    Cl.contractPrincipal(deployer, "dao-core"),
                    Cl.uint(1),
                ],
                deployer
            );

            const duplicateResult = simnet.callPublicFn(
                "dao-factory",
                "register-dao",
                [
                    Cl.stringAscii("UniqueDAO"),
                    Cl.contractPrincipal(deployer, "dao-core"),
                    Cl.uint(1),
                ],
                alice
            );

            expect(duplicateResult.result).toBeErr(Cl.uint(9001)); // ERR-DAO-EXISTS
        });
    });

    /**
     * Phase 2: DAO Initialization
     * Initialize the DAO core with name and description
     */
    describe("Phase 2: DAO Initialization", () => {
        it("initializes the DAO with name and description", () => {
            const result = simnet.callPublicFn(
                "dao-core",
                "initialize",
                [
                    Cl.stringAscii("Community DAO"),
                    Cl.stringUtf8("A DAO for community governance"),
                ],
                deployer
            );

            expect(result.result).toBeOk(Cl.bool(true));
        });

        it("prevents re-initialization", () => {
            // Initialize
            simnet.callPublicFn(
                "dao-core",
                "initialize",
                [Cl.stringAscii("DAO1"), Cl.stringUtf8("First init")],
                deployer
            );

            // Try again
            const result = simnet.callPublicFn(
                "dao-core",
                "initialize",
                [Cl.stringAscii("DAO2"), Cl.stringUtf8("Second init")],
                deployer
            );

            expect(result.result).toBeErr(Cl.uint(1004)); // ERR-ALREADY-INITIALIZED
        });

        it("reads DAO metadata after initialization", () => {
            simnet.callPublicFn(
                "dao-core",
                "initialize",
                [Cl.stringAscii("MetaDAO"), Cl.stringUtf8("Testing metadata")],
                deployer
            );

            const nameResult = simnet.callReadOnlyFn(
                "dao-core",
                "get-dao-name",
                [],
                deployer
            );

            const name = cvToValue(nameResult.result) as string;
            expect(name).toBe("MetaDAO");
        });
    });

    /**
     * Phase 3: Extension Setup
     * Enable governance extensions
     */
    describe("Phase 3: Extension Setup", () => {
        it("enables proposal-voting extension", () => {
            const result = simnet.callPublicFn(
                "dao-core",
                "set-extension",
                [Cl.contractPrincipal(deployer, "proposal-voting"), Cl.bool(true)],
                deployer
            );

            expect(result.result).toBeOk(Cl.bool(true));
        });

        it("enables treasury extension", () => {
            const result = simnet.callPublicFn(
                "dao-core",
                "set-extension",
                [Cl.contractPrincipal(deployer, "treasury"), Cl.bool(true)],
                deployer
            );

            expect(result.result).toBeOk(Cl.bool(true));
        });

        it("enables multiple extensions at once", () => {
            const result = simnet.callPublicFn(
                "dao-core",
                "set-extensions",
                [
                    Cl.list([
                        Cl.tuple({
                            extension: Cl.contractPrincipal(deployer, "proposal-submission"),
                            enabled: Cl.bool(true),
                        }),
                        Cl.tuple({
                            extension: Cl.contractPrincipal(deployer, "membership"),
                            enabled: Cl.bool(true),
                        }),
                    ]),
                ],
                deployer
            );

            expect(result.result).toBeOk(expect.anything());
        });

        it("verifies extension is enabled", () => {
            simnet.callPublicFn(
                "dao-core",
                "set-extension",
                [Cl.contractPrincipal(deployer, "governance-token"), Cl.bool(true)],
                deployer
            );

            const result = simnet.callReadOnlyFn(
                "dao-core",
                "is-extension",
                [Cl.contractPrincipal(deployer, "governance-token")],
                deployer
            );

            expect(cvToValue(result.result)).toBe(true);
        });
    });

    /**
     * Phase 4: Governance Token Operations
     * Test voting power and delegation
     */
    describe("Phase 4: Governance Token Operations", () => {
        it("gets STX balance as voting power", () => {
            const result = simnet.callReadOnlyFn(
                "governance-token",
                "get-stx-balance",
                [Cl.principal(alice)],
                alice
            );

            const balance = cvToValue(result.result) as bigint;
            expect(balance).toBeGreaterThan(0n);
        });

        it("delegates voting power", () => {
            const result = simnet.callPublicFn(
                "governance-token",
                "delegate",
                [Cl.principal(bob), Cl.uint(1000000)], // 1 STX
                alice
            );

            expect(result.result).toBeOk(Cl.bool(true));
        });

        it("gets voting power after delegation", () => {
            // Delegate from alice to bob
            simnet.callPublicFn(
                "governance-token",
                "delegate",
                [Cl.principal(bob), Cl.uint(5000000)],
                alice
            );

            const alicePower = simnet.callReadOnlyFn(
                "governance-token",
                "get-voting-power",
                [Cl.principal(alice)],
                alice
            );

            const bobPower = simnet.callReadOnlyFn(
                "governance-token",
                "get-voting-power",
                [Cl.principal(bob)],
                bob
            );

            // Bob should have more power from delegation
            expect(alicePower.result).toBeOk(expect.anything());
            expect(bobPower.result).toBeOk(expect.anything());
        });
    });

    /**
     * Phase 5: Full Proposal Lifecycle
     * Create → Activate → Vote → Conclude
     */
    describe("Phase 5: Full Proposal Lifecycle", () => {
        beforeEach(() => {
            // Enable voting extension
            simnet.callPublicFn(
                "dao-core",
                "set-extension",
                [Cl.contractPrincipal(deployer, "proposal-voting"), Cl.bool(true)],
                deployer
            );
        });

        it("completes full proposal lifecycle", () => {
            // Step 1: Create proposal
            const proposeResult = simnet.callPublicFn(
                "proposal-submission",
                "propose",
                [
                    Cl.stringAscii("Upgrade Treasury"),
                    Cl.stringUtf8("Proposal to upgrade treasury management"),
                    Cl.none(),
                ],
                alice
            );
            expect(proposeResult.result).toBeOk(Cl.uint(1));

            // Step 2: Wait for proposal delay
            simnet.mineEmptyBlocks(144);

            // Step 3: Activate proposal
            const activateResult = simnet.callPublicFn(
                "proposal-submission",
                "activate-proposal",
                [Cl.uint(1)],
                alice
            );
            expect(activateResult.result).toBeOk(Cl.bool(true));

            // Step 4: Vote on proposal
            const voteResult = simnet.callPublicFn(
                "proposal-voting",
                "vote",
                [Cl.uint(1), Cl.uint(1)], // vote FOR
                alice
            );
            expect(voteResult.result).toBeOk(Cl.bool(true));

            // Step 5: Wait for voting period
            simnet.mineEmptyBlocks(1441);

            // Step 6: Conclude proposal
            const concludeResult = simnet.callPublicFn(
                "proposal-voting",
                "conclude",
                [Cl.uint(1)],
                alice
            );
            expect(concludeResult.result).toBeOk(expect.anything());

            // Step 7: Verify status updated
            const statusResult = simnet.callReadOnlyFn(
                "proposal-submission",
                "get-proposal-status",
                [Cl.uint(1)],
                alice
            );
            expect(statusResult.result).not.toBeNone();
        });

        it("rejects invalid vote option", () => {
            // Create and activate proposal
            simnet.callPublicFn(
                "proposal-submission",
                "propose",
                [Cl.stringAscii("Test"), Cl.stringUtf8("Test"), Cl.none()],
                alice
            );
            simnet.mineEmptyBlocks(144);
            simnet.callPublicFn("proposal-submission", "activate-proposal", [Cl.uint(1)], alice);

            // Try invalid vote
            const result = simnet.callPublicFn(
                "proposal-voting",
                "vote",
                [Cl.uint(1), Cl.uint(99)], // Invalid option
                alice
            );

            expect(result.result).toBeErr(Cl.uint(6008)); // ERR-INVALID-VOTE
        });
    });

    /**
     * Phase 6: Treasury Operations
     * Test deposit and spend tracking
     */
    describe("Phase 6: Treasury Operations", () => {
        it("queries treasury balance", () => {
            const result = simnet.callReadOnlyFn(
                "treasury",
                "get-stx-balance",
                [],
                deployer
            );
            // get-stx-balance returns uint directly, not a response
            const balance = cvToValue(result.result) as bigint;
            expect(balance).toBeGreaterThanOrEqual(0n);
        });

        it("checks if token is allowed", () => {
            // Use the correct function name: is-token-allowed
            const result = simnet.callReadOnlyFn(
                "treasury",
                "is-token-allowed",
                [Cl.contractPrincipal(deployer, "governance-token")],
                deployer
            );

            // Returns false by default (token not whitelisted)
            expect(cvToValue(result.result)).toBe(false);
        });
    });

    /**
     * Phase 7: Factory DAO Listings
     * Test factory read functions
     */
    describe("Phase 7: Factory DAO Listings", () => {
        it("gets DAO count", () => {
            // Register a DAO first
            simnet.callPublicFn(
                "dao-factory",
                "register-dao",
                [
                    Cl.stringAscii("CountTestDAO"),
                    Cl.contractPrincipal(deployer, "dao-core"),
                    Cl.uint(1),
                ],
                deployer
            );

            const result = simnet.callReadOnlyFn(
                "dao-factory",
                "get-dao-count",
                [],
                deployer
            );

            const count = cvToValue(result.result) as bigint;
            expect(count).toBeGreaterThanOrEqual(1n);
        });

        it("lists DAOs by deployer", () => {
            simnet.callPublicFn(
                "dao-factory",
                "register-dao",
                [
                    Cl.stringAscii("DeployerDAO1"),
                    Cl.contractPrincipal(deployer, "dao-core"),
                    Cl.uint(1),
                ],
                deployer
            );

            const result = simnet.callReadOnlyFn(
                "dao-factory",
                "get-daos-by-deployer",
                [Cl.principal(deployer)],
                deployer
            );

            const daoIds = cvToValue(result.result) as bigint[];
            expect(daoIds.length).toBeGreaterThanOrEqual(1);
        });

        it("checks name availability", () => {
            // Register a DAO
            simnet.callPublicFn(
                "dao-factory",
                "register-dao",
                [
                    Cl.stringAscii("TakenName"),
                    Cl.contractPrincipal(deployer, "dao-core"),
                    Cl.uint(1),
                ],
                deployer
            );

            const taken = simnet.callReadOnlyFn(
                "dao-factory",
                "is-name-available",
                [Cl.stringAscii("TakenName")],
                deployer
            );
            expect(cvToValue(taken.result)).toBe(false);

            const available = simnet.callReadOnlyFn(
                "dao-factory",
                "is-name-available",
                [Cl.stringAscii("AvailableName")],
                deployer
            );
            expect(cvToValue(available.result)).toBe(true);
        });
    });
});
