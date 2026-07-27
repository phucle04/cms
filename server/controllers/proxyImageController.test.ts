import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAllowedImageHost } from './proxyImageController';

/**
 * Test riêng hàm whitelist SSRF isAllowedImageHost() - đây là hàng rào bảo
 * mật DUY NHẤT của /api/proxy-image, nên phải test kỹ các kiểu bypass phổ
 * biến (substring match sai, thiếu dấu chấm hậu tố, IP literal).
 */

test('isAllowedImageHost: cho phép domain TikTok CDN hợp lệ', () => {
  assert.equal(isAllowedImageHost('p16-common-sign.tiktokcdn-us.com'), true);
  assert.equal(isAllowedImageHost('p19.tiktokcdn.com'), true);
  assert.equal(isAllowedImageHost('www.tiktok.com'), true);
  assert.equal(isAllowedImageHost('tiktokcdn.com'), true);
});

test('isAllowedImageHost: cho phép domain Apify hợp lệ', () => {
  assert.equal(isAllowedImageHost('api.apify.com'), true);
  assert.equal(isAllowedImageHost('images.apifyusercontent.com'), true);
});

test('isAllowedImageHost: TỪ CHỐI domain giả dạng bằng substring (không có dấu chấm hậu tố)', () => {
  assert.equal(isAllowedImageHost('eviltiktokcdn.com'), false);
  assert.equal(isAllowedImageHost('notapify.com'), false);
  assert.equal(isAllowedImageHost('tiktokcdn.com.evil.com'), false);
  assert.equal(isAllowedImageHost('evil.com-tiktokcdn.com.attacker.net'), false);
});

test('isAllowedImageHost: TỪ CHỐI domain chèn hostname hợp lệ vào path/subdomain giả', () => {
  assert.equal(isAllowedImageHost('tiktokcdn.com.attacker.com'), false);
  assert.equal(isAllowedImageHost('attacker.com'), false);
});

test('isAllowedImageHost: TỪ CHỐI IP literal (SSRF tới mạng nội bộ/metadata)', () => {
  assert.equal(isAllowedImageHost('127.0.0.1'), false);
  assert.equal(isAllowedImageHost('169.254.169.254'), false);
  assert.equal(isAllowedImageHost('10.0.0.5'), false);
  assert.equal(isAllowedImageHost('192.168.1.1'), false);
  assert.equal(isAllowedImageHost('::1'), false);
});

test('isAllowedImageHost: TỪ CHỐI localhost và domain bất kỳ khác', () => {
  assert.equal(isAllowedImageHost('localhost'), false);
  assert.equal(isAllowedImageHost('example.com'), false);
});
