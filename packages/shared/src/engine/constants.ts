/** Cards each player holds after the deal and refills up to after each bout. */
export const HAND_SIZE = 6;

/** Max attack cards in a regular bout. */
export const BOUT_ATTACK_LIMIT = 6;

/** Max attack cards in the very first bout of a game (classic rule). */
export const FIRST_BOUT_ATTACK_LIMIT = 5;

/** Turn timer lengths the host can pick in the lobby, in seconds. No timer is the default. */
export const TURN_SECONDS_OPTIONS = [30, 60, 90] as const;
export type TurnSeconds = (typeof TURN_SECONDS_OPTIONS)[number];
