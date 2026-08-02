// DataHive 存储层 · 阿里云 OSS 客户端
// 大对象(正文快照/图片/媒体/导出包)存 OSS；前端读文件走"预签名 URL"，AK/SK 只留服务端。
// 凭据从环境变量读取(见 .env.example)，绝不硬编码，绝不下发前端。
import OSS from 'ali-oss';

// 服务端上传/读取用的客户端。ECS 与 OSS 同区时走内网 endpoint(免流量费)，
// 本地开发把 OSS_INTERNAL=false 以走公网 endpoint。
let opsClient: OSS | null = null;
// 仅用于生成预签名 URL 的客户端：必须用公网 endpoint，浏览器才可直读。
let publicClient: OSS | null = null;

function readEnv() {
  const { OSS_REGION, OSS_BUCKET, OSS_ACCESS_KEY_ID, OSS_ACCESS_KEY_SECRET } = process.env;
  if (!OSS_REGION || !OSS_BUCKET || !OSS_ACCESS_KEY_ID || !OSS_ACCESS_KEY_SECRET) {
    throw new Error('[storage/oss] 缺少 OSS_* 环境变量，请参考 .env.example 配置');
  }
  return {
    region: OSS_REGION,                 // 例：oss-cn-hangzhou
    bucket: OSS_BUCKET,                 // 例：datahive-hz
    accessKeyId: OSS_ACCESS_KEY_ID,
    accessKeySecret: OSS_ACCESS_KEY_SECRET,
  };
}

export function getOssClient(): OSS {
  if (!opsClient) {
    opsClient = new OSS({
      ...readEnv(),
      internal: process.env.OSS_INTERNAL !== 'false', // 默认走内网
      secure: true,
    });
  }
  return opsClient;
}

function getPublicClient(): OSS {
  if (!publicClient) {
    publicClient = new OSS({ ...readEnv(), internal: false, secure: true });
  }
  return publicClient;
}

// 上传大对象，返回 object key
export async function putObject(
  key: string,
  body: Buffer | string,
  opts?: { contentType?: string; disposition?: string },
): Promise<string> {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body);
  const headers: Record<string, string> = {};
  if (opts?.contentType) headers['Content-Type'] = opts.contentType;
  if (opts?.disposition) headers['Content-Disposition'] = opts.disposition;
  await getOssClient().put(key, buf, { headers } as any);
  return key;
}

// 生成带签名的临时访问 URL(默认 15 分钟)。前端凭此直读 OSS，不接触 AK/SK。
export function getSignedUrl(key: string, expiresSeconds = 900): string {
  return getPublicClient().signatureUrl(key, { expires: expiresSeconds });
}

export async function objectExists(key: string): Promise<boolean> {
  try {
    await getOssClient().head(key);
    return true;
  } catch (e: any) {
    if (e?.status === 404 || e?.code === 'NoSuchKey') return false;
    throw e;
  }
}
