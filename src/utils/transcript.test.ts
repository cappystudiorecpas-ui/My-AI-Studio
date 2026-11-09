import test from 'node:test';
import assert from 'node:assert/strict';
import {
  deduplicateTranscriptSegments,
  combineTranscriptAndOcr,
  SpeechSegment,
  OcrDetection
} from './transcript';

test('deduplicateTranscriptSegments merges overlapping duplicate chunks', () => {
  const segments: SpeechSegment[] = [
    { id: 1, start: 0.0, end: 3.0, text: '你好，欢迎来到电影解说' },
    { id: 2, start: 2.8, end: 5.5, text: '你好，欢迎来到电影解说，今天我们要讲' }, // duplicate overlap
    { id: 3, start: 6.0, end: 9.0, text: '这是一个关于友谊的故事' }
  ];

  const deduped = deduplicateTranscriptSegments(segments);
  assert.equal(deduped.length, 2);
  assert.equal(deduped[0].text, '你好，欢迎来到电影解说，今天我们要讲');
  assert.equal(deduped[0].end, 5.5);
  assert.equal(deduped[1].text, '这是一个关于友谊的故事');
});

test('combineTranscriptAndOcr creates chronological multimodal context', () => {
  const transcript: SpeechSegment[] = [
    { id: 1, start: 1.0, end: 4.0, text: '我们必须马上离开这里' }
  ];

  const ocr: OcrDetection[] = [
    { timestamp: 0.5, chineseText: '三年后' },
    { timestamp: 5.0, chineseText: '目标出现' }
  ];

  const { timeline, summaryContext } = combineTranscriptAndOcr(transcript, ocr);
  assert.equal(timeline.length, 3);
  assert.equal(timeline[0].text, '三年后');
  assert.equal(timeline[1].text, '我们必须马上离开这里');
  assert.equal(timeline[2].text, '目标出现');
  assert.ok(summaryContext.includes('စကားပြော'));
  assert.ok(summaryContext.includes('မျက်နှာပြင်စာတန်း'));
});
