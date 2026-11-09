import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deduplicateLiveSubtitles,
  getActiveSubtitle,
  calculateNextAudioStartTime,
  LiveSubtitleItem,
} from './liveSync';

test('deduplicateLiveSubtitles ignores duplicates within window', () => {
  const existing: LiveSubtitleItem[] = [
    {
      id: '1',
      chineseText: '我们到了',
      burmeseText: 'ကျွန်ုပ်တို့ ရောက်ရှိလာပါပြီ',
      startTime: 2.0,
      endTime: 4.0,
      type: 'speech',
    },
  ];

  const duplicateItem: LiveSubtitleItem = {
    id: '2',
    chineseText: '我们到了',
    burmeseText: 'ကျွန်ုပ်တို့ ရောက်ရှိလာပါပြီ',
    startTime: 2.5,
    endTime: 4.5,
    type: 'speech',
  };

  const newItem: LiveSubtitleItem = {
    id: '3',
    chineseText: '前面很危险',
    burmeseText: 'ရှေ့တွင် အန္တရာယ်ရှိသည်',
    startTime: 6.0,
    endTime: 8.0,
    type: 'speech',
  };

  assert.equal(deduplicateLiveSubtitles(existing, duplicateItem), false);
  assert.equal(deduplicateLiveSubtitles(existing, newItem), true);
});

test('getActiveSubtitle returns correct subtitle for timestamp', () => {
  const subtitles: LiveSubtitleItem[] = [
    {
      id: '1',
      chineseText: '你好',
      burmeseText: 'မင်္ဂလာပါ',
      startTime: 1.0,
      endTime: 3.0,
      type: 'speech',
    },
    {
      id: '2',
      chineseText: '再见',
      burmeseText: 'နှုတ်ဆက်ပါတယ်',
      startTime: 5.0,
      endTime: 7.0,
      type: 'speech',
    },
  ];

  assert.equal(getActiveSubtitle(subtitles, 0.5), null);
  assert.equal(getActiveSubtitle(subtitles, 2.0)?.burmeseText, 'မင်္ဂလာပါ');
  assert.equal(getActiveSubtitle(subtitles, 6.0)?.burmeseText, 'နှုတ်ဆက်ပါတယ်');
});

test('calculateNextAudioStartTime schedules gapless non-overlapping audio', () => {
  const { startTime: start1, nextEndTime: end1 } = calculateNextAudioStartTime(0, 0, 3.0);
  assert.equal(start1, 0.05);
  assert.equal(end1, 3.05);

  // When second chunk arrives while first is playing at time 1.0s
  const { startTime: start2, nextEndTime: end2 } = calculateNextAudioStartTime(1.0, end1, 2.0);
  assert.equal(start2, 3.05);
  assert.equal(end2, 5.05);
});
