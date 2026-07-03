const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');

class DatabaseManager {
  constructor(dbPath = null) {
    this.dbPath = dbPath || path.join(__dirname, '..', '..', 'data', 'regulatory_monitor.db');
    this.db = null;
    this.SQL = null;
    this.saveTimer = null;
  }

  /**
   * 初始化数据库
   */
  async init() {
    // 确保目录存在
    const dir = path.dirname(this.dbPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    this.SQL = await initSqlJs();

    // 尝试从文件加载已有数据库
    if (fs.existsSync(this.dbPath)) {
      const buffer = fs.readFileSync(this.dbPath);
      this.db = new this.SQL.Database(buffer);
    } else {
      this.db = new this.SQL.Database();
    }

    this._createTables();
    this._saveToDisk();
    console.log(`[DB] Database initialized at ${this.dbPath}`);
    return this;
  }

  /**
   * 保存数据库到磁盘
   */
  _saveToDisk() {
    if (this.dbPath === ':memory:') return;
    if (this.saveTimer) clearTimeout(this.saveTimer);
    this.saveTimer = setTimeout(() => {
      const data = this.db.export();
      const buffer = Buffer.from(data);
      fs.writeFileSync(this.dbPath, buffer);
    }, 100);
  }

  /**
   * 同步保存数据库到磁盘
   */
  _saveToDiskSync() {
    if (this.dbPath === ':memory:') return;
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
      this.saveTimer = null;
    }
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  /**
   * 创建数据库表
   */
  _createTables() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS raw_items (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        content_hash TEXT UNIQUE NOT NULL,
        source_type TEXT NOT NULL,
        source_name TEXT NOT NULL,
        source_url TEXT,
        source_link TEXT,
        category TEXT,
        language TEXT DEFAULT 'en',
        title TEXT NOT NULL,
        title_cn TEXT DEFAULT '',
        summary TEXT DEFAULT '',
        full_content TEXT DEFAULT '',
        published_date TEXT,
        guid TEXT,
        authors TEXT DEFAULT '[]',
        tags TEXT DEFAULT '[]',
        raw_data TEXT,
        crawled_at TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);

    this.db.run('CREATE INDEX IF NOT EXISTS idx_raw_content_hash ON raw_items(content_hash)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_raw_source_type ON raw_items(source_type)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_raw_source_name ON raw_items(source_name)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_raw_published_date ON raw_items(published_date)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_raw_category ON raw_items(category)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_raw_crawled_at ON raw_items(crawled_at)');

    this.db.run(`
      CREATE TABLE IF NOT EXISTS regulatory_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        raw_item_id INTEGER,
        content_hash TEXT UNIQUE NOT NULL,
        title_original TEXT NOT NULL,
        title_cn TEXT DEFAULT '',
        summary_cn TEXT DEFAULT '',
        summary_en TEXT DEFAULT '',
        published_date TEXT,
        effective_date TEXT,
        deadline_date TEXT,
        country TEXT DEFAULT '',
        region TEXT DEFAULT '',
        organization TEXT NOT NULL,
        organization_en TEXT DEFAULT '',
        authors TEXT DEFAULT '[]',
        stakeholders TEXT DEFAULT '[]',
        background TEXT DEFAULT '',
        key_points TEXT DEFAULT '[]',
        full_content_extracted TEXT DEFAULT '',
        category TEXT NOT NULL,
        subcategory TEXT DEFAULT '',
        importance_level INTEGER DEFAULT 3,
        importance_reason TEXT DEFAULT '',
        impact_areas TEXT DEFAULT '[]',
        product_types TEXT DEFAULT '[]',
        therapeutic_areas TEXT DEFAULT '[]',
        related_events TEXT DEFAULT '[]',
        references_list TEXT DEFAULT '[]',
        tags TEXT DEFAULT '[]',
        attachments TEXT DEFAULT '[]',
        source_url TEXT,
        source_link TEXT,
        source_organization TEXT,
        original_language TEXT DEFAULT 'en',
        translation_status TEXT DEFAULT 'pending',
        ai_analyzed_at TEXT,
        ai_model TEXT DEFAULT '',
        confidence_score REAL DEFAULT 0.0,
        review_status TEXT DEFAULT 'pending',
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )
    `);

    this.db.run('CREATE INDEX IF NOT EXISTS idx_events_hash ON regulatory_events(content_hash)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_events_country ON regulatory_events(country)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_events_organization ON regulatory_events(organization)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_events_category ON regulatory_events(category)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_events_importance ON regulatory_events(importance_level)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_events_published_date ON regulatory_events(published_date)');
    this.db.run('CREATE INDEX IF NOT EXISTS idx_events_review_status ON regulatory_events(review_status)');

    this.db.run(`
      CREATE TABLE IF NOT EXISTS crawl_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        crawl_type TEXT NOT NULL,
        start_time TEXT NOT NULL,
        end_time TEXT,
        total_items INTEGER DEFAULT 0,
        rss_items INTEGER DEFAULT 0,
        api_items INTEGER DEFAULT 0,
        web_items INTEGER DEFAULT 0,
        duplicates_removed INTEGER DEFAULT 0,
        errors INTEGER DEFAULT 0,
        status TEXT DEFAULT 'running',
        error_message TEXT,
        created_at TEXT NOT NULL
      )
    `);

    this.db.run(`
      CREATE TABLE IF NOT EXISTS translation_cache (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        source_text_hash TEXT UNIQUE NOT NULL,
        source_text TEXT NOT NULL,
        source_language TEXT NOT NULL,
        target_language TEXT NOT NULL DEFAULT 'zh',
        translated_text TEXT NOT NULL,
        model_used TEXT DEFAULT '',
        created_at TEXT NOT NULL
      )
    `);
  }

  /**
   * 检查内容是否重复
   */
  checkDuplicate(hash) {
    const stmt = this.db.prepare('SELECT COUNT(*) as count FROM raw_items WHERE content_hash = ?');
    stmt.bind([hash]);
    let count = 0;
    if (stmt.step()) {
      const row = stmt.getAsObject();
      count = row.count;
    }
    stmt.free();
    return count > 0;
  }

  /**
   * 批量保存原始数据
   */
  saveRawItems(items) {
    let inserted = 0;
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT OR IGNORE INTO raw_items (
        content_hash, source_type, source_name, source_url, source_link,
        category, language, title, title_cn, summary, full_content,
        published_date, guid, authors, tags, raw_data, crawled_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    for (const item of items) {
      stmt.bind([
        item.content_hash,
        item.source_type,
        item.source_name,
        item.source_url || '',
        item.source_link || '',
        item.category || '',
        item.language || 'en',
        item.title || '',
        item.title_cn || '',
        item.summary || '',
        item.full_content || '',
        item.published_date || now,
        item.guid || '',
        JSON.stringify(item.authors || []),
        JSON.stringify(item.categories || []),
        item.raw_data || JSON.stringify(item),
        item.crawled_at || now,
        now
      ]);
      stmt.step(); // INSERT 总是返回 false（没有结果行）
      inserted++;
      stmt.reset();
    }
    stmt.free();
    this._saveToDisk();
    return inserted;
  }

  /**
   * 获取未分析的原始数据
   */
  getUnanalyzedItems(limit = 100) {
    const results = [];
    const stmt = this.db.prepare(`
      SELECT r.* FROM raw_items r
      LEFT JOIN regulatory_events e ON r.content_hash = e.content_hash
      WHERE e.id IS NULL
      ORDER BY r.published_date DESC
      LIMIT ?
    `);
    stmt.bind([limit]);

    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }

  /**
   * 保存分析后的事件
   */
  saveRegulatoryEvent(event) {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO regulatory_events (
        raw_item_id, content_hash,
        title_original, title_cn, summary_cn, summary_en,
        published_date, effective_date, deadline_date,
        country, region, organization, organization_en,
        authors, stakeholders,
        background, key_points, full_content_extracted,
        category, subcategory, importance_level, importance_reason,
        impact_areas, product_types, therapeutic_areas,
        related_events, references_list, tags,
        attachments,
        source_url, source_link, source_organization,
        original_language, translation_status,
        ai_analyzed_at, ai_model, confidence_score, review_status,
        updated_at, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    stmt.bind([
      event.raw_item_id || null,
      event.content_hash,
      event.title_original || '',
      event.title_cn || '',
      event.summary_cn || '',
      event.summary_en || '',
      event.published_date || null,
      event.effective_date || null,
      event.deadline_date || null,
      event.country || '',
      event.region || '',
      event.organization || '',
      event.organization_en || '',
      JSON.stringify(event.authors || []),
      JSON.stringify(event.stakeholders || []),
      event.background || '',
      JSON.stringify(event.key_points || []),
      event.full_content_extracted || '',
      event.category || '',
      event.subcategory || '',
      event.importance_level || 3,
      event.importance_reason || '',
      JSON.stringify(event.impact_areas || []),
      JSON.stringify(event.product_types || []),
      JSON.stringify(event.therapeutic_areas || []),
      JSON.stringify(event.related_events || []),
      JSON.stringify(event.references_list || []),
      JSON.stringify(event.tags || []),
      JSON.stringify(event.attachments || []),
      event.source_url || '',
      event.source_link || '',
      event.source_organization || '',
      event.original_language || 'en',
      event.translation_status || 'pending',
      event.ai_analyzed_at || now,
      event.ai_model || '',
      event.confidence_score || 0.0,
      event.review_status || 'pending',
      now,
      now
    ]);

    stmt.step();
    stmt.free();
    this._saveToDisk();
    return { changes: 1 };
  }

  /**
   * 保存爬取日志
   */
  saveCrawlLog(log) {
    const now = new Date().toISOString();
    const stmt = this.db.prepare(`
      INSERT INTO crawl_logs (
        crawl_type, start_time, end_time, total_items, rss_items,
        api_items, web_items, duplicates_removed, errors, status, error_message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.bind([
      log.crawl_type,
      log.start_time,
      log.end_time || null,
      log.total_items || 0,
      log.rss_items || 0,
      log.api_items || 0,
      log.web_items || 0,
      log.duplicates_removed || 0,
      log.errors || 0,
      log.status || 'completed',
      log.error_message || null,
      now
    ]);
    stmt.step();
    stmt.free();
    this._saveToDisk();
  }

  /**
   * 查询事件列表（支持筛选）
   */
  queryEvents(filters = {}) {
    let sql = 'SELECT * FROM regulatory_events WHERE 1=1';
    const params = [];

    if (filters.country) {
      sql += ' AND country = ?';
      params.push(filters.country);
    }
    if (filters.organization) {
      sql += ' AND organization = ?';
      params.push(filters.organization);
    }
    if (filters.category) {
      sql += ' AND category = ?';
      params.push(filters.category);
    }
    if (filters.importance_level) {
      sql += ' AND importance_level >= ?';
      params.push(filters.importance_level);
    }
    if (filters.review_status) {
      sql += ' AND review_status = ?';
      params.push(filters.review_status);
    }
    if (filters.search) {
      sql += ' AND (title_cn LIKE ? OR title_original LIKE ? OR summary_cn LIKE ?)';
      const searchTerm = `%${filters.search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }
    if (filters.date_from) {
      sql += ' AND published_date >= ?';
      params.push(filters.date_from);
    }
    if (filters.date_to) {
      sql += ' AND published_date <= ?';
      params.push(filters.date_to);
    }

    sql += ' ORDER BY published_date DESC';

    if (filters.limit) {
      sql += ' LIMIT ?';
      params.push(filters.limit);
    }
    if (filters.offset) {
      sql += ' OFFSET ?';
      params.push(filters.offset);
    }

    const stmt = this.db.prepare(sql);
    stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }

  /**
   * 获取统计信息
   */
  getStats() {
    const stats = {};

    stats.totalEvents = this._getSingleCount('SELECT COUNT(*) as count FROM regulatory_events');
    stats.byCountry = this._queryAll('SELECT country, COUNT(*) as count FROM regulatory_events GROUP BY country ORDER BY count DESC');
    stats.byCategory = this._queryAll('SELECT category, COUNT(*) as count FROM regulatory_events GROUP BY category ORDER BY count DESC');
    stats.byImportance = this._queryAll('SELECT importance_level, COUNT(*) as count FROM regulatory_events GROUP BY importance_level ORDER BY importance_level');
    stats.byOrganization = this._queryAll('SELECT organization, COUNT(*) as count FROM regulatory_events GROUP BY organization ORDER BY count DESC LIMIT 20');
    stats.recentCrawls = this._queryAll('SELECT * FROM crawl_logs ORDER BY start_time DESC LIMIT 10');

    return stats;
  }

  _getSingleCount(sql, params = []) {
    const stmt = this.db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    let count = 0;
    if (stmt.step()) {
      count = stmt.getAsObject().count;
    }
    stmt.free();
    return count;
  }

  _queryAll(sql, params = []) {
    const stmt = this.db.prepare(sql);
    if (params.length > 0) stmt.bind(params);
    const results = [];
    while (stmt.step()) {
      results.push(stmt.getAsObject());
    }
    stmt.free();
    return results;
  }

  /**
   * 关闭数据库连接
   */
  close() {
    if (this.db) {
      this._saveToDiskSync();
      this.db.close();
      this.db = null;
    }
  }
}

module.exports = DatabaseManager;
