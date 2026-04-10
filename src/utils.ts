interface CronArrays {
  minutes: number[];
  hours: number[];
  mdays: number[];
  months: number[];
  wdays: number[];
}

interface Limit {
  min: number;
  max: number;
}

export function parseCronToArrays(cronStr: string): CronArrays {
  // 1. 按空白字符拆解五个字段
  const fields = cronStr.trim().split(/\s+/);
  if (fields.length !== 5) {
    throw new Error("无效的 Cron 表达式，必须包含 5 个字段");
  }

  // 2. 定义每个字段的边界值 [最小值, 最大值]
  const limits: Limit[] = [
    { min: 0, max: 59 }, // minutes
    { min: 0, max: 23 }, // hours
    { min: 1, max: 31 }, // mdays (日期)
    { min: 1, max: 12 }, // months
    { min: 0, max: 6 }   // wdays (星期，0=周日)
  ];

  // 3. 核心解析逻辑
  function parseField(fieldStr: string, limit: Limit): number[] {
    const values = new Set<number>();

    // 兼容某些 cron 方言中的 '?' 符号（等同于 '*'）
    if (fieldStr === '?') fieldStr = '*';

    // 处理逗号枚举 (例如: "1,15,30")
    const parts = fieldStr.split(',');

    for (const part of parts) {
      let step = 1;
      let rangeStr = part;

      // 处理步长 (例如: "*/15" 或 "1-10/2")
      if (part.includes('/')) {
        const splitPart = part.split('/');
        rangeStr = splitPart[0];
        step = parseInt(splitPart[1], 10);
      }

      let start = limit.min;
      let end = limit.max;

      if (rangeStr !== '*') {
        // 处理范围 (例如: "1-5")
        if (rangeStr.includes('-')) {
          const rangeParts = rangeStr.split('-');
          start = parseInt(rangeParts[0], 10);
          end = parseInt(rangeParts[1], 10);
        } else {
          // 处理单个数字 (例如: "5")
          start = parseInt(rangeStr, 10);
          end = start;
        }
      }

      // 将计算出的值加入 Set（自动去重）
      for (let i = start; i <= end; i += step) {
        values.add(i);
      }
    }

    // 转为数组并按升序排序
    return Array.from(values).sort((a: number, b: number) => a - b);
  }

  // 4. 返回目标结构
  return {
    minutes: parseField(fields[0], limits[0]),
    hours: parseField(fields[1], limits[1]),
    mdays: parseField(fields[2], limits[2]),
    months: parseField(fields[3], limits[3]),
    wdays: parseField(fields[4], limits[4])
  };
}

