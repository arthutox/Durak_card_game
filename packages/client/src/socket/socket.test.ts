import { describe, expect, it } from 'vitest';
import { ackError, ackOk } from '@durak/shared';
import { awaitAck, awaitOutcome } from './socket';

describe('awaitAck', () => {
  it('passes a real ack through untouched', async () => {
    expect(await awaitAck(Promise.resolve(ackOk({ n: 1 })))).toEqual(ackOk({ n: 1 }));
    expect(await awaitAck(Promise.resolve(ackError('CANNOT_BEAT')))).toEqual(
      ackError('CANNOT_BEAT'),
    );
  });

  it('reports a timeout or dropped connection as NO_CONNECTION, not as a server error', async () => {
    const timedOut = Promise.reject(new Error('operation has timed out'));

    expect(await awaitAck(timedOut)).toEqual(ackError('NO_CONNECTION'));
  });
});

describe('awaitOutcome', () => {
  it('is null on success and the error code otherwise', async () => {
    expect(await awaitOutcome(Promise.resolve(ackOk({})))).toBeNull();
    expect(await awaitOutcome(Promise.resolve(ackError('NOT_JOINED')))).toBe('NOT_JOINED');
    expect(await awaitOutcome(Promise.reject(new Error('timeout')))).toBe('NO_CONNECTION');
  });
});
