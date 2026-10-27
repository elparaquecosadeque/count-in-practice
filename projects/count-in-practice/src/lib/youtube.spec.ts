import { describe, expect, it } from 'vitest';
import { parseYouTubeId } from './youtube';

describe('parseYouTubeId', () => {
  it.each([
    'dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtube.com/watch?feature=share&v=dQw4w9WgXcQ&t=42',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://youtu.be/dQw4w9WgXcQ?si=abc',
    'https://www.youtube.com/embed/dQw4w9WgXcQ',
    'https://www.youtube.com/shorts/dQw4w9WgXcQ',
    'https://www.youtube.com/live/dQw4w9WgXcQ',
    '  https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ  ',
  ])('reads the id from %s', (input) => {
    expect(parseYouTubeId(input)).toBe('dQw4w9WgXcQ');
  });

  it.each(['', 'hello', 'https://vimeo.com/123456789', 'https://www.youtube.com/channel/UCabc'])('rejects %s', (input) => {
    expect(parseYouTubeId(input)).toBeNull();
  });
});
