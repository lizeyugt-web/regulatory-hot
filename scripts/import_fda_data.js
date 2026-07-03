/**
 * FDA 数据导入脚本
 * 将已采集的 FDA JSON 数据导入到 SQLite 数据库
 * 用法: node scripts/import_fda_data.js
 */

require('dotenv').config();

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const DatabaseManager = require('../src/database/manager');

async function main() {
  console.log('============================================================');
  console.log('  FDA 数据导入工具');
  console.log('============================================================\n');

  // 1. 初始化数据库
  const db = new DatabaseManager();
  await db.init();

  // 2. 查找 FDA JSON 文件
  const jsonDir = path.join(__dirname, '..', 'data', 'fda', 'raw_json');
  const files = fs.readdirSync(jsonDir).filter(f => f.endsWith('.json'));

  if (files.length === 0) {
    console.log('❌ 未找到 FDA JSON 数据文件');
    console.log('   请先运行: npm run crawl');
    db.close();
    return;
  }

  console.log(`📂 找到 ${files.length} 个数据文件:\n`);
  files.forEach(f => console.log(`   - ${f}`));

  let totalImported = 0;
  let totalSkipped = 0;

  for (const file of files) {
    const filePath = path.join(jsonDir, file);
    console.log(`\n📄 处理: ${file}`);

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
    const items = data.items || [];

    console.log(`   共 ${items.length} 条记录`);

    // 转换为 raw_items 格式
    const rawItems = items.map(item => ({
      content_hash: item.id || crypto.createHash('sha256').update(item.original_link || item.title_original || '').digest('hex'),
      source_type: item.source_type || 'web',
      source_name: item.source_name || 'FDA',
      source_url: item.source_url || item.original_link || '',
      source_link: item.original_link || '',
      category: item.category || 'general',
      language: item.language || 'en',
      title: item.title_original || '',
      title_cn: '',
      summary: item.summary_original || '',
      full_content: typeof item.content_raw === 'string' ? item.content_raw : JSON.stringify(item.content_raw || ''),
      published_date: item.published_date || new Date().toISOString(),
      guid: item.guid || item.original_link || '',
      authors: item.creator ? [item.creator] : [],
      categories: [item.category, item.subcategory].filter(Boolean),
      raw_data: JSON.stringify(item),
      crawled_at: item.collected_at || new Date().toISOString()
    }));

    // 批量写入，跳过重复
    let imported = 0;
    let skipped = 0;

    for (const rawItem of rawItems) {
      const exists = db.checkDuplicate(rawItem.content_hash);
      if (!exists) {
        db.saveRawItems([rawItem]);
        imported++;
      } else {
        skipped++;
      }
    }

    console.log(`   ✅ 导入: ${imported} 条`);
    console.log(`   ⏭️ 跳过(重复): ${skipped} 条`);

    totalImported += imported;
    totalSkipped += skipped;
  }

  // 3. 检查结果
  const rawCount = db._getSingleCount('SELECT COUNT(*) as count FROM raw_items');

  console.log('\n============================================================');
  console.log('  导入完成!');
  console.log(`  新增: ${totalImported} 条`);
  console.log(`  跳过: ${totalSkipped} 条`);
  console.log(`  raw_items 总数: ${rawCount}`);
  console.log('============================================================\n');

  db.close();
}

main().catch(error => {
  console.error('导入失败:', error);
  process.exit(1);
});
