import { createHash } from 'crypto';
import { insertArticle } from '~/server/utils/db';

export default defineEventHandler(async (event) => {
  try {
    const body = await readBody(event);
    
    // 验证请求体
    if (!body || typeof body !== 'object') {
      throw createError({
        statusCode: 400,
        statusMessage: 'Invalid request body'
      });
    }
    
    // 验证必要字段
    const requiredFields = ['website_name', 'news_headlines', 'news_sources', 'news_link', 'release_date', 'news_content'];
    for (const field of requiredFields) {
      if (!body[field]) {
        throw createError({
          statusCode: 400,
          statusMessage: `Missing required field: ${field}`
        });
      }
    }
    
    // 计算article_sn（如果未提供）
    let article_sn = body.article_sn;
    if (!article_sn && body.news_link) {
      article_sn = createHash('md5').update(body.news_link).digest('hex');
    }
    
    // 准备保存的数据
    const articleData = {
      article_sn,
      website_name: body.website_name,
      news_headlines: body.news_headlines,
      news_sources: body.news_sources,
      news_link: body.news_link,
      release_date: body.release_date,
      news_content: body.news_content
    };
    
    // 保存到MySQL数据库
    const result = await insertArticle(articleData);
    
    if (!result.success) {
      throw createError({
        statusCode: 500,
        statusMessage: result.message || 'Failed to save article to database'
      });
    }
    
    console.log(`Article saved to MySQL: ${article_sn}, ${result.message}`);
    
    return {
      success: true,
      message: result.message || 'Article saved successfully to database',
      article_sn: result.article_sn
    };
    
  } catch (error: any) {
    console.error('Error saving article:', error);
    
    return createError({
      statusCode: error.statusCode || 500,
      statusMessage: error.message || 'Internal server error'
    });
  }
});

