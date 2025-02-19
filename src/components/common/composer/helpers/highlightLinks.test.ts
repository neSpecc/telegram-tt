import { highlightLinksAsMarkown } from './highlightLinks';

describe('highlightLinks', () => {
  it('should highlight links', () => {
    const text = 'Hello http://telegram.org/';
    const highlighted = highlightLinksAsMarkown(text);
    expect(highlighted).toBe('Hello [http://telegram.org/](http://telegram.org/)​');
  });

  it('should highlight several links', () => {
    const text = 'Hello http://telegram.org/ and https://t.me/';
    const highlighted = highlightLinksAsMarkown(text);
    expect(highlighted).toBe('Hello [http://telegram.org/](http://telegram.org/)​ and [https://t.me/](https://t.me/)​');
  });
});
