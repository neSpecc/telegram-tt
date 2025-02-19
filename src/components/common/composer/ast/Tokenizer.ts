import type { BlockToken } from './entities/Token';

import { BlockTokenizer } from './BlockTokenizer';
import { InlineTokenizer } from './InlineTokenizer';

export class Tokenizer {
  private blockTokenizer: BlockTokenizer;

  constructor(input: string, private readonly isRich: boolean = true) {
    this.blockTokenizer = new BlockTokenizer(input);
  }

  public tokenize(): BlockToken[] {
    const blocks = this.blockTokenizer.tokenize();

    for (const block of blocks) {
      const isPlainText = block.type === 'pre';
      const inlineTokens = new InlineTokenizer(block.content, this.isRich).tokenize(isPlainText);
      block.tokens = inlineTokens;
    }

    return blocks;
  }
}

export function tokenize(input: string, isRich: boolean = true): BlockToken[] {
  return new Tokenizer(input, isRich).tokenize();
}
