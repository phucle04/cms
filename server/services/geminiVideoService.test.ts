import { test, mock, type Mock } from 'node:test';
import assert from 'node:assert/strict';
import { ApiError } from '@google/genai';
import { withGeminiRetry, waitForFileActive } from './geminiVideoService';

/**
 * Test dùng mock, KHÔNG gọi mạng thật, KHÔNG chờ thời gian thật:
 * - withGeminiRetry: mock global.setTimeout để gọi callback NGAY LẬP TỨC
 *   thay vì chờ, đồng thời ghi lại ms được truyền vào để kiểm tra backoff.
 * - waitForFileActive: dùng tham số getFile được inject (dependency
 *   injection có sẵn trong geminiVideoService.ts) để mock hoàn toàn, cũng
 *   mock setTimeout để không phải chờ 3s x 40 lần thật (~2 phút).
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

// ============================================================
// withGeminiRetry
// ============================================================

test('withGeminiRetry: retry đúng với HTTP 429, thành công ở lần thử thứ 3', async () => {
  const { delays, restore } = mockInstantSetTimeout();
  try {
    let calls = 0;
    const fn = mock.fn(async () => {
      calls += 1;
      if (calls < 3) {
        throw new ApiError({ message: 'rate limited', status: 429 });
      }
      return 'ok';
    });

    const result = await withGeminiRetry(fn, 'test-429');

    assert.equal(result, 'ok');
    assert.equal(calls, 3);
    assert.equal(delays.length, 2); // chờ trước lần thử 2 và lần thử 3
  } finally {
    restore();
  }
});

test('withGeminiRetry: retry đúng với HTTP 503', async () => {
  const { restore } = mockInstantSetTimeout();
  try {
    let calls = 0;
    const fn = mock.fn(async () => {
      calls += 1;
      if (calls < 2) {
        throw new ApiError({ message: 'overloaded', status: 503 });
      }
      return 'ok';
    });

    const result = await withGeminiRetry(fn, 'test-503');
    assert.equal(result, 'ok');
    assert.equal(calls, 2);
  } finally {
    restore();
  }
});

test('withGeminiRetry: throw NGAY với HTTP 400, không retry', async () => {
  const { delays, restore } = mockInstantSetTimeout();
  try {
    let calls = 0;
    const fn = mock.fn(async () => {
      calls += 1;
      throw new ApiError({ message: 'bad request', status: 400 });
    });

    await assert.rejects(() => withGeminiRetry(fn, 'test-400'), /bad request/);
    assert.equal(calls, 1);
    assert.equal(delays.length, 0);
  } finally {
    restore();
  }
});

test('withGeminiRetry: throw NGAY với HTTP 401, không retry', async () => {
  const { restore } = mockInstantSetTimeout();
  try {
    let calls = 0;
    const fn = mock.fn(async () => {
      calls += 1;
      throw new ApiError({ message: 'unauthorized', status: 401 });
    });

    await assert.rejects(() => withGeminiRetry(fn, 'test-401'));
    assert.equal(calls, 1);
  } finally {
    restore();
  }
});

test('withGeminiRetry: lỗi không phải ApiError cũng throw ngay, không retry', async () => {
  const { restore } = mockInstantSetTimeout();
  try {
    let calls = 0;
    const fn = mock.fn(async () => {
      calls += 1;
      throw new TypeError('network down');
    });

    await assert.rejects(() => withGeminiRetry(fn, 'test-network'), /network down/);
    assert.equal(calls, 1);
  } finally {
    restore();
  }
});

test('withGeminiRetry: hết GEMINI_MAX_RETRIES lần (mặc định 5) thì throw lỗi cuối cùng', async () => {
  const { delays, restore } = mockInstantSetTimeout();
  try {
    let calls = 0;
    const fn = mock.fn(async () => {
      calls += 1;
      throw new ApiError({ message: `429 lần ${calls}`, status: 429 });
    });

    await assert.rejects(() => withGeminiRetry(fn, 'test-exhausted'), /429 lần 5/);
    assert.equal(calls, 5);
    assert.equal(delays.length, 4); // chờ giữa 5 lần thử = 4 lần chờ
  } finally {
    restore();
  }
});

test('withGeminiRetry: backoff đúng mảng cố định [5s,15s,30s,60s,90s] +-20% jitter', async () => {
  const { delays, restore } = mockInstantSetTimeout();
  try {
    let calls = 0;
    const fn = mock.fn(async () => {
      calls += 1;
      throw new ApiError({ message: 'always 503', status: 503 });
    });

    await assert.rejects(() => withGeminiRetry(fn, 'test-backoff'));

    const expectedBase = [5000, 15000, 30000, 60000];
    assert.equal(delays.length, expectedBase.length);
    delays.forEach((delay, i) => {
      const base = expectedBase[i];
      assert.ok(
        delay >= base * 0.8 && delay <= base * 1.2,
        `delay thứ ${i} = ${delay}ms phải nằm trong khoảng +-20% của ${base}ms`
      );
    });
  } finally {
    restore();
  }
});

// ============================================================
// waitForFileActive
// ============================================================

test('waitForFileActive: thoát đúng khi state=ACTIVE', async () => {
  const { restore } = mockInstantSetTimeout();
  try {
    let calls = 0;
    const getFile: Mock<(name: string) => Promise<{ state?: string }>> = mock.fn(async () => {
      calls += 1;
      if (calls < 3) return { state: 'PROCESSING' };
      return { state: 'ACTIVE' };
    });

    await waitForFileActive('files/abc', getFile);
    assert.equal(calls, 3);
  } finally {
    restore();
  }
});

test('waitForFileActive: throw khi state=FAILED', async () => {
  const { restore } = mockInstantSetTimeout();
  try {
    const getFile = mock.fn(async () => ({ state: 'FAILED' }));

    await assert.rejects(() => waitForFileActive('files/abc', getFile), /FAILED/);
    assert.equal(getFile.mock.callCount(), 1);
  } finally {
    restore();
  }
});

test('waitForFileActive: nuốt lỗi mạng tạm thời và thử lại, vẫn tính vào tổng số lần', async () => {
  const { restore } = mockInstantSetTimeout();
  try {
    let calls = 0;
    const getFile = mock.fn(async () => {
      calls += 1;
      if (calls < 4) throw new Error('ECONNRESET tạm thời');
      return { state: 'ACTIVE' };
    });

    await waitForFileActive('files/abc', getFile);
    assert.equal(calls, 4);
  } finally {
    restore();
  }
});

test('waitForFileActive: throw timeout sau đúng 40 lần poll nếu không bao giờ ACTIVE/FAILED', async () => {
  const { restore } = mockInstantSetTimeout();
  try {
    const getFile = mock.fn(async () => ({ state: 'PROCESSING' }));

    await assert.rejects(() => waitForFileActive('files/abc', getFile), /quá thời gian chờ/);
    assert.equal(getFile.mock.callCount(), 40);
  } finally {
    restore();
  }
});
