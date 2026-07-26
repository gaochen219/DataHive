-- DataHive 多源内容聚合 · 数据库结构
-- 设计原则：RDS 只存"可查询的元数据"，正文/图片/媒体等大对象存 OSS，
-- content_item.content_oss_key 指向 OSS 对象。去重用 content_sn 唯一键 + 真 upsert。
-- 字符集统一 utf8mb4。执行：mysql -h <RDS内网地址> -u datahive_rw -p datahive < db/schema.sql

SET NAMES utf8mb4;

-- ── 内容主表：能查的都在这 ──────────────────────────────
CREATE TABLE IF NOT EXISTS content_item (
  id              BIGINT       PRIMARY KEY AUTO_INCREMENT,
  content_sn      VARCHAR(64)  NOT NULL COMMENT '去重键=hash(source_type::url)',
  source_type     VARCHAR(32)  NOT NULL COMMENT 'wechat/web/rss/...',
  source_id       VARCHAR(128) DEFAULT NULL COMMENT '公众号fakeid/站点id',
  source_name     VARCHAR(128) DEFAULT NULL,
  title           VARCHAR(512) NOT NULL,
  author          VARCHAR(128) DEFAULT NULL,
  url             VARCHAR(1024) NOT NULL,
  published_at    DATETIME     DEFAULT NULL,
  summary         TEXT         DEFAULT NULL,
  category        VARCHAR(64)  DEFAULT NULL,
  tags            VARCHAR(512) DEFAULT NULL,
  lang            VARCHAR(16)  DEFAULT NULL,
  read_count      INT          DEFAULT NULL,
  like_count      INT          DEFAULT NULL,
  share_count     INT          DEFAULT NULL,
  comment_count   INT          DEFAULT NULL,
  content_oss_key VARCHAR(512) DEFAULT NULL COMMENT '正文HTML快照在OSS的key',
  content_text    MEDIUMTEXT   DEFAULT NULL COMMENT '纯文本正文(全文检索用,可空)',
  status          TINYINT      NOT NULL DEFAULT 1 COMMENT '1正常/0隐藏/-1删除',
  fetched_at      DATETIME     DEFAULT NULL,
  created_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_sn (content_sn),
  KEY idx_src (source_type, source_id, published_at),
  KEY idx_pub (published_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='内容主表';

-- ── 媒体资源表(1:N)：图片/音视频等，只存指向OSS的指针 ──────
CREATE TABLE IF NOT EXISTS content_asset (
  id          BIGINT       PRIMARY KEY AUTO_INCREMENT,
  content_id  BIGINT       NOT NULL,
  asset_type  VARCHAR(16)  DEFAULT NULL COMMENT 'image/video/audio/css',
  oss_key     VARCHAR(512) DEFAULT NULL,
  orig_url    VARCHAR(1024) DEFAULT NULL,
  bytes       BIGINT       DEFAULT NULL,
  created_at  DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_content (content_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='内容媒体资源';

-- ── 监控源配置表：管理"要盯哪些号/站点" ──────────────────
CREATE TABLE IF NOT EXISTS source (
  id             BIGINT       PRIMARY KEY AUTO_INCREMENT,
  source_type    VARCHAR(32)  NOT NULL,
  source_id      VARCHAR(128) DEFAULT NULL,
  name           VARCHAR(128) DEFAULT NULL,
  enabled        TINYINT      NOT NULL DEFAULT 1,
  sync_cursor    VARCHAR(128) DEFAULT NULL COMMENT '增量同步游标',
  last_synced_at DATETIME     DEFAULT NULL,
  config         JSON         DEFAULT NULL,
  created_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at     DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_src (source_type, source_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='监控源配置';
