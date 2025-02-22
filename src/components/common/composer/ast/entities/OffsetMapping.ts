export interface OffsetMappingRecord {
  htmlStart: number;
  htmlEnd: number;
  mdStart: number;
  mdEnd: number;
  nodeType: string;
  raw: string;
  nodeId: string | undefined;
}

export type OffsetMapping = OffsetMappingRecord[];
