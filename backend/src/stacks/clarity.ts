import { ClarityType, cvToJSON, type ClarityValue } from '@stacks/transactions';

type PlainValue =
    | null
    | boolean
    | string
    | PlainValue[]
    | { [key: string]: PlainValue };

export function isClarityType<T extends ClarityType>(
    cv: ClarityValue,
    type: T
): cv is Extract<ClarityValue, { type: T }> {
    return cv.type === type;
}

export function unwrapResponseOk(cv: ClarityValue): ClarityValue {
    if (isClarityType(cv, ClarityType.ResponseOk)) {
        return cv.value;
    }
    if (isClarityType(cv, ClarityType.ResponseErr)) {
        throw new Error(`Clarity response (err): ${JSON.stringify(cvToJSON(cv))}`);
    }
    throw new Error(`Expected response, got: ${JSON.stringify(cvToJSON(cv))}`);
}

export function unwrapOptional(cv: ClarityValue): ClarityValue | null {
    if (isClarityType(cv, ClarityType.OptionalNone)) {
        return null;
    }
    if (isClarityType(cv, ClarityType.OptionalSome)) {
        return cv.value;
    }
    throw new Error(`Expected optional, got: ${JSON.stringify(cvToJSON(cv))}`);
}

export function expectTuple(cv: ClarityValue): Record<string, ClarityValue> {
    if (!isClarityType(cv, ClarityType.Tuple)) {
        throw new Error(`Expected tuple, got: ${JSON.stringify(cvToJSON(cv))}`);
    }
    return cv.data;
}

export function expectUintString(cv: ClarityValue): string {
    if (!isClarityType(cv, ClarityType.UInt)) {
        throw new Error(`Expected uint, got: ${JSON.stringify(cvToJSON(cv))}`);
    }
    return cv.value.toString();
}

export function expectString(cv: ClarityValue): string {
    if (isClarityType(cv, ClarityType.StringASCII) || isClarityType(cv, ClarityType.StringUTF8)) {
        return cv.data;
    }
    throw new Error(`Expected string, got: ${JSON.stringify(cvToJSON(cv))}`);
}

export function expectPrincipalString(cv: ClarityValue): string {
    if (isClarityType(cv, ClarityType.PrincipalStandard) || isClarityType(cv, ClarityType.PrincipalContract)) {
        const json = cvToJSON(cv) as unknown as { value?: unknown };
        if (typeof json?.value === 'string') {
            return json.value;
        }
    }
    throw new Error(`Expected principal, got: ${JSON.stringify(cvToJSON(cv))}`);
}

export function expectBool(cv: ClarityValue): boolean {
    if (isClarityType(cv, ClarityType.BoolTrue)) {
        return true;
    }
    if (isClarityType(cv, ClarityType.BoolFalse)) {
        return false;
    }
    throw new Error(`Expected bool, got: ${JSON.stringify(cvToJSON(cv))}`);
}

export function cvToPlain(cv: ClarityValue): PlainValue {
    switch (cv.type) {
        case ClarityType.BoolTrue:
            return true;
        case ClarityType.BoolFalse:
            return false;
        case ClarityType.UInt:
        case ClarityType.Int:
            return cv.value.toString();
        case ClarityType.StringASCII:
        case ClarityType.StringUTF8:
            return cv.data;
        case ClarityType.OptionalNone:
            return null;
        case ClarityType.OptionalSome:
            return cvToPlain(cv.value);
        case ClarityType.Tuple: {
            const out: Record<string, PlainValue> = {};
            for (const [k, v] of Object.entries(cv.data)) {
                out[k] = cvToPlain(v);
            }
            return out;
        }
        case ClarityType.List:
            return cv.list.map(cvToPlain);
        case ClarityType.PrincipalStandard:
        case ClarityType.PrincipalContract:
            return cvToJSON(cv).value as string;
        case ClarityType.ResponseOk:
        case ClarityType.ResponseErr:
            // Keep response shape explicit to avoid accidental "truthiness" bugs.
            return {
                ok: cv.type === ClarityType.ResponseOk ? 'true' : 'false',
                value: cvToPlain(cv.value),
            };
        case ClarityType.Buffer:
            return Buffer.from(cv.buffer).toString('hex');
        default:
            return cvToJSON(cv) as unknown as PlainValue;
    }
}
