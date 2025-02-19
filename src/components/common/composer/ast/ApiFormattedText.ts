export interface ApiFormattedText {
  text: string;
  entities?: ApiMessageEntity[];
}

export type ApiMessageEntity = ApiMessageEntityDefault | ApiMessageEntityPre | ApiMessageEntityTextUrl |
  ApiMessageEntityMentionName | ApiMessageEntityCustomEmoji | ApiMessageEntityBlockquote;

export enum ApiMessageEntityTypes {
  Bold = 'MessageEntityBold',
  Blockquote = 'MessageEntityBlockquote',
  BotCommand = 'MessageEntityBotCommand',
  Cashtag = 'MessageEntityCashtag',
  Code = 'MessageEntityCode',
  Email = 'MessageEntityEmail',
  Hashtag = 'MessageEntityHashtag',
  Italic = 'MessageEntityItalic',
  MentionName = 'MessageEntityMentionName',
  Mention = 'MessageEntityMention',
  Phone = 'MessageEntityPhone',
  Pre = 'MessageEntityPre',
  Strike = 'MessageEntityStrike',
  TextUrl = 'MessageEntityTextUrl',
  Url = 'MessageEntityUrl',
  Underline = 'MessageEntityUnderline',
  Spoiler = 'MessageEntitySpoiler',
  CustomEmoji = 'MessageEntityCustomEmoji',
  Unknown = 'MessageEntityUnknown',
}

export interface ApiMessageEntityDefault {
  type: Exclude<
  `${ApiMessageEntityTypes}`,
  `${ApiMessageEntityTypes.Pre}` | `${ApiMessageEntityTypes.TextUrl}` | `${ApiMessageEntityTypes.MentionName}` |
  `${ApiMessageEntityTypes.CustomEmoji}` | `${ApiMessageEntityTypes.Blockquote}`
  >;
  offset: number;
  length: number;
};

export interface ApiMessageEntityPre {
  type: ApiMessageEntityTypes.Pre;
  offset: number;
  length: number;
  language?: string;
};

export interface ApiMessageEntityTextUrl {
  type: ApiMessageEntityTypes.TextUrl;
  offset: number;
  length: number;
  url: string;
};

export interface ApiMessageEntityMentionName {
  type: ApiMessageEntityTypes.MentionName;
  offset: number;
  length: number;
  userId: string;
};

export interface ApiMessageEntityBlockquote {
  type: ApiMessageEntityTypes.Blockquote;
  offset: number;
  length: number;
  canCollapse?: boolean;
};

export interface ApiMessageEntityCustomEmoji {
  type: ApiMessageEntityTypes.CustomEmoji;
  offset: number;
  length: number;
  documentId: string;
};
