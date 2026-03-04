import { describe, expect, it } from 'vitest';
import {
    buildDaoContracts,
    buildDaoContractsFromCoreContractId,
    inferDaoContractSetFromCoreContractName,
} from '../src/stacks/dao-contracts.js';

describe('dao-contracts', () => {
    it('defaults to v2-c4 contract suffixes', () => {
        const contracts = buildDaoContracts('ST1TEST');

        expect(contracts.core).toBe('ST1TEST.dao-core-v2-c4');
        expect(contracts.factory).toBe('ST1TEST.dao-factory-v2-c4');
        expect(contracts.voting).toBe('ST1TEST.proposal-voting-v2-c4');
    });

    it('infers legacy v2 set from core contract name', () => {
        const contracts = buildDaoContracts('ST1TEST', { coreContractName: 'dao-core-v2' });

        expect(contracts.core).toBe('ST1TEST.dao-core-v2');
        expect(contracts.factory).toBe('ST1TEST.dao-factory-v2');
        expect(contracts.treasury).toBe('ST1TEST.treasury-v2');
    });

    it('preserves v2-c4-v4 core alias and keeps v2-c4 for the rest', () => {
        const contracts = buildDaoContractsFromCoreContractId('ST1TEST.dao-core-v2-c4-v4');

        expect(contracts.core).toBe('ST1TEST.dao-core-v2-c4-v4');
        expect(contracts.factory).toBe('ST1TEST.dao-factory-v2-c4');
        expect(contracts.proposals).toBe('ST1TEST.proposal-submission-v2-c4');
    });

    it('detects contract set from either name or full contract id', () => {
        expect(inferDaoContractSetFromCoreContractName('dao-core-v2')).toBe('v2');
        expect(inferDaoContractSetFromCoreContractName('dao-core-v2-c4')).toBe('v2-c4');
        expect(inferDaoContractSetFromCoreContractName('ST1TEST.dao-core-v2-c4-v4')).toBe('v2-c4');
    });
});
