// 采集内核 · 类型定义
// 所有数据源都实现 SourceAdapter，产出统一的 RawItem，交给 core 归一化入库。

export interface RawMedia {
  type: 'image' | 'video' | 'audio' | 'css';
  url: string;
}

// 一条采集到的原始内容(适配器产出的统一中间格式)
export interface RawItem {
  url: string;
  title: string;
  author?: string | null;
  publishedAt?: Date | null;
  summary?: string | null;
  category?: string | null;
  tags?: string | null;
  lang?: string | null;
  html?: string | null; // 正文 HTML 快照 → 存 OSS
  text?: string | null; // 纯文本正文
  metrics?: { read?: number; like?: number; share?: number; comment?: number };
  media?: RawMedia[];
  raw?: any; // 原始载荷备查
}

// 监控源配置(对应 DB source 表一行)
export interface SourceConfig {
  source_type: string;
  source_id?: string | null;
  name?: string | null;
  sync_cursor?: string | null;
  config?: Record<string, any> | null;
}

// 数据源适配器接口：每个来源(微信/网页/RSS/电商...)实现一个
export interface SourceAdapter {
  readonly type: string;
  // 拉取源下的条目(增量)。可返回数组，或异步迭代器(大源走流式，边拉边存)。
  fetchList(source: SourceConfig, since?: Date | null): Promise<RawItem[]> | AsyncIterable<RawItem>;
  // 可选：当 fetchList 只给列表元数据时，用它补全单条正文/资源。
  fetchDetail?(item: RawItem, source: SourceConfig): Promise<RawItem>;
}
