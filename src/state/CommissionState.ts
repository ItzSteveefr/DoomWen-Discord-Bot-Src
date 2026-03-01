/**
 * Commission State Machine
 * 
 * OPEN -> QUOTE_SUBMITTED (freelancer submits quote)
 * QUOTE_SUBMITTED -> ACTIVE (customer accepts quote)
 * QUOTE_SUBMITTED -> OPEN (customer rejects quote)
 * ACTIVE -> PENDING_COMPLETION (freelancer marks complete)
 * PENDING_COMPLETION -> COMPLETED (customer confirms)
 * PENDING_COMPLETION -> ACTIVE (customer disputes)
 * Any -> CANCELLED (owner force override)
 */
export enum CommissionState {
    OPEN = 'OPEN',
    QUOTE_SUBMITTED = 'QUOTE_SUBMITTED',
    ACTIVE = 'ACTIVE',
    PENDING_COMPLETION = 'PENDING_COMPLETION',
    COMPLETED = 'COMPLETED',
    CANCELLED = 'CANCELLED'
}

/**
 * Valid state transitions for commissions
 */
export const COMMISSION_TRANSITIONS: Record<CommissionState, CommissionState[]> = {
    [CommissionState.OPEN]: [CommissionState.QUOTE_SUBMITTED, CommissionState.CANCELLED],
    [CommissionState.QUOTE_SUBMITTED]: [CommissionState.ACTIVE, CommissionState.OPEN, CommissionState.CANCELLED],
    [CommissionState.ACTIVE]: [CommissionState.PENDING_COMPLETION, CommissionState.CANCELLED],
    [CommissionState.PENDING_COMPLETION]: [CommissionState.COMPLETED, CommissionState.ACTIVE, CommissionState.CANCELLED],
    [CommissionState.COMPLETED]: [],
    [CommissionState.CANCELLED]: []
};

export function canTransitionCommission(from: CommissionState, to: CommissionState): boolean {
    return COMMISSION_TRANSITIONS[from].includes(to);
}

/**
 * States that block ticket closure (commission not finished)
 */
export const BLOCKING_COMMISSION_STATES: CommissionState[] = [
    CommissionState.OPEN,
    CommissionState.QUOTE_SUBMITTED,
    CommissionState.ACTIVE,
    CommissionState.PENDING_COMPLETION
];

export function isCommissionBlocking(state: CommissionState): boolean {
    return BLOCKING_COMMISSION_STATES.includes(state);
}

/**
 * States where a new quote can be submitted
 */
export function canSubmitQuote(state: CommissionState): boolean {
    return state === CommissionState.OPEN;
}

/**
 * States where the commission is actively being worked on
 */
export function isCommissionActive(state: CommissionState): boolean {
    return state === CommissionState.ACTIVE || state === CommissionState.PENDING_COMPLETION;
}
