<script setup lang="ts">
import type {
  ColDef,
  FilterChangedEvent,
  GetRowIdParams,
  GridApi,
  GridOptions,
  GridReadyEvent,
  ICellRendererParams,
  SelectionChangedEvent,
  ValueFormatterParams,
  ValueGetterParams,
} from 'ag-grid-community';
import { AgGridVue } from 'ag-grid-vue3';
import { defu } from 'defu';
import type { PreviewArticle } from '#components';
import { durationToSeconds, formatItemShowType, formatTimeStamp, sleep } from '#shared/utils/helpers';
import { validateHTMLContent } from '#shared/utils/html';
import GridArticleActions from '~/components/grid/ArticleActions.vue';
import GridAlbum from '~/components/grid/Album.vue';
import GridCoverTooltip from '~/components/grid/CoverTooltip.vue';
import GridStatusBar from '~/components/grid/StatusBar.vue';
import AccountSelectorForArticle from '~/components/selector/AccountSelectorForArticle.vue';
import { isDev, websiteName } from '~/config';
import { sharedGridOptions } from '~/config/shared-grid-options';
import { articleDeleted, getArticleCache, updateArticleStatus } from '~/store/v2/article';
import { getCommentCache } from '~/store/v2/comment';
import { getHtmlCache } from '~/store/v2/html';
import { getInfoCache, getAllInfo, type MpAccount } from '~/store/v2/info';
import { getMetadataCache, type Metadata } from '~/store/v2/metadata';
import { db } from '~/store/v2/db';
import type { Preferences } from '~/types/preferences';
import type { AppMsgExWithFakeID } from '~/types/types';
import type { ArticleMetadata } from '~/utils/download/types';
import { createBooleanColumnFilterParams, createDateColumnFilterParams } from '~/utils/grid';
import { getDebugCache } from '~/store/v2/debug';
import { useToast } from '#imports';
import { Exporter } from '~/utils/download/Exporter';
import { getArticleList } from '~/apis';
import useLoginCheck from '~/composables/useLoginCheck';
import useSyncDeadline from '~/composables/useSyncDeadline';
import { hitCache } from '~/store/v2/article';
import LoginModal from '~/components/modal/Login.vue';

useHead({
  title: `文章下载 | ${websiteName}`,
});

// 获取所有公众号名称列表（用于下拉筛选）
const accountNames = ref<string[]>([]);

// 当前页面的数据模型
interface Article extends AppMsgExWithFakeID, Partial<ArticleMetadata> {
  /**
   * 公众号信息
   */
  account:MpAccount|undefined;

  /**
   * 文章内容是否已下载
   */
  contentDownload: boolean;

  /**
   * 留言内容是否已下载
   */
  commentDownload: boolean;
}

let globalRowData: Article[] = [];

// 使用计算属性创建列定义，这样当accountNames更新时列定义也会更新
const columnDefs = computed<ColDef[]>(() => [
  {
    headerName: 'ID',
    field: 'aid',
    cellDataType: 'text',
    filter: 'agTextColumnFilter',
    minWidth: 150,
    initialHide: true,
    cellClass: 'flex justify-center items-center font-mono',
  },
  {
    headerName: '链接',
    field: 'link',
    cellDataType: 'text',
    filter: 'agTextColumnFilter',
    minWidth: 150,
    initialHide: true,
    cellClass: 'font-mono',
  },
  {
    headerName: '公众号名称',
    field: 'account.nickname',
    cellDataType: 'text',
    filter: 'agSetColumnFilter',
    filterParams: {
      values: accountNames.value,
      valueFormatter: (params: any) => params.value || '未知公众号',
    },
    tooltipField: 'account.nickname',
    minWidth: 150,
  },
  {
    headerName: '标题',
    field: 'title',
    cellDataType: 'text',
    filter: 'agTextColumnFilter',
    tooltipField: 'title',
    minWidth: 200,
  },
  // {
  //   headerName: '封面',
  //   field: 'cover',
  //   sortable: false,
  //   filter: false,
  //   cellRenderer: (params: ICellRendererParams) => {
  //     return `<img alt="" src="${params.value}" style="height: 40px; width: 40px; object-fit: cover;" />`;
  //   },
  //   tooltipField: 'cover',
  //   tooltipComponent: GridCoverTooltip,
  //   minWidth: 80,
  //   hide: true,
  //   cellClass: 'flex justify-center items-center',
  // },
  // {
  //   headerName: '摘要',
  //   field: 'digest',
  //   cellDataType: 'text',
  //   filter: 'agTextColumnFilter',
  //   tooltipField: 'digest',
  //   minWidth: 200,
  //   initialHide: true,
  // },
  {
    headerName: '创建时间',
    field: 'create_time',
    valueFormatter: p => formatTimeStamp(p.value),
    filter: 'agDateColumnFilter',
    filterParams: createDateColumnFilterParams(),
    filterValueGetter: (params: ValueGetterParams) => {
      return new Date(params.getValue('create_time') * 1000);
    },
    minWidth: 180,
    initialHide: true,
    cellClass: 'flex justify-center items-center font-mono',
  },
  {
    headerName: '发布时间',
    field: 'update_time',
    valueFormatter: p => formatTimeStamp(p.value),
    filter: 'agDateColumnFilter',
    filterParams: createDateColumnFilterParams(),
    filterValueGetter: (params: ValueGetterParams) => {
      return new Date(params.getValue('update_time') * 1000);
    },
    minWidth: 180,
    cellClass: 'flex justify-center items-center font-mono',
  },
  // {
  //   headerName: '是否已删除',
  //   field: 'is_deleted',
  //   cellDataType: 'boolean',
  //   filter: 'agSetColumnFilter',
  //   filterParams: createBooleanColumnFilterParams('已删除', '未删除'),
  //   minWidth: 150,
  //   initialHide: true,
  //   cellClass: 'flex justify-center items-center',
  // },
  // {
  //   headerName: '文章状态',
  //   field: '_status',
  //   valueFormatter: p => p.value,
  //   filter: 'agSetColumnFilter',
  //   filterParams: {
  //     valueFormatter: (p: ValueFormatterParams) => p.value,
  //   },
  //   minWidth: 150,
  //   initialHide: true,
  //   cellClass: 'flex justify-center items-center',
  // },
  {
    headerName: '内容已下载',
    field: 'contentDownload',
    cellDataType: 'boolean',
    filter: 'agSetColumnFilter',
    filterParams: createBooleanColumnFilterParams('已下载', '未下载'),
    minWidth: 150,
    cellClass: 'flex justify-center items-center',
  },
  // {
  //   field: 'commentDownload',
  //   headerName: '留言已下载',
  //   cellDataType: 'boolean',
  //   filter: 'agSetColumnFilter',
  //   filterParams: createBooleanColumnFilterParams('已下载', '未下载'),
  //   minWidth: 150,
  //   cellClass: 'flex justify-center items-center',
  // },
  // {
  //   headerName: '阅读',
  //   field: 'readNum',
  //   cellDataType: 'number',
  //   filter: 'agNumberColumnFilter',
  //   minWidth: 100,
  //   cellClass: 'flex justify-center items-center font-mono',
  // },
  // {
  //   headerName: '点赞',
  //   field: 'oldLikeNum',
  //   cellDataType: 'number',
  //   filter: 'agNumberColumnFilter',
  //   minWidth: 100,
  //   cellClass: 'flex justify-center items-center font-mono',
  // },
  // {
  //   headerName: '分享',
  //   field: 'shareNum',
  //   cellDataType: 'number',
  //   filter: 'agNumberColumnFilter',
  //   minWidth: 100,
  //   cellClass: 'flex justify-center items-center font-mono',
  // },
  // {
  //   headerName: '喜欢',
  //   field: 'likeNum',
  //   cellDataType: 'number',
  //   filter: 'agNumberColumnFilter',
  //   minWidth: 100,
  //   cellClass: 'flex justify-center items-center font-mono',
  // },
  // {
  //   headerName: '留言',
  //   field: 'commentNum',
  //   cellDataType: 'number',
  //   filter: 'agNumberColumnFilter',
  //   minWidth: 100,
  //   cellClass: 'flex justify-center items-center font-mono',
  // },
  // {
  //   field: 'author_name',
  //   headerName: '作者',
  //   cellDataType: 'text',
  //   filter: 'agSetColumnFilter',
  //   minWidth: 150,
  //   cellClass: 'flex justify-center items-center',
  // },
  // {
  //   headerName: '是否原创',
  //   valueGetter: p => p.data && p.data.copyright_stat === 1 && p.data.copyright_type === 1,
  //   cellDataType: 'boolean',
  //   filter: 'agSetColumnFilter',
  //   filterParams: createBooleanColumnFilterParams('原创', '非原创'),
  //   minWidth: 150,
  //   cellClass: 'flex justify-center items-center',
  // },
  // {
  //   headerName: '文章类型',
  //   field: 'item_show_type',
  //   valueFormatter: p => formatItemShowType(p.value),
  //   filter: 'agSetColumnFilter',
  //   filterParams: {
  //     valueFormatter: (p: ValueFormatterParams) => formatItemShowType(p.value),
  //   },
  //   minWidth: 150,
  //   initialHide: true,
  //   cellClass: 'flex justify-center items-center',
  // },
  // {
  //   headerName: '媒体时长',
  //   field: 'media_duration',
  //   valueGetter: params => durationToSeconds(params.data.media_duration), // 用于排序和过滤
  //   valueFormatter: params => params.data.media_duration,
  //   filter: 'agNumberColumnFilter',
  //   comparator: (a, b) => a - b,
  //   minWidth: 150,
  //   initialHide: true,
  //   cellClass: 'flex justify-center items-center font-mono',
  // },
  // {
  //   headerName: '所属合集',
  //   field: 'appmsg_album_infos',
  //   cellRenderer: GridAlbum,
  //   sortable: false,
  //   filter: false,
  //   valueFormatter: p => p.value.map((album: any) => album.title).join(','),
  //   minWidth: 150,
  //   initialHide: true,
  // },
  {
    headerName: '操作',
    field: 'link',
    sortable: false,
    filter: false,
    cellRenderer: GridArticleActions,
    cellRendererParams: {
      onPreview: (params: ICellRendererParams) => {
        preview(params.data);
      },
      onGotoLink: (params: ICellRendererParams) => {
        window.open(params.value, '_blank');
      },
    },
    maxWidth: 100,
    pinned: 'right',
    cellClass: 'flex justify-center items-center',
  },
]);

// 注意，`defu`函数最左边的参数优先级最高
const gridOptions: GridOptions = defu(
  {
    getRowId: (params: GetRowIdParams) => `${params.data.fakeid}:${params.data.aid}`,
    statusBar: {
      statusPanels: [
        {
          statusPanel: GridStatusBar,
          align: 'left',
        },
      ],
    },
  },
  sharedGridOptions
);

const gridApi = shallowRef<GridApi | null>(null);
function onGridReady(params: GridReadyEvent) {
  gridApi.value = params.api;

  restoreColumnState();
}

function onColumnStateChange() {
  if (gridApi.value) {
    saveColumnState();
  }
}
function saveColumnState() {
  const state = gridApi.value?.getColumnState();
  localStorage.setItem('agGridColumnState', JSON.stringify(state));
}

function restoreColumnState() {
  const stateStr = localStorage.getItem('agGridColumnState');
  if (stateStr) {
    const state = JSON.parse(stateStr);
    gridApi.value?.applyColumnState({
      state,
      applyOrder: true,
    });
  }
}

function onFilterChanged(event: FilterChangedEvent) {
  event.api.deselectAll();
}

const preferences = usePreferences();
const hideDeleted = computed(() => (preferences.value as unknown as Preferences).hideDeleted);

const previewArticleRef = ref<typeof PreviewArticle | null>(null);

function preview(article: Article) {
  previewArticleRef.value!.open(article);
}

const loading = ref(false);

// 只能选择单个账号
const selectedAccount = ref<MpAccount | undefined>();

// 页面加载时默认显示所有公众号的文章
onMounted(async () => {
  // 加载公众号名称
  try {
    const accounts = await getAllInfo();
    const names = accounts
      .map(account => account.nickname)
      .filter((name): name is string => !!name && name.trim() !== '')
      .sort();
    
    const uniqueNames = [...new Set(names)];
    accountNames.value = uniqueNames.length > 0 ? uniqueNames : ['未知公众号'];
  } catch (error) {
    console.error('获取公众号名称列表失败:', error);
    accountNames.value = ['未知公众号'];
  }

  // 默认加载所有公众号的文章
  await loadAllArticles();
});

watch(selectedAccount, newVal => {
  if (newVal) {
    switchTableData(newVal.fakeid).catch(() => {});
  } else {
    // 如果清空选择，重新加载所有文章
    loadAllArticles().catch(() => {});
  }
});

// 加载单个公众号的文章
async function switchTableData(fakeid: string) {
  loading.value = true;
  const account = await getInfoCache(fakeid);
  const articles: Article[] = [];
  const data = await getArticleCache(fakeid, Date.now());
  
  // 获取当前的时间范围配置
  const syncDeadline = useSyncDeadline();
  const syncToTimestamp = syncDeadline.getSyncTimestamp();
  
  // 获取缓存时间配置
  const cacheTimestamp = getCacheTimestamp();
  
  // 只加载在时间范围内的文章（基于发布时间 update_time）
  // 需要同时满足同步时间范围和缓存时间范围
  const articlesInRange = data.filter(article => 
    article.update_time >= syncToTimestamp && 
    article.update_time >= cacheTimestamp
  );
  
  console.log(`公众号 ${account.nickname}: 加载文章，缓存 ${data.length} 篇，同步范围内 ${articlesInRange.length} 篇，缓存时间: ${cacheDuration.value}天`);
  
  for (const article of articlesInRange) {
    const contentDownload = (await getHtmlCache(article.link)) !== undefined;
    const commentDownload = (await getCommentCache(article.link)) !== undefined;
    const metadata = await getMetadataCache(article.link);
    if (metadata) {
      articles.push({
        ...metadata,
        ...article,
        account,
        contentDownload: contentDownload,
        commentDownload: commentDownload,
      });
    } else {
      articles.push({
        ...article,
        account,
        contentDownload: contentDownload,
        commentDownload: commentDownload,
      });
    }
  }
  await sleep(200);
  globalRowData = articles.filter(article => (hideDeleted.value ? !article.is_deleted : true));
  gridApi.value?.setGridOption('rowData', globalRowData);
  loading.value = false;
}

// 加载所有公众号的文章
async function loadAllArticles() {
  loading.value = true;
  const allAccounts = await getAllInfo();
  const allArticles: Article[] = [];
  
  // 获取当前的时间范围配置
  const syncDeadline = useSyncDeadline();
  const syncToTimestamp = syncDeadline.getSyncTimestamp();
  
  // 获取缓存时间配置
  const cacheTimestamp = getCacheTimestamp();
  
  console.log(`加载文章数据，同步时间范围: ${new Date(syncToTimestamp * 1000).toISOString().split('T')[0]} 之后，缓存时间: ${cacheDuration.value}天`);
  
  for (const account of allAccounts) {
    const data = await getArticleCache(account.fakeid, Date.now());
    
    // 只加载在时间范围内的文章（基于发布时间 update_time）
    // 需要同时满足同步时间范围和缓存时间范围
    const articlesInRange = data.filter(article => 
      article.update_time >= syncToTimestamp && 
      article.update_time >= cacheTimestamp
    );
    
    console.log(`公众号 ${account.nickname}: 缓存 ${data.length} 篇，同步范围内 ${articlesInRange.length} 篇`);
    
    for (const article of articlesInRange) {
      const contentDownload = (await getHtmlCache(article.link)) !== undefined;
      const commentDownload = (await getCommentCache(article.link)) !== undefined;
      const metadata = await getMetadataCache(article.link);
      if (metadata) {
        allArticles.push({
          ...metadata,
          ...article,
          account,
          contentDownload: contentDownload,
          commentDownload: commentDownload,
        });
      } else {
        allArticles.push({
          ...article,
          account,
          contentDownload: contentDownload,
          commentDownload: commentDownload,
        });
      }
    }
  }
  
  await sleep(200);
  globalRowData = allArticles.filter(article => (hideDeleted.value ? !article.is_deleted : true));
  
  console.log(`总共加载 ${allArticles.length} 篇文章在时间范围内`);
  
  if (gridApi.value) {
    gridApi.value.setGridOption('rowData', globalRowData);
  }
  loading.value = false;
}

function updateRow(article: Article) {
  const rowNode = gridApi.value?.getRowNode(`${article.fakeid}:${article.aid}`);
  if (rowNode) {
    rowNode.updateData(article);
  }
}

const selectedArticles = shallowRef<Article[]>([]);
function onSelectionChanged(event: SelectionChangedEvent) {
  selectedArticles.value = (event.selectedNodes || []).map(node => node.data);
}
const selectedArticleUrls = computed(() => {
  return selectedArticles.value.map(article => article.link);
});

const {
  loading: downloadBtnLoading,
  completed_count: downloadCompletedCount,
  total_count: downloadTotalCount,
  download,
  stop: stopDownload,
} = useDownloader({
  onContent(url: string) {
    const article = globalRowData.find(article => article.link === url);
    if (article) {
      article.contentDownload = true;
      article._status = '正常';
      updateRow(article);

      updateArticleStatus(url, '正常');

      // 修复之前代码逻辑错误导致的数据库状态被误设置为【已删除】
      article.is_deleted = false;
      articleDeleted(url, false);
    } else {
      console.warn(`${url} not found in table data when update contentDownload`);
    }
  },
  onStatusChange(url: string, status: string) {
    const article = globalRowData.find(article => article.link === url);
    if (article) {
      article._status = status;
      updateRow(article);

      updateArticleStatus(url, status);
    }
  },
  onDelete(url: string) {
    const article = globalRowData.find(article => article.link === url);
    if (article) {
      article.is_deleted = true;
      article._status = '已删除';
      updateRow(article);

      updateArticleStatus(url, '已删除');
      articleDeleted(url);
    }
  },
  onMetadata(url: string, metadata: Metadata) {
    const article = globalRowData.find(article => article.link === url);
    if (article) {
      article.readNum = metadata.readNum;
      article.oldLikeNum = metadata.oldLikeNum;
      article.shareNum = metadata.shareNum;
      article.likeNum = metadata.likeNum;
      article.commentNum = metadata.commentNum;

      if ((preferences.value as unknown as Preferences).downloadConfig.metadataOverrideContent) {
        // 如果同步下载文章内容，则更新相关字段
        article.contentDownload = true;
        article._status = '正常';
        updateArticleStatus(url, '正常');

        // 修复之前代码逻辑错误导致的数据库状态被误设置为【已删除】
        article.is_deleted = false;
        articleDeleted(url, false);
      }

      updateRow(article);
    } else {
      console.warn(`${url} not found in table data when update metadata`);
    }
  },
  onComment(url: string) {
    const article = globalRowData.find(article => article.link === url);
    if (article) {
      article.commentDownload = true;
      updateRow(article);
    } else {
      console.warn(`${url} not found in table data when update commentDownload`);
    }
  },
});

const {
  loading: exportBtnLoading,
  phase: exportPhase,
  completed_count: exportCompletedCount,
  total_count: exportTotalCount,
  exportFile,
} = useExporter();

async function debug() {
  const cache = await getDebugCache('https://mp.weixin.qq.com/s/0IEaqpJIBGykHFKqj-7xqw');
  console.log(cache);
  if (cache) {
    const html = await cache.file.text();
    console.log(html);
    const result = validateHTMLContent(html);
    console.log(result);
  }
}

const copied = ref(false);
function copyWechatLink() {
  const link = `https://mp.weixin.qq.com/mp/profile_ext?action=home&__biz=${selectedAccount.value?.fakeid}&scene=124#wechat_redirect`;
  navigator.clipboard.writeText(link);

  copied.value = true;
  setTimeout(() => {
    copied.value = false;
  }, 1000);
}

// 停止同步或下载
function stopSyncOrDownload() {
  if (downloadBtnLoading) {
    // 停止下载
    stopDownload();
    console.log('已停止下载');
    toast.add({
      title: '已停止',
      description: '下载已停止',
      color: 'orange',
      icon: 'i-heroicons-stop-circle-20-solid',
    });
  } else if (oneClickSyncLoading) {
    // 停止一键同步
    oneClickSyncLoading.value = false;
    console.log('已停止一键同步');
    toast.add({
      title: '已停止',
      description: '一键同步已停止',
      color: 'orange',
      icon: 'i-heroicons-stop-circle-20-solid',
    });
  }
}

// 缓存时间设置
const cacheDuration = ref(3); // 默认3天
const cleanupLoading = ref(false);
const cacheDurationOptions = [
  { label: '当天', value: 1 },
  { label: '三天', value: 3 },
  { label: '一周', value: 7 },
];

// 计算缓存时间戳（基于当前日期向前推算）
// 返回保留数据的最小时间戳（发布时间 >= 这个时间戳的会被保留）
function getCacheTimestamp(): number {
  // 获取当前日期（去掉时间部分）
  const now = new Date();
  const currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // 根据缓存天数计算目标日期
  // 用户逻辑：如果当前时间是27日，缓存时间为3天
  // 范围是25日00:00:00 到 27日23:59:59
  // 保留：发布时间 >= 25日00:00:00
  const days = cacheDuration.value;
  const targetDate = new Date(currentDate);
  
  // 对于"当天"（days=1）：保留今天00:00:00及之后的数据
  // 对于"三天"（days=3）：保留25日00:00:00及之后的数据（27日 - 2天 = 25日）
  // 对于"一周"（days=7）：保留21日00:00:00及之后的数据（27日 - 6天 = 21日）
  if (days > 0) {
    targetDate.setDate(targetDate.getDate() - (days - 1));
  }
  
  // 返回目标日期的00:00:00时间戳
  return Math.floor(targetDate.getTime() / 1000);
}

// 获取清理边界时间戳（用于清理逻辑）
// 返回清理数据的最大时间戳（发布时间 <= 这个时间戳的会被清理）
function getCleanupBoundaryTimestamp(): number {
  // 获取当前日期（去掉时间部分）
  const now = new Date();
  const currentDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  
  // 根据缓存天数计算目标日期
  // 用户逻辑：如果当前时间是28日，缓存时间为1天（当天）
  // 范围是28日00:00:00 到 28日23:59:59
  // 清理：发布时间 <= 27日23:59:59
  const days = cacheDuration.value;
  const targetDate = new Date(currentDate);
  
  // 对于"当天"（days=1）：清理昨天23:59:59及之前的数据
  // 对于"三天"（days=3）：清理25日23:59:59及之前的数据
  // 对于"一周"（days=7）：清理21日23:59:59及之前的数据
  if (days > 0) {
    // 先计算保留边界（目标日期的00:00:00）
    targetDate.setDate(targetDate.getDate() - (days - 1));
    // 然后减去1秒，得到清理边界（前一天的23:59:59）
    return Math.floor(targetDate.getTime() / 1000) - 1;
  }
  
  // 如果days=0（理论上不会发生），返回0
  return 0;
}

// 获取当前日期的开始时间戳（00:00:00）
function getTodayStartTimestamp(): number {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor(todayStart.getTime() / 1000);
}

// 获取日期描述
function getCacheDateDescription(): string {
  const cacheTimestamp = getCacheTimestamp();
  const date = new Date(cacheTimestamp * 1000);
  return date.toISOString().split('T')[0];
}

// 清理超出缓存时间的旧数据
async function cleanupOldCache() {
  cleanupLoading.value = true;
  
  try {
    // 调试：显示当前缓存时间设置
    console.log(`清理缓存：当前缓存时间设置 = ${cacheDuration.value}天`);
    console.log(`清理缓存：当前日期 = ${new Date().toISOString()}`);
    
    const cleanupTimestamp = getCleanupBoundaryTimestamp();
    // 获取清理边界日期（用于提示）- 使用本地时间格式
    const cleanupDate = new Date(cleanupTimestamp * 1000);
    const year = cleanupDate.getFullYear();
    const month = String(cleanupDate.getMonth() + 1).padStart(2, '0');
    const day = String(cleanupDate.getDate()).padStart(2, '0');
    const cleanupDateStr = `${year}-${month}-${day}`;
    
    console.log(`开始清理缓存，清理 ${cacheDuration.value} 天前的数据（发布时间 <= ${cleanupDateStr} 23:59:59）`);
    console.log(`清理边界时间戳: ${cleanupTimestamp}, 对应日期: ${cleanupDate.toISOString()}`);
    
    // 同时显示保留边界，用于对比
    const cacheTimestamp = getCacheTimestamp();
    const cacheDate = new Date(cacheTimestamp * 1000);
    console.log(`保留边界时间戳: ${cacheTimestamp}, 对应日期: ${cacheDate.toISOString()}`);
    console.log(`清理边界: <= ${cleanupDateStr} 23:59:59, 保留边界: >= ${cacheDate.toISOString().split('T')[0]} 00:00:00`);
    
    // 清理数据库中的旧数据
    await cleanupDatabaseCache(cleanupTimestamp);
    
    toast.add({
      title: '缓存清理完成',
      description: `已清理 ${cacheDuration.value} 天前的数据（保留 ${cacheDuration.value} 天内数据）`,
      color: 'green',
      icon: 'i-heroicons-check-circle-20-solid',
    });
    
    // 清理后重新加载数据
    await loadAllArticles();
    
  } catch (error) {
    console.error('缓存清理失败:', error);
    toast.add({
      title: '缓存清理失败',
      description: error instanceof Error ? error.message : '未知错误',
      color: 'red',
      icon: 'i-heroicons-exclamation-circle-20-solid',
    });
  } finally {
    cleanupLoading.value = false;
  }
}

// 清理数据库中的旧数据
async function cleanupDatabaseCache(cleanupTimestamp: number) {
  console.log('开始清理数据库缓存...');
  
  // 获取所有公众号
  const allAccounts = await getAllInfo();
  let totalDeleted = 0;
  
  for (const account of allAccounts) {
    const accountDeleted = await cleanupAccountCache(account.fakeid, cleanupTimestamp);
    totalDeleted += accountDeleted;
  }
  
  console.log(`数据库缓存清理完成，共删除 ${totalDeleted} 篇文章及相关数据`);
  return totalDeleted;
}

// 清理单个公众号的缓存数据
async function cleanupAccountCache(fakeid: string, cacheTimestamp: number): Promise<number> {
  let deletedCount = 0;
  
  try {
    // 获取该公众号的所有文章
    const allArticles = await getArticleCache(fakeid, Date.now());
    
    // 调试：显示时间信息
    console.log(`公众号 ${fakeid}: 当前时间: ${new Date().toISOString()}, 缓存时间戳: ${cacheTimestamp}, 对应日期: ${new Date(cacheTimestamp * 1000).toISOString()}`);
    console.log(`公众号 ${fakeid}: 总文章数: ${allArticles.length}`);
    
    if (allArticles.length > 0) {
      const oldest = allArticles[allArticles.length - 1];
      const newest = allArticles[0];
      console.log(`公众号 ${fakeid}: 最早文章: ${new Date(oldest.update_time * 1000).toISOString()}, 最新文章: ${new Date(newest.update_time * 1000).toISOString()}`);
    }
    
    // 找出超出缓存时间的文章
    // 注意：cacheTimestamp 是清理边界（前一天的23:59:59），清理条件是 <= 这个时间戳
    const oldArticles = allArticles.filter(article => article.update_time <= cacheTimestamp);
    
    if (oldArticles.length === 0) {
      console.log(`公众号 ${fakeid}: 没有超出缓存时间的文章`);
      return 0;
    }
    
    console.log(`公众号 ${fakeid}: 找到 ${oldArticles.length} 篇超出缓存时间的文章`);
    
    // 显示要删除的文章信息
    for (const article of oldArticles.slice(0, 5)) { // 只显示前5篇
      console.log(`公众号 ${fakeid}: 将删除文章: ${article.title}, 发布时间: ${new Date(article.update_time * 1000).toISOString()}`);
    }
    if (oldArticles.length > 5) {
      console.log(`公众号 ${fakeid}: ... 还有 ${oldArticles.length - 5} 篇`);
    }
    
    // 删除每篇旧文章的所有相关数据
    for (const article of oldArticles) {
      await deleteArticleData(fakeid, article.link);
      deletedCount++;
    }
    
    console.log(`公众号 ${fakeid}: 已删除 ${deletedCount} 篇旧文章及相关数据`);
    
    // 如果删除了文章，重置公众号的同步状态，避免重新同步旧文章
    if (deletedCount > 0) {
      await resetAccountSyncStatus(fakeid);
    }
    
  } catch (error) {
    console.error(`清理公众号 ${fakeid} 缓存失败:`, error);
  }
  
  return deletedCount;
}

// 删除单篇文章的所有相关数据
async function deleteArticleData(fakeid: string, url: string) {
  try {
    console.log(`删除文章数据: ${url}`);
    
    // 使用事务批量删除文章的所有相关数据
    await db.transaction('rw', [
      'article', 
      'html', 
      'metadata', 
      'comment', 
      'comment_reply', 
      'resource', 
      'resource-map', 
      'debug'
    ], async () => {
      // 1. 删除文章基本信息
      await db.article.where('link').equals(url).delete();
      console.log(`已删除文章基本信息: ${url}`);
      
      // 2. 删除HTML内容
      await db.html.where('url').equals(url).delete();
      console.log(`已删除HTML内容: ${url}`);
      
      // 3. 删除元数据
      await db.metadata.where('url').equals(url).delete();
      console.log(`已删除元数据: ${url}`);
      
      // 4. 删除留言数据
      await db.comment.where('url').equals(url).delete();
      console.log(`已删除留言数据: ${url}`);
      
      // 5. 删除留言回复（需要根据url查找）
      const commentReplies = await db.comment_reply.where('url').equals(url).toArray();
      for (const reply of commentReplies) {
        // comment_reply表的主键是复合键 [url, contentID]
        await db.comment_reply.delete(`${reply.url}:${reply.contentID}`);
      }
      console.log(`已删除留言回复: ${url}, 共 ${commentReplies.length} 条`);
      
      // 6. 删除资源文件
      await db.resource.where('url').equals(url).delete();
      console.log(`已删除资源文件: ${url}`);
      
      // 7. 删除资源映射
      await db['resource-map'].where('url').equals(url).delete();
      console.log(`已删除资源映射: ${url}`);
      
      // 8. 删除调试信息
      await db.debug.where('url').equals(url).delete();
      console.log(`已删除调试信息: ${url}`);
    });
    
    console.log(`文章数据删除完成: ${url}`);
    
  } catch (error) {
    console.error(`删除文章 ${url} 数据失败:`, error);
  }
}

// 定时同步功能
const syncIntervalHours = ref(24); // 默认24小时
const autoSyncEnabled = ref(false);
const autoSyncLoading = ref(false);
const nextSyncTime = ref<Date | null>(null);
let autoSyncTimer: NodeJS.Timeout | null = null;

// 计算下次同步时间
const formatNextSyncTime = computed(() => {
  if (!nextSyncTime.value) return '--:--:--';
  return nextSyncTime.value.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  });
});

// 切换定时同步
function toggleAutoSync() {
  if (autoSyncEnabled.value) {
    // 停止定时同步
    stopAutoSync();
  } else {
    // 启动定时同步
    startAutoSync();
  }
}

// 启动定时同步
function startAutoSync() {
  if (syncIntervalHours.value <= 0) {
    toast.add({
      title: '设置错误',
      description: '同步间隔必须大于0',
      color: 'red',
      icon: 'i-heroicons-exclamation-circle-20-solid',
    });
    return;
  }

  autoSyncEnabled.value = true;
  autoSyncLoading.value = true;
  
  // 计算下次同步时间
  updateNextSyncTime();
  
  // 启动定时器
  startAutoSyncTimer();
  
  // 根据间隔显示不同的单位
  let intervalText = '';
  if (syncIntervalHours.value < 1) {
    const minutes = Math.round(syncIntervalHours.value * 60);
    intervalText = `每隔 ${minutes} 分钟自动同步`;
  } else if (syncIntervalHours.value === 1) {
    intervalText = '每隔 1 小时自动同步';
  } else {
    intervalText = `每隔 ${syncIntervalHours.value} 小时自动同步`;
  }
  
  toast.add({
    title: '定时同步已开启',
    description: intervalText,
    color: 'green',
    icon: 'i-heroicons-check-circle-20-solid',
  });
  
  autoSyncLoading.value = false;
}

// 停止定时同步
function stopAutoSync() {
  autoSyncEnabled.value = false;
  autoSyncLoading.value = true;
  
  // 清除定时器
  if (autoSyncTimer) {
    clearTimeout(autoSyncTimer);
    autoSyncTimer = null;
  }
  
  nextSyncTime.value = null;
  
  toast.add({
    title: '定时同步已停止',
    description: '已停止自动同步',
    color: 'orange',
    icon: 'i-heroicons-stop-circle-20-solid',
  });
  
  autoSyncLoading.value = false;
}

// 更新下次同步时间
function updateNextSyncTime() {
  const intervalMs = syncIntervalHours.value * 60 * 60 * 1000;
  nextSyncTime.value = new Date(Date.now() + intervalMs);
}

// 启动定时器
function startAutoSyncTimer() {
  if (!autoSyncEnabled.value) return;
  
  const intervalMs = syncIntervalHours.value * 60 * 60 * 1000;
  
  // 清除现有定时器
  if (autoSyncTimer) {
    clearTimeout(autoSyncTimer);
  }
  
  // 设置新定时器
  autoSyncTimer = setTimeout(async () => {
    if (!autoSyncEnabled.value) return;
    
    console.log(`定时同步开始 (间隔: ${syncIntervalHours.value}小时)`);
    
    try {
      // 执行一键同步
      await oneClickSync();
      
      // 更新下次同步时间
      updateNextSyncTime();
      
      // 重新启动定时器
      startAutoSyncTimer();
      
      console.log('定时同步完成，已重新设置定时器');
    } catch (error) {
      console.error('定时同步失败:', error);
      
      // 即使失败也重新设置定时器
      updateNextSyncTime();
      startAutoSyncTimer();
    }
  }, intervalMs);
  
  console.log(`定时器已设置，${syncIntervalHours.value}小时后执行`);
}

// 立即执行定时同步
function triggerAutoSyncNow() {
  if (!autoSyncEnabled.value) {
    toast.add({
      title: '定时同步未开启',
      description: '请先开启定时同步功能',
      color: 'red',
      icon: 'i-heroicons-exclamation-circle-20-solid',
    });
    return;
  }
  
  console.log('手动触发定时同步');
  
  // 清除现有定时器
  if (autoSyncTimer) {
    clearTimeout(autoSyncTimer);
  }
  
  // 立即执行同步
  oneClickSync().then(() => {
    // 同步完成后重新设置定时器
    updateNextSyncTime();
    startAutoSyncTimer();
  });
}

// 组件卸载时清理定时器
onUnmounted(() => {
  if (autoSyncTimer) {
    clearTimeout(autoSyncTimer);
    autoSyncTimer = null;
  }
});

// 一键同步功能
const oneClickSyncLoading = ref(false);
const toast = useToast();
const { checkLogin } = useLoginCheck();
const modal = useModal();

async function oneClickSync() {
  if (oneClickSyncLoading.value) return;
  
  oneClickSyncLoading.value = true;
  try {
    console.log('开始一键同步流程...');
    
    // 步骤1: 执行更新所有公众号的文章（同步功能）
    await syncAllAccounts();
    
    // 步骤2: 选中所有"内容已下载"未选中的文章，发送到后台
    const articlesToProcess = await selectUndownloadedArticles();
    
    if (articlesToProcess.length > 0) {
      // 发送文章数据到后台
      await sendArticlesToBackend(articlesToProcess);
    } else {
      console.log('没有需要处理的文章');
      toast.add({
        title: '一键同步完成',
        description: '所有文章都已处理完成，无需处理新文章',
        color: 'green',
        icon: 'i-heroicons-check-circle-20-solid',
      });
    }
    
    // 步骤3: 执行缓存清理（根据用户需求，在执行同步后进行数据清理）
    console.log('开始执行缓存清理...');
    // 直接调用清理缓存函数，确保使用相同的逻辑
    await cleanupOldCache();
    const deletedCount = 0; // cleanupOldCache内部会处理删除计数
    
    console.log('一键同步流程完成');
    toast.add({
      title: '一键同步完成',
      description: `已成功同步并处理了 ${articlesToProcess.length} 篇文章，清理了 ${deletedCount} 篇旧文章`,
      color: 'green',
      icon: 'i-heroicons-check-circle-20-solid',
    });
    
  } catch (error) {
    console.error('一键同步失败:', error);
    
    // 检查是否是session expired错误
    if (error instanceof Error && error.message === 'session expired') {
      // 打开登录模态框
      modal.open(LoginModal);
      toast.add({
        title: '登录已过期',
        description: '请重新登录微信后再试',
        color: 'red',
        icon: 'i-heroicons-exclamation-circle-20-solid',
      });
    } else {
      toast.add({
        title: '一键同步失败',
        description: error instanceof Error ? error.message : '未知错误',
        color: 'red',
        icon: 'i-heroicons-exclamation-circle-20-solid',
      });
    }
  } finally {
    oneClickSyncLoading.value = false;
  }
}

// 步骤1: 同步所有公众号的文章
async function syncAllAccounts() {
  console.log('开始同步所有公众号的文章...');
  
  const allAccounts = await getAllInfo();
  console.log(`找到 ${allAccounts.length} 个公众号需要同步`);
  
  // 检查登录状态
  if (!checkLogin()) {
    toast.add({
      title: '同步失败',
      description: '请先登录微信',
      color: 'red',
      icon: 'i-heroicons-exclamation-circle-20-solid',
    });
    throw new Error('未登录');
  }
  
  // 获取同步时间范围
  const syncDeadline = useSyncDeadline();
  const syncToTimestamp = syncDeadline.getSyncTimestamp();
  
  // 遍历所有公众号进行同步
  let successCount = 0;
  let failCount = 0;
  
  for (const account of allAccounts) {
    console.log(`同步公众号: ${account.nickname} (${account.fakeid})`);
    
    try {
      // 调用同步函数
      await syncAccountArticles(account, syncToTimestamp);
      console.log(`公众号 ${account.nickname} 同步完成`);
      successCount++;
      
      // 更新进度反馈
      toast.add({
        title: '同步进度',
        description: `已同步 ${successCount}/${allAccounts.length} 个公众号`,
        color: 'blue',
        icon: 'i-heroicons-arrow-path-20-solid',
        timeout: 2000,
      });
    } catch (error) {
      console.error(`公众号 ${account.nickname} 同步失败:`, error);
      failCount++;
      // 继续同步下一个公众号，不中断整体流程
    }
  }
  
  console.log('所有公众号同步完成');
  toast.add({
    title: '公众号同步完成',
    description: `成功: ${successCount}个, 失败: ${failCount}个`,
    color: successCount > 0 ? 'green' : 'red',
    icon: successCount > 0 ? 'i-heroicons-check-circle-20-solid' : 'i-heroicons-exclamation-circle-20-solid',
  });
  
  // 同步完成后重新加载文章数据
  await loadAllArticles();
}

// 同步单个公众号的文章
async function syncAccountArticles(account: MpAccount, syncToTimestamp: number) {
  let begin = 0;
  let loadMore = true;
  let hasArticlesInRange = false;
  
  console.log(`同步时间范围: ${new Date(syncToTimestamp * 1000).toISOString().split('T')[0]} 之后`);
  
  while (loadMore) {
    // 获取文章列表
    const [articles, completed] = await getArticleList(account, begin);
    
    if (articles.length === 0) {
      console.log(`公众号 ${account.nickname} 没有更多文章`);
      break;
    }
    
    // 检查当前批次中是否有文章在时间范围内（基于发布时间 update_time）
    const articlesInRange = articles.filter(article => article.update_time >= syncToTimestamp);
    
    if (articlesInRange.length === 0) {
      // 当前批次的所有文章都早于时间范围，停止同步
      console.log(`公众号 ${account.nickname} 当前批次文章都早于时间范围，停止同步`);
      loadMore = false;
      break;
    }
    
    // 更新begin参数（只计算在时间范围内的文章）
    const count = articlesInRange.filter(article => article.itemidx === 1).length; // 消息数
    begin += count;
    hasArticlesInRange = true;
    
    console.log(`公众号 ${account.nickname} 批次获取 ${articles.length} 篇文章，其中 ${articlesInRange.length} 篇在时间范围内`);
    
    // 检查是否可以「快进」，也就是存在比 lastArticle 更早的缓存数据
    const lastArticle = articles.at(-1);
    if (lastArticle && lastArticle.update_time < account.last_update_time!) {
      if (await hitCache(account.fakeid, lastArticle.update_time)) {
        const cachedArticles = await getArticleCache(account.fakeid, lastArticle.update_time);
        // 只计算缓存中在时间范围内的文章（基于发布时间 update_time）
        const cachedInRange = cachedArticles.filter(article => article.update_time >= syncToTimestamp);
        const cachedCount = cachedInRange.filter(article => article.itemidx === 1).length;
        begin += cachedCount;
        console.log(`公众号 ${account.nickname} 快进获取 ${cachedInRange.length} 篇缓存文章在时间范围内`);
      }
    }
    
    // 如果已完成同步，退出循环
    if (completed) {
      console.log(`公众号 ${account.nickname} 已完成同步`);
      break;
    }
    
    // 延迟一段时间，避免请求过于频繁
    await sleep(5000); // 5秒延迟，与账户页面的配置一致
  }
  
  if (hasArticlesInRange) {
    console.log(`公众号 ${account.nickname} 同步完成，共获取 ${begin} 条消息在时间范围内`);
  } else {
    console.log(`公众号 ${account.nickname} 没有在时间范围内的文章`);
  }
}

// 步骤2: 选中所有"内容已下载"未选中的文章
async function selectUndownloadedArticles(): Promise<Article[]> {
  console.log('筛选未下载的文章...');
  
  // 重新加载所有文章以确保数据最新
  await loadAllArticles();
  
  // 筛选出 contentDownload 为 false 的文章
  const undownloadedArticles = globalRowData.filter(article => !article.contentDownload);
  
  console.log(`找到 ${undownloadedArticles.length} 篇未下载的文章`);
  return undownloadedArticles;
}

// 发送文章数据到后台
async function sendArticlesToBackend(articles: Article[]) {
  if (articles.length === 0) return;
  
  console.log(`开始发送 ${articles.length} 篇文章数据到后台...`);
  
  const parser = new DOMParser();
  let successCount = 0;
  let failCount = 0;
  
  for (const article of articles) {
    try {
      // 获取文章内容
      let news_content = '';
      
      // 先尝试从HTML缓存获取
      const cached = await getHtmlCache(article.link);
      if (cached) {
        // 从HTML缓存提取纯文本内容
        const html = await cached.file.text();
        const document = parser.parseFromString(html, 'text/html');
        const $jsArticleContent = document.querySelector('#js_article');
        if ($jsArticleContent) {
          // 提取纯文本内容
          news_content = ($jsArticleContent as HTMLElement).innerText!.replace(/\s+/g, ' ').trim();
        }
      }
      
      // 如果HTML缓存中没有内容，尝试下载文章内容
      if (!news_content) {
        console.log(`文章 ${article.title} 没有HTML缓存，开始下载...`);
        try {
          // 使用现有的下载功能下载文章内容
          await download('html', [article.link]);
          
          // 等待下载完成
          await sleep(2000);
          
          // 再次尝试从HTML缓存获取
          const newCached = await getHtmlCache(article.link);
          if (newCached) {
            const html = await newCached.file.text();
            const document = parser.parseFromString(html, 'text/html');
            const $jsArticleContent = document.querySelector('#js_article');
            if ($jsArticleContent) {
              news_content = ($jsArticleContent as HTMLElement).innerText!.replace(/\s+/g, ' ').trim();
              console.log(`文章 ${article.title} 下载成功，内容长度: ${news_content.length} 字符`);
            }
          }
        } catch (downloadError) {
          console.error(`下载文章 ${article.title} 失败:`, downloadError);
          // 如果下载失败，使用摘要作为备用
          if (article.digest) {
            news_content = article.digest;
            console.log(`使用摘要作为文章内容: ${article.title}`);
          }
        }
      }
      
      // 如果仍然没有内容，使用摘要
      if (!news_content && article.digest) {
        news_content = article.digest;
        console.log(`使用摘要作为文章内容: ${article.title}`);
      }
      
      // 获取公众号名称
      const website_name = article.account?.nickname || '未知公众号';
      
      // 获取作者（如果没有作者信息，使用公众号名称）
      const news_sources = article.author_name || website_name;
      
      // 格式化发布时间
      const release_date = new Date(article.update_time * 1000).toISOString().replace('T', ' ').substring(0, 19);
      
      // 准备发送的数据
      const articleData = {
        website_name,
        news_headlines: article.title,
        news_sources,
        news_link: article.link,
        release_date,
        news_content
      };
      
      // 发送到后台接口
      const response = await $fetch('/api/articles/save', {
        method: 'POST',
        body: articleData,
        headers: {
          'Content-Type': 'application/json'
        }
      });
      
      console.log(`文章发送成功: ${article.title}, 响应:`, response);
      successCount++;
      
      // 更新文章状态为已处理
      article.contentDownload = true;
      article._status = '已发送到后台';
      updateRow(article);
      updateArticleStatus(article.link, '已发送到后台');
      
      // 创建一个简单的HTML缓存，这样loadAllArticles就能检测到文章已下载
      await createSimpleHtmlCache(article.link, article.title, article.account?.fakeid || '');
      
      // 显示进度
      toast.add({
        title: '发送进度',
        description: `已发送 ${successCount}/${articles.length} 篇文章`,
        color: 'blue',
        icon: 'i-heroicons-arrow-up-tray-20-solid',
        timeout: 2000,
      });
      
    } catch (error) {
      console.error(`发送文章 ${article.title} 失败:`, error);
      failCount++;
      
      // 更新文章状态为发送失败
      article._status = '发送失败';
      updateRow(article);
      updateArticleStatus(article.link, '发送失败');
    }
    
    // 延迟一段时间，避免请求过于频繁
    await sleep(1000);
  }
  
  console.log(`文章发送完成: 成功 ${successCount} 篇, 失败 ${failCount} 篇`);
  
  if (successCount > 0) {
    toast.add({
      title: '文章发送完成',
      description: `成功发送 ${successCount} 篇文章到后台`,
      color: 'green',
      icon: 'i-heroicons-check-circle-20-solid',
    });
  }
  
  if (failCount > 0) {
    toast.add({
      title: '部分文章发送失败',
      description: `${failCount} 篇文章发送失败，请检查网络连接`,
      color: 'red',
      icon: 'i-heroicons-exclamation-circle-20-solid',
    });
  }
}

// 下载选中的文章
async function downloadArticles(articles: Article[]) {
  if (articles.length === 0) return;
  
  console.log(`开始下载 ${articles.length} 篇文章...`);
  
  const urls = articles.map(article => article.link);
  
  // 使用现有的下载功能
  await download('html', urls);
  
  console.log('文章下载完成');
}

// 步骤3: 生成JSON并在控制台输出
async function exportArticlesToConsole(articles: Article[]) {
  console.log('生成文章JSON数据...');
  
  const parser = new DOMParser();
  const exportData = [];
  
  for (const article of articles) {
    try {
      // 获取文章的实际内容（纯文本，与下载功能的JSON导出保持一致）
      let content = '';
      if (article.contentDownload) {
        // 直接从HTML缓存获取并提取纯文本内容
        const cached = await getHtmlCache(article.link);
        if (cached) {
          const html = await cached.file.text();
          const document = parser.parseFromString(html, 'text/html');
          const $jsArticleContent = document.querySelector('#js_article');
          if ($jsArticleContent) {
            // 提取纯文本内容，与下载功能的JSON导出保持一致
            content = ($jsArticleContent as HTMLElement).innerText!.replace(/\s+/g, ' ').trim();
          }
        }
      }
      
      // 获取公众号名称
      const accountName = article.account?.nickname || '未知公众号';
      
      // 获取元数据
      const metadata = await getMetadataCache(article.link);
      
      // 按照 ExcelExportEntity 格式准备数据（与下载功能的JSON导出保持一致）
      const exportItem = {
        _accountName: accountName,
        aid: article.aid,
        link: article.link,
        title: article.title,
        cover: article.cover,
        digest: article.digest,
        create_time: article.create_time,
        update_time: article.update_time,
        readNum: metadata?.readNum || 0,
        oldLikeNum: metadata?.oldLikeNum || 0,
        shareNum: metadata?.shareNum || 0,
        likeNum: metadata?.likeNum || 0,
        commentNum: metadata?.commentNum || 0,
        author_name: article.author_name,
        copyright_stat: article.copyright_stat,
        copyright_type: article.copyright_type,
        item_show_type: article.item_show_type,
        appmsg_album_infos: article.appmsg_album_infos,
        content: content, // 纯文本内容，与下载功能的JSON导出保持一致
        // 可以添加更多字段...
      };
      
      exportData.push(exportItem);
      console.log(`已处理文章: ${article.title}, 内容长度: ${content.length} 字符`);
    } catch (error) {
      console.error(`处理文章 ${article.title} 时出错:`, error);
    }
  }
  
  // 在控制台输出JSON
  console.log('=== 一键同步结果 JSON 数据 ===');
  console.log(JSON.stringify(exportData, null, 2));
  console.log('=== JSON 数据结束 ===');
  
  // 保存到文件
  const jsonStr = JSON.stringify(exportData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `一键同步结果_${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  
  console.log(`已生成 ${exportData.length} 篇文章的JSON数据，包含纯文本内容`);
}

// 重置公众号的同步状态
async function resetAccountSyncStatus(fakeid: string) {
  try {
    // 导入updateInfoCache和getInfoCache函数
    const { updateInfoCache, getInfoCache } = await import('~/store/v2/info');
    
    // 先获取现有的公众号信息
    const account = await getInfoCache(fakeid);
    if (!account) {
      console.log(`公众号 ${fakeid} 不存在，无需重置`);
      return;
    }
    
    // 重置公众号的同步状态
    await updateInfoCache({
      ...account,
      completed: false,  // 标记为未完成同步
      count: 0,         // 重置消息计数
      articles: 0,      // 重置文章计数
      // 其他字段保持不变
    });
    
    console.log(`已重置公众号 ${account.nickname || fakeid} 的同步状态`);
  } catch (error) {
    console.error(`重置公众号 ${fakeid} 同步状态失败:`, error);
  }
}

// 创建简单的HTML缓存，用于标记文章已下载
async function createSimpleHtmlCache(url: string, title: string, fakeid: string) {
  try {
    // 创建一个简单的HTML内容，只包含标题和链接
    const simpleHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title}</title>
</head>
<body>
  <div id="js_article">
    <h1>${title}</h1>
    <p>文章已发送到后台，原始内容未下载。</p>
    <p>文章链接: <a href="${url}">${url}</a></p>
  </div>
</body>
</html>`;
    
    // 创建Blob对象
    const blob = new Blob([simpleHtml], { type: 'text/html' });
    
    // 导入updateHtmlCache函数
    const { updateHtmlCache } = await import('~/store/v2/html');
    
    // 保存到IndexedDB
    await updateHtmlCache({
      fakeid,
      url,
      file: blob,
      title,
      commentID: null
    });
    
    console.log(`已创建简单HTML缓存: ${title}`);
  } catch (error) {
    console.error(`创建HTML缓存失败: ${url}`, error);
  }
}
</script>

<template>
  <div class="h-full">
    <Teleport defer to="#title">
      <h1 class="text-[28px] leading-[34px] text-slate-12 dark:text-slate-50 font-bold">文章下载</h1>
    </Teleport>

    <div class="flex flex-col h-full divide-y divide-gray-200">
      <!-- 顶部筛选与操作区 -->
      <header class="flex flex-col items-start lg:flex-row lg:items-center lg:justify-between gap-2 px-3 py-2">
        <div class="flex flex-col xl:flex-row gap-2">
          <div class="flex items-center space-x-3">
            <!-- 缓存时间设置 -->
            <div class="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg">
              <span class="text-sm text-gray-600 dark:text-gray-400">缓存时间:</span>
              <USelect
                v-model="cacheDuration"
                :options="cacheDurationOptions"
                option-attribute="label"
                value-attribute="value"
                class="w-32"
              />
              <UButton
                color="gray"
                icon="i-heroicons-trash-20-solid"
                label="清理缓存"
                @click="cleanupOldCache"
                :loading="cleanupLoading"
              />
            </div>
            
            <!-- 定时同步功能 -->
            <div class="flex items-center space-x-2 bg-gray-100 dark:bg-gray-800 px-3 py-2 rounded-lg">
              <UInput
                v-model="syncIntervalHours"
                type="number"
                min="0.1"
                max="720"
                step="0.1"
                placeholder="小时"
                :disabled="autoSyncEnabled"
                class="w-20"
              />
              <span class="text-sm text-gray-600 dark:text-gray-400">小时</span>
              <UButton
                :color="autoSyncEnabled ? 'red' : 'green'"
                :icon="autoSyncEnabled ? 'i-heroicons-stop-20-solid' : 'i-heroicons-play-20-solid'"
                :label="autoSyncEnabled ? '停止' : '开启'"
                @click="toggleAutoSync"
                :loading="autoSyncLoading"
              />
              <div v-if="autoSyncEnabled" class="flex items-center space-x-2">
                <span class="text-sm text-gray-600 dark:text-gray-400">
                  下次同步: {{ formatNextSyncTime }}
                </span>
                <UButton
                  color="orange"
                  icon="i-heroicons-arrow-path-20-solid"
                  label="立即同步"
                  size="xs"
                  @click="triggerAutoSyncNow"
                />
              </div>
            </div>
            
            <!-- 一键同步按钮 -->
            <UButton
              color="purple"
              icon="i-heroicons:arrow-path-rounded-square-20-solid"
              label="一键同步"
              :loading="oneClickSyncLoading"
              @click="oneClickSync"
            />
            
            <!-- <AccountSelectorForArticle v-model="selectedAccount" class="w-80" /> -->
          </div>
        </div>
        <!-- 
        <div class="flex items-center space-x-2">
          <UButton v-if="downloadBtnLoading || oneClickSyncLoading" color="black" @click="stopSyncOrDownload">停止</UButton>
          <ButtonGroup
            :items="[
              { label: '文章内容', event: 'download-article-html' },
              { label: '阅读量 (需要Credential)', event: 'download-article-metadata' },
              { label: '留言内容 (需要Credential)', event: 'download-article-comment' },
            ]"
            @download-article-html="download('html', selectedArticleUrls)"
            @download-article-metadata="download('metadata', selectedArticleUrls)"
            @download-article-comment="download('comment', selectedArticleUrls)"
          >
            <UButton
              :loading="downloadBtnLoading"
              :disabled="!selectedAccount"
              color="white"
              class="font-mono"
              :label="downloadBtnLoading ? `抓取中 ${downloadCompletedCount}/${downloadTotalCount}` : '抓取'"
              trailing-icon="i-heroicons-chevron-down-20-solid"
            />
          </ButtonGroup>

          <ButtonGroup
            :items="[
              { label: 'Excel', event: 'export-article-excel' },
              { label: 'JSON', event: 'export-article-json' },
              { label: 'HTML', event: 'export-article-html' },
              { label: 'Txt', event: 'export-article-text' },
              { label: 'Markdown', event: 'export-article-markdown' },
              { label: 'Word (内测中)', event: 'export-article-word' },
              // { label: 'PDF (计划中)', event: 'export-article-pdf', disabled: true },
            ]"
            @export-article-excel="exportFile('excel', selectedArticleUrls)"
            @export-article-json="exportFile('json', selectedArticleUrls)"
            @export-article-html="exportFile('html', selectedArticleUrls)"
            @export-article-text="exportFile('text', selectedArticleUrls)"
            @export-article-markdown="exportFile('markdown', selectedArticleUrls)"
            @export-article-word="exportFile('word', selectedArticleUrls)"
          >
            <UButton
              :loading="exportBtnLoading"
              :disabled="!selectedAccount"
              color="white"
              class="font-mono"
              :label="exportBtnLoading ? `${exportPhase} ${exportCompletedCount}/${exportTotalCount}` : '导出'"
              trailing-icon="i-heroicons-chevron-down-20-solid"
            />
          </ButtonGroup>

          <UButton
            :disabled="!selectedAccount"
            :icon="copied ? 'i-lucide:check' : 'i-heroicons-link-16-solid'"
            label="复制公众号链接"
            :color="copied ? 'green' : 'blue'"
            @click="copyWechatLink"
          />
          <UButton v-if="isDev" @click="debug">调试</UButton>
        </div>
        -->
      </header>

      <ag-grid-vue
        style="width: 100%; height: 100%"
        :loading="loading"
        :rowData="globalRowData"
        :columnDefs="columnDefs"
        :gridOptions="gridOptions"
        @grid-ready="onGridReady"
        @filter-changed="onFilterChanged"
        @column-moved="onColumnStateChange"
        @column-visible="onColumnStateChange"
        @column-pinned="onColumnStateChange"
        @column-resized="onColumnStateChange"
        @selection-changed="onSelectionChanged"
      ></ag-grid-vue>
    </div>

    <PreviewArticle ref="previewArticleRef" />
  </div>
</template>
