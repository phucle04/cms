import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import mongoose from 'mongoose';
import { withDbRetry } from './withDbRetry';

/**
 * Mock global.setTimeout để gọi callback NGAY LẬP TỨC thay vì chờ thật (mảng
 * backoff [2s,5s,10s,20s] cộng lại ~37s nếu chờ thật) - cùng kỹ thuật đã
 * dùng cho geminiVideoService.test.ts::withGeminiRetry.
 */
function mockInstantSetTimeout(): { delays: number[]; restore: () => void } {
  const delays: number[] = [];
  const original = globalThis.setTimeout;
  const fn = mock.method(
    globalThis,
    'setTimeout',
    ((cb: (...args: unknown[]) => void, ms?: number) => {
      delays.push(ms ?? 0);
      cb();
      return 0 as unknown as NodeJS.Timeout;
    }) as typeof setTimeout
  );
  return {
    delays,
    restore: () => {
      fn.mock.restore();
      globalThis.setTimeout = original;
    },
  };
}

test('withDbRetry: retry đúng khi gặp MongoNetworkError, thành công ở lần thử thứ 3', async () => {
  const { delays, restore } = mockInstantSetTimeout();
  try {
    let calls = 0;
    const fn = mock.fn(async () => {
      calls += 1;
      if (calls < 3) {
        throw new mongoose.mongo.MongoNetworkError('getaddrinfo ENOTFOUND (giả lập)');
      }
      return 'ok';
    });

    const result = await withDbRetry(fn, 'test-network-error');

    assert.equal(result, 'ok');
    assert.equal(calls, 3);
    assert.deepEqual(delays, [2000, 5000]);
  } finally {
    restore();
  }
});

test('withDbRetry: retry đúng khi gặp MongoServerSelectionError', async () => {
  const { restore } = mockInstantSetTimeout();
  try {
    let calls = 0;
    const fn = mock.fn(async () => {
      calls += 1;
      if (calls < 2) {
        throw new mongoose.mongo.MongoServerSelectionError('server selection timed out (giả lập)', {} as any);
      }
      return 'ok';
    });

    const result = await withDbRetry(fn, 'test-server-selection');
    assert.equal(result, 'ok');
    assert.equal(calls, 2);
  } finally {
    restore();
  }
});

test('withDbRetry: retry đúng khi gặp lỗi ETIMEDOUT/ECONNRESET (Node errno)', async () => {
  const { restore } = mockInstantSetTimeout();
  try {
    let calls = 0;
    const fn = mock.fn(async () => {
      calls += 1;
      if (calls < 2) {
        const err = new Error('connect ETIMEDOUT (giả lập)') as NodeJS.ErrnoException;
        err.code = 'ETIMEDOUT';
        throw err;
      }
      return 'ok';
    });

    const result = await withDbRetry(fn, 'test-etimedout');
    assert.equal(result, 'ok');
    assert.equal(calls, 2);
  } finally {
    restore();
  }
});

test('withDbRetry: KHÔNG retry lỗi logic (validation error), throw ngay', async () => {
  const { delays, restore } = mockInstantSetTimeout();
  try {
    let calls = 0;
    const fn = mock.fn(async () => {
      calls += 1;
      const err = new mongoose.Error.ValidationError();
      throw err;
    });

    await assert.rejects(() => withDbRetry(fn, 'test-validation'));
    assert.equal(calls, 1);
    assert.equal(delays.length, 0);
  } finally {
    restore();
  }
});

test('withDbRetry: KHÔNG retry lỗi duplicate key (code 11000), throw ngay', async () => {
  const { delays, restore } = mockInstantSetTimeout();
  try {
    let calls = 0;
    const fn = mock.fn(async () => {
      calls += 1;
      const err = new Error('E11000 duplicate key error') as Error & { code: number };
      err.code = 11000;
      throw err;
    });

    await assert.rejects(() => withDbRetry(fn, 'test-duplicate-key'), /duplicate key/);
    assert.equal(calls, 1);
    assert.equal(delays.length, 0);
  } finally {
    restore();
  }
});

test('withDbRetry: hết 4 lần retry (tổng 5 lần thử) thì throw lỗi cuối cùng', async () => {
  const { delays, restore } = mockInstantSetTimeout();
  try {
    let calls = 0;
    const fn = mock.fn(async () => {
      calls += 1;
      throw new mongoose.mongo.MongoNetworkError(`lỗi mạng lần ${calls} (giả lập)`);
    });

    await assert.rejects(() => withDbRetry(fn, 'test-exhausted'), /lỗi mạng lần 5/);
    assert.equal(calls, 5);
    assert.deepEqual(delays, [2000, 5000, 10000, 20000]);
  } finally {
    restore();
  }
});
