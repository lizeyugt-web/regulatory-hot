/**
 * 端到端测试脚本
 * 测试采集引擎、数据库、分析器是否正常工作
 */

require('dotenv').config();

const DatabaseManager = require('../src/database/manager');
const CrawlEngine = require('../src/crawlers/engine');
const AIAnalyzer = require('../src/analyzer/ai_analyzer');

const config = require('../config/sources.json');

async function test() {
  console.log('========================================');
  console.log('  端到端测试');
  console.log('========================================\n');

  let db = null;
  let passed = 0;
  let failed = 0;

  function assert(condition, testName) {
    if (condition) {
      console.log(`  ✅ PASS: ${testName}`);
      passed++;
    } else {
      console.log(`  ❌ FAIL: ${testName}`);
      failed++;
    }
  }

  try {
    // Test 1: Database
    console.log('\n📦 Test 1: Database');
    db = new DatabaseManager(':memory:'); // 使用内存数据库测试
    db.dbPath = ':memory:';
    // Override init to use in-memory
    const initSqlJs = require('sql.js');
    db.SQL = await initSqlJs();
    db.db = new db.SQL.Database();
    db._createTables();
    console.log('  ✅ Database initialized (in-memory)');

    // Test 2: Save raw items
    console.log('\n📦 Test 2: Save Raw Items');
    const testItem = {
      content_hash: 'test_hash_123',
      source_type: 'rss',
      source_name: 'Test Source',
      source_url: 'https://example.com',
      source_link: 'https://example.com/article',
      category: 'news',
      language: 'en',
      title: 'Test Regulatory Update',
      summary: 'This is a test summary',
      full_content: 'Full test content here',
      published_date: new Date().toISOString(),
      guid: 'test_guid_123',
      authors: ['Test Author'],
      categories: ['news'],
      raw_data: JSON.stringify({ test: true })
    };

    const inserted = db.saveRawItems([testItem]);
    assert(inserted === 1, 'Save single raw item');

    // Test 3: Check duplicate
    console.log('\n📦 Test 3: Duplicate Detection');
    const isDup = db.checkDuplicate('test_hash_123');
    assert(isDup === true, 'Detect existing duplicate');

    const isNew = db.checkDuplicate('nonexistent_hash');
    assert(isNew === false, 'Allow new content');

    // Test 4: Save regulatory event
    console.log('\n📦 Test 4: Save Regulatory Event');
    const testEvent = {
      content_hash: 'test_hash_123',
      title_original: 'Test Regulatory Update',
      title_cn: '测试监管更新',
      summary_cn: '这是一个测试摘要',
      summary_en: 'This is a test summary',
      published_date: new Date().toISOString(),
      country: 'US',
      region: '北美',
      organization: 'FDA',
      organization_en: 'U.S. Food and Drug Administration',
      category: '新闻动态类',
      importance_level: 3,
      importance_reason: '测试分级',
      confidence_score: 0.85,
      ai_model: 'test',
      review_status: 'published'
    };

    db.saveRegulatoryEvent(testEvent);
    const events = db.queryEvents({ country: 'US' });
    assert(events.length > 0, 'Query events by country');
    assert(events[0].title_cn === '测试监管更新', 'Event title matches');

    // Test 5: Get stats
    console.log('\n📦 Test 5: Statistics');
    const stats = db.getStats();
    assert(stats.totalEvents > 0, 'Total events count > 0');
    assert(stats.byCountry.length > 0, 'Has country stats');

    // Test 6: Save crawl log
    console.log('\n📦 Test 6: Crawl Log');
    db.saveCrawlLog({
      crawl_type: 'test',
      start_time: new Date().toISOString(),
      end_time: new Date().toISOString(),
      total_items: 1,
      rss_items: 1,
      api_items: 0,
      web_items: 0,
      duplicates_removed: 0,
      errors: 0,
      status: 'completed'
    });

    const logs = db._queryAll('SELECT * FROM crawl_logs ORDER BY start_time DESC LIMIT 1');
    assert(logs.length > 0, 'Crawl log saved');
    assert(logs[0].status === 'completed', 'Crawl log status correct');

    // Test 7: Source config validation
    console.log('\n📦 Test 7: Source Configuration');

    // 验证配置结构
    assert(config.meta !== undefined, 'Config has meta');
    assert(config.sources !== undefined, 'Config has sources');
    assert(config.sources.regulatory_agencies !== undefined, 'Has regulatory_agencies');
    assert(config.sources.regulatory_agencies.usa !== undefined, 'Has USA');
    assert(config.sources.regulatory_agencies.eu !== undefined, 'Has EU');
    assert(config.sources.regulatory_agencies.china !== undefined, 'Has China');
    assert(config.sources.regulatory_agencies.japan !== undefined, 'Has Japan');
    assert(config.sources.regulatory_agencies.korea !== undefined, 'Has Korea');
    assert(config.sources.international_organizations !== undefined, 'Has international orgs');
    assert(config.sources.industry_organizations !== undefined, 'Has industry orgs');

    // 统计RSS/API/Web源数量
    let rssCount = 0, apiCount = 0, webCount = 0;
    const crawlEngine = new CrawlEngine(config, db);
    rssCount = crawlEngine._getAllRSSSources().length;
    apiCount = crawlEngine._getAllAPISources().length;
    webCount = crawlEngine._getAllWebSources().length;

    console.log(`  RSS sources: ${rssCount}`);
    console.log(`  API sources: ${apiCount}`);
    console.log(`  Web sources: ${webCount}`);

    assert(rssCount > 0, `RSS sources found: ${rssCount}`);
    assert(apiCount > 0, `API sources found: ${apiCount}`);
    assert(webCount > 0, `Web sources found: ${webCount}`);

    // Test 8: AI Analyzer fallback
    console.log('\n📦 Test 8: AI Analyzer (fallback mode)');
    const analyzer = new AIAnalyzer({ apiKey: '' });
    const analysis = analyzer._fallbackAnalysis({
      content_hash: 'test_hash_123',
      id: 1,
      title: 'Test FDA Guidance Document',
      source_name: 'FDA Guidance Documents',
      source_url: 'https://www.fda.gov',
      source_link: 'https://www.fda.gov/test',
      category: 'guidance',
      language: 'en',
      summary: 'A new guidance document about clinical trials',
      published_date: new Date().toISOString()
    });

    assert(analysis.category === '法规指南类', `Category mapped correctly: ${analysis.category}`);
    assert(analysis.importance_level === 4, `Importance level set: ${analysis.importance_level}`);
    assert(analysis.country === 'US', `Country detected: ${analysis.country}`);
    assert(analysis.region === '北美', `Region detected: ${analysis.region}`);

  } catch (error) {
    console.error(`\n❌ Test error: ${error.message}`);
    console.error(error.stack);
    failed++;
  }

  // Cleanup
  if (db) db.close();

  console.log('\n========================================');
  console.log(`  Results: ${passed} passed, ${failed} failed`);
  console.log('========================================\n');

  return failed === 0;
}

test().then(success => {
  process.exit(success ? 0 : 1);
});
