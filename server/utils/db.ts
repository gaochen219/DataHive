import mysql from 'mysql2/promise';

// 数据库配置（凭据从环境变量读取，切勿硬编码，参见 .env.example）
const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT) || 10,
  queueLimit: 0
};

// 创建连接池
let pool: mysql.Pool | null = null;

// 获取数据库连接池
function getPool(): mysql.Pool {
  if (!pool) {
    pool = mysql.createPool(dbConfig);
    console.log('MySQL连接池已创建');
  }
  return pool;
}

// 执行查询
export async function query(sql: string, params?: any[]): Promise<any> {
  const connection = await getPool().getConnection();
  try {
    const [results] = await connection.execute(sql, params);
    return results;
  } finally {
    connection.release();
  }
}

// 检查表是否存在，如果不存在则创建
export async function ensureTableExists(): Promise<void> {
  try {
    // 检查wx_article表是否存在
    const checkTableSql = `
      SELECT COUNT(*) as count 
      FROM information_schema.tables 
      WHERE table_schema = ? AND table_name = 'wx_article'
    `;
    
    const result = await query(checkTableSql, [dbConfig.database]);
    
    if (result[0].count === 0) {
      // 创建wx_article表（按照用户提供的结构）
      const createTableSql = `
        CREATE TABLE wx_article (
          article_sn VARCHAR(200) NOT NULL COMMENT '文章序列号',
          website_name VARCHAR(100) NOT NULL COMMENT '网站名称',
          news_headlines VARCHAR(200) NOT NULL COMMENT '新闻标题',
          news_category VARCHAR(100) DEFAULT NULL COMMENT '新闻类别',
          domain VARCHAR(100) DEFAULT NULL COMMENT 'domain类别',
          news_tags VARCHAR(1000) DEFAULT NULL COMMENT '新闻标签',
          news_summary VARCHAR(2000) DEFAULT NULL COMMENT '新闻摘要',
          news_sources VARCHAR(100) DEFAULT NULL COMMENT '新闻来源',
          viewing_quantity INT(11) DEFAULT NULL COMMENT '浏览量',
          review_quantity INT(11) DEFAULT NULL COMMENT '评论数量',
          collection_volume INT(11) DEFAULT NULL COMMENT '收藏量',
          news_link VARCHAR(3000) NOT NULL COMMENT '新闻网址',
          release_date TIMESTAMP NOT NULL COMMENT '发布时间',
          news_content MEDIUMTEXT NOT NULL COMMENT '新闻正文',
          image_link TEXT COMMENT '图片链接',
          video_link TEXT COMMENT '视频链接',
          custom_json TEXT COMMENT '自定义JSON',
          created_dt TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
          updated_dt TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP COMMENT '更新时间',
          PRIMARY KEY (article_sn),
          KEY idx_rpa_article_release_date (release_date)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='原始新闻'
      `;
      
      await query(createTableSql);
      console.log('wx_article表创建成功（按照用户提供的结构）');
    } else {
      console.log('wx_article表已存在');
      // 检查表的字符集，如果不是utf8mb4，则修改
      await checkAndFixTableCharset();
    }
  } catch (error) {
    console.error('检查/创建表失败:', error);
    throw error;
  }
}

// 清理文本中的4字节UTF-8字符（emoji等）
function cleanText(text: string): string {
  if (!text) return text;
  
  // 方法1: 移除所有4字节UTF-8字符
  // return text.replace(/[\u{10000}-\u{10FFFF}]/gu, '');
  
  // 方法2: 替换为占位符（保留位置信息）
  return text.replace(/[\u{10000}-\u{10FFFF}]/gu, '[emoji]');
}

// 插入文章数据
export async function insertArticle(articleData: {
  article_sn: string;
  website_name: string;
  news_headlines: string;
  news_sources: string;
  news_link: string;
  release_date: string;
  news_content: string;
}): Promise<{ success: boolean; article_sn?: string; message?: string }> {
  try {
    // 确保表存在
    await ensureTableExists();
    
    // 清理文本内容，移除或替换4字节UTF-8字符
    const cleanedNewsContent = cleanText(articleData.news_content);
    const cleanedNewsHeadlines = cleanText(articleData.news_headlines);
    const cleanedNewsSources = cleanText(articleData.news_sources);
    const cleanedWebsiteName = cleanText(articleData.website_name);
    
    // 检查文章是否已存在
    const checkSql = 'SELECT article_sn FROM wx_article WHERE article_sn = ?';
    const existing = await query(checkSql, [articleData.article_sn]);
    
    if (existing.length > 0) {
      // 文章已存在，更新内容
      const updateSql = `
        UPDATE wx_article 
        SET website_name = ?, news_headlines = ?, news_sources = ?, 
            news_link = ?, release_date = ?, news_content = ?, updated_dt = CURRENT_TIMESTAMP
        WHERE article_sn = ?
      `;
      
      await query(updateSql, [
        cleanedWebsiteName,
        cleanedNewsHeadlines,
        cleanedNewsSources,
        articleData.news_link,
        articleData.release_date,
        cleanedNewsContent,
        articleData.article_sn
      ]);
      
      return {
        success: true,
        article_sn: articleData.article_sn,
        message: '文章已更新'
      };
    } else {
      // 插入新文章
      const insertSql = `
        INSERT INTO wx_article 
        (article_sn, website_name, news_headlines, news_sources, news_link, release_date, news_content)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `;
      
      await query(insertSql, [
        articleData.article_sn,
        cleanedWebsiteName,
        cleanedNewsHeadlines,
        cleanedNewsSources,
        articleData.news_link,
        articleData.release_date,
        cleanedNewsContent
      ]);
      
      return {
        success: true,
        article_sn: articleData.article_sn,
        message: '文章已插入'
      };
    }
  } catch (error: any) {
    console.error('插入文章失败:', error);
    return {
      success: false,
      message: error.message || '数据库操作失败'
    };
  }
}

// 检查并修复表的字符集
async function checkAndFixTableCharset(): Promise<void> {
  try {
    // 检查表的字符集
    const checkCharsetSql = `
      SELECT TABLE_COLLATION 
      FROM information_schema.TABLES 
      WHERE TABLE_SCHEMA = ? AND TABLE_NAME = 'wx_article'
    `;
    
    const result = await query(checkCharsetSql, [dbConfig.database]);
    
    if (result.length > 0) {
      const tableCollation = result[0].TABLE_COLLATION;
      console.log(`当前表字符集: ${tableCollation}`);
      
      // 如果不是utf8mb4，则修改表字符集
      if (!tableCollation?.includes('utf8mb4')) {
        console.log('表字符集不是utf8mb4，开始修改...');
        
        // 修改表字符集
        const alterTableSql = `
          ALTER TABLE wx_article 
          CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci
        `;
        
        await query(alterTableSql);
        console.log('表字符集已修改为utf8mb4');
      } else {
        console.log('表字符集已经是utf8mb4，无需修改');
      }
    }
  } catch (error) {
    console.error('检查/修复表字符集失败:', error);
    // 不抛出错误，避免影响主要功能
  }
}

// 关闭连接池
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('MySQL连接池已关闭');
  }
}
