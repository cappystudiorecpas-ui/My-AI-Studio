import test from 'node:test';
import assert from 'node:assert/strict';
import {
  formatSrtTimestamp,
  parseSrtTimestamp,
  generateSrtContent,
  parseSrtContent,
  breakBurmeseLines
} from './subtitle';

test('formatSrtTimestamp formats seconds to SRT standard format', () => {
  assert.equal(formatSrtTimestamp(0), '00:00:00,000');
  assert.equal(formatSrtTimestamp(65.5), '00:01:05,500');
  assert.equal(formatSrtTimestamp(3661.123), '01:01:01,123');
});

test('parseSrtTimestamp parses HH:MM:SS,mmm string to seconds', () => {
  assert.equal(parseSrtTimestamp('00:00:00,000'), 0);
  assert.equal(parseSrtTimestamp('00:01:05,500'), 65.5);
  assert.equal(parseSrtTimestamp('01:01:01.123'), 3661.123);
});

test('generateSrtContent and parseSrtContent roundtrip properly', () => {
  const cues = [
    { id: 1, startTime: 1.0, endTime: 4.5, text: 'မင်္ဂလာပါ ဇာတ်ကားပြန်ပြောပြခြင်းဖြစ်ပါတယ်။' },
    { id: 2, startTime: 5.0, endTime: 8.2, text: 'အဓိကဇာတ်ကောင်သည် မြို့တော်သို့ ရောက်ရှိလာခဲ့သည်။' }
  ];

  const srt = generateSrtContent(cues);
  assert.ok(srt.includes('00:00:01,000 --> 00:00:04,500'));
  assert.ok(srt.includes('မင်္ဂလာပါ'));

  const parsed = parseSrtContent(srt);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0].text, 'မင်္ဂလာပါ ဇာတ်ကားပြန်ပြောပြခြင်းဖြစ်ပါတယ်။');
  assert.equal(parsed[0].startTime, 1.0);
  assert.equal(parsed[0].endTime, 4.5);
  assert.equal(parsed[1].startTime, 5.0);
  assert.equal(parsed[1].endTime, 8.2);
});

test('breakBurmeseLines splits long Burmese text cleanly at punctuation or spaces', () => {
  const shortText = 'မင်္ဂလာပါခင်ဗျာ။';
  assert.equal(breakBurmeseLines(shortText, 30), shortText);

  const longText = 'ရှေးခေတ်ကာလတစ်ခုတွင် ဧကရာဇ်မင်းသည် တိုင်းပြည်ကို အုပ်ချုပ်နေစဉ်၊ ရန်သူများက နယ်စပ်ကို ကျူးကျော်လာခဲ့ကြသည်။';
  const broken = breakBurmeseLines(longText, 40);
  assert.ok(broken.includes('\n'), 'Should contain line break');
  assert.ok(broken.length >= longText.length, 'Should preserve full text content');
});
