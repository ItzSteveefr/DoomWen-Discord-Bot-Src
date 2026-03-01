/**
 * Ticket State Machine
 * 
 * OPEN -> PENDING_CLOSE (close requested)
 * OPEN -> CLOSED (force close by owner)
 * PENDING_CLOSE -> CLOSED (confirmed)
 * PENDING_CLOSE -> OPEN (cancelled)
 */
export enum TicketState {
    OPEN = 'OPEN',
    PENDING_CLOSE = 'PENDING_CLOSE',
    CLOSED = 'CLOSED'
}

/**
 * Valid state transitions for tickets
 */
export const TICKET_TRANSITIONS: Record<TicketState, TicketState[]> = {
    [TicketState.OPEN]: [TicketState.PENDING_CLOSE, TicketState.CLOSED],
    [TicketState.PENDING_CLOSE]: [TicketState.CLOSED, TicketState.OPEN],
    [TicketState.CLOSED]: []
};

export function canTransitionTicket(from: TicketState, to: TicketState): boolean {
    return TICKET_TRANSITIONS[from].includes(to);
}
