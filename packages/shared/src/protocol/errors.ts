/**
 * Every error the server can return in an ack. Codes are part of the protocol;
 * the human-readable texts live here so both screens show the same wording.
 */
export const ERROR_MESSAGES = {
  // transport / generic
  VALIDATION: 'Invalid request data',
  FORBIDDEN: 'You are not allowed to do this',
  INTERNAL: 'Something went wrong on the server',
  // lobby
  NICKNAME_INVALID: 'Nickname must be 1 to 16 characters long',
  NICKNAME_TAKEN: 'This nickname is already taken',
  COLOR_TAKEN: 'This color is already taken',
  ROOM_FULL: 'The room already has 6 players',
  GAME_IN_PROGRESS: 'A game is in progress, please wait until it ends',
  ALREADY_JOINED: 'You have already joined',
  NOT_JOINED: 'Join the room first',
  // game
  NOT_YOUR_TURN: 'It is not your turn to do that',
  CARD_NOT_IN_HAND: 'You do not hold this card',
  CANNOT_BEAT: 'This card cannot beat that one',
  INVALID_TARGET: 'Pick an uncovered attack card to defend against',
  RANK_NOT_ON_TABLE: 'You can only add a card whose rank is already on the table',
  TABLE_LIMIT: 'The table is full',
  ILLEGAL_ACTION: 'This move is not allowed right now',
  NO_GAME: 'There is no game in progress',
  // host
  NOT_ENOUGH_PLAYERS: 'At least 2 players are needed to start',
  PLAYERS_OFFLINE: 'Some players are offline: remove them with ✕ or wait for them to return',
  NOT_FINISHED: 'The game is not finished yet',
} as const;

export type ErrorCode = keyof typeof ERROR_MESSAGES;

export function errorMessage(code: ErrorCode): string {
  return ERROR_MESSAGES[code];
}
