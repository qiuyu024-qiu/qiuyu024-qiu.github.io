// generator.mjs
// 热点内容生成逻辑（探楼纪风格：深圳商办 / 写字楼 / 打工人）。
// 由本地服务端（server.mjs）与 GitHub Actions 每日任务（scripts/update-daily.mjs）共用，
// 保证两端生成的热点格式、风格完全一致。零依赖。

export const TITLE_POOL = [
  '深圳写字楼空置率逼近30%，业主集体降租抢客',
  '前海核心区写字楼打出"免租15个月"招商牌',
  '腾讯周边商办租金年内二连降，打工人通勤成本走低',
  '南山科技园新旧写字楼租金剪刀差拉大',
  '深圳写字楼"以价换量"，三季度成交明显回暖',
  '打工人选址新逻辑：先问电费再问租金',
  '宝安某产业园空置率腰斩，靠制造业回流填仓',
  '福田CBD甲级写字楼租金重回2019水平',
  '深港融合带旺河套商办，港企北上看房增多',
  '龙岗大运新城写字楼去化提速，配套跟上了',
  '后海总部基地再加码，字节扩租整层',
  '深圳为什么还在拼命建写字楼？空置率与新增供应真相',
];

export const SUMMARY_POOL = [
  '业主为留住大客户，把免租期、装修补贴、车位全堆上谈判桌。',
  '招商口径从"稀缺"变成"实在"，先活下来再谈溢价。',
  '租金下行对租客是利好，对持有方则是现金流考验。',
  '选址别只看单价，电梯、空调、电费才是天天在烧的钱。',
  '商办市场的温度计，往往藏在空置率和带看量里。',
];

export const CATEGORIES = ['空置率', '租金', '选址', '深港', '大厂', '政策'];
export const TAGS = ['深圳', '写字楼', '商业地产', '企业选址', '打工人', '前海', '南山'];

function pick(arr, seed) {
  return arr[seed % arr.length];
}

function dayAt9(date) {
  const d = new Date(date);
  d.setHours(9, 0, 0, 0);
  return d;
}

export function dateKey(d) {
  return new Date(d).toISOString().slice(0, 10);
}

/** 为某一天生成一批（3~5条）09:00 热点。 */
export function generateBatchForDate(date) {
  const base = dayAt9(date);
  const dayIdx = Math.floor(base.getTime() / 86400000);
  const n = 3 + (dayIdx % 3); // 3~5
  const items = [];
  for (let i = 0; i < n; i++) {
    const t = new Date(base.getTime() + i * 60000); // 同天错开分钟，保持倒序稳定
    const titleIdx = (dayIdx + i) % TITLE_POOL.length;
    items.push({
      id: `h-${dateKey(base)}-${i}`,
      title: pick(TITLE_POOL, titleIdx),
      summary: pick(SUMMARY_POOL, dayIdx + i),
      category: pick(CATEGORIES, dayIdx + i),
      source: '探楼纪热点追踪',
      tags: [pick(TAGS, dayIdx), pick(TAGS, dayIdx + i + 1)].filter(
        (v, idx, a) => a.indexOf(v) === idx
      ),
      generatedAt: t.toISOString(),
    });
  }
  return items;
}
