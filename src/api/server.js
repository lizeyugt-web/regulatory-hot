const Fastify = require('fastify');
const cors = require('@fastify/cors');
const path = require('path');

class APIServer {
  constructor(db, scheduler, options = {}) {
    this.db = db;
    this.scheduler = scheduler;
    this.port = options.port || 3000;
    this.host = options.host || '0.0.0.0';

    this.app = Fastify({
      logger: {
        level: 'info',
        transport: {
          target: 'pino-pretty',
          options: { colorize: true }
        }
      }
    });
  }

  async init() {
    // CORS
    await this.app.register(cors, {
      origin: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
    });

    // 静态文件（前端）
    await this.app.register(require('@fastify/static'), {
      root: path.join(__dirname, '..', 'web', 'public'),
      prefix: '/'
    });

    this._registerRoutes();

    return this;
  }

  _registerRoutes() {
    // ==================== 健康检查 ====================
    this.app.get('/api/health', async () => ({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime()
    }));

    // ==================== 统计概览 ====================
    this.app.get('/api/stats', async () => {
      return this.db.getStats();
    });

    // ==================== 事件列表 ====================
    this.app.get('/api/events', async (request) => {
      const {
        country,
        organization,
        category,
        importance_level,
        search,
        date_from,
        date_to,
        limit = 50,
        offset = 0,
        review_status = 'published'
      } = request.query;

      const filters = {
        country,
        organization,
        category,
        importance_level: importance_level ? parseInt(importance_level) : undefined,
        search,
        date_from,
        date_to,
        limit: parseInt(limit),
        offset: parseInt(offset),
        review_status
      };

      const events = this.db.queryEvents(filters);
      const total = events.length;

      return {
        total,
        limit: filters.limit,
        offset: filters.offset,
        data: events.map(e => ({
          ...e,
          authors: JSON.parse(e.authors || '[]'),
          stakeholders: JSON.parse(e.stakeholders || '[]'),
          key_points: JSON.parse(e.key_points || '[]'),
          impact_areas: JSON.parse(e.impact_areas || '[]'),
          product_types: JSON.parse(e.product_types || '[]'),
          therapeutic_areas: JSON.parse(e.therapeutic_areas || '[]'),
          tags: JSON.parse(e.tags || '[]'),
          references_list: JSON.parse(e.references_list || '[]'),
          attachments: JSON.parse(e.attachments || '[]')
        }))
      };
    });

    // ==================== 事件详情 ====================
    this.app.get('/api/events/:id', async (request) => {
      const { id } = request.params;
      const stmt = this.db.db.prepare('SELECT * FROM regulatory_events WHERE id = ?');
      const event = stmt.get(id);

      if (!event) {
        return { error: 'Event not found', code: 404 };
      }

      return {
        ...event,
        authors: JSON.parse(event.authors || '[]'),
        stakeholders: JSON.parse(event.stakeholders || '[]'),
        key_points: JSON.parse(event.key_points || '[]'),
        impact_areas: JSON.parse(event.impact_areas || '[]'),
        product_types: JSON.parse(event.product_types || '[]'),
        therapeutic_areas: JSON.parse(event.therapeutic_areas || '[]'),
        tags: JSON.parse(event.tags || '[]'),
        references_list: JSON.parse(event.references_list || '[]'),
        attachments: JSON.parse(event.attachments || '[]')
      };
    });

    // ==================== 按国家/地区聚合 ====================
    this.app.get('/api/events/by-country', async () => {
      return this.db.db.prepare(`
        SELECT country, region, COUNT(*) as count
        FROM regulatory_events
        WHERE review_status = 'published'
        GROUP BY country
        ORDER BY count DESC
      `).all();
    });

    // ==================== 按组织聚合 ====================
    this.app.get('/api/events/by-organization', async () => {
      return this.db.db.prepare(`
        SELECT organization, organization_en, country, COUNT(*) as count
        FROM regulatory_events
        WHERE review_status = 'published'
        GROUP BY organization
        ORDER BY count DESC
        LIMIT 50
      `).all();
    });

    // ==================== 按分类聚合 ====================
    this.app.get('/api/events/by-category', async () => {
      return this.db.db.prepare(`
        SELECT category, COUNT(*) as count,
               AVG(importance_level) as avg_importance
        FROM regulatory_events
        WHERE review_status = 'published'
        GROUP BY category
        ORDER BY count DESC
      `).all();
    });

    // ==================== 时间线数据 ====================
    this.app.get('/api/events/timeline', async (request) => {
      const { days = 30 } = request.query;
      return this.db.db.prepare(`
        SELECT DATE(published_date) as date, COUNT(*) as count,
               AVG(importance_level) as avg_importance
        FROM regulatory_events
        WHERE review_status = 'published'
          AND published_date >= DATE('now', '-' || ? || ' days')
        GROUP BY DATE(published_date)
        ORDER BY date ASC
      `).all(parseInt(days));
    });

    // ==================== 高重要性事件 ====================
    this.app.get('/api/events/high-importance', async (request) => {
      const { limit = 20 } = request.query;
      return this.db.db.prepare(`
        SELECT * FROM regulatory_events
        WHERE review_status = 'published' AND importance_level >= 4
        ORDER BY published_date DESC
        LIMIT ?
      `).all(parseInt(limit));
    });

    // ==================== 触发手动采集 ====================
    this.app.post('/api/crawl/trigger', async () => {
      if (this.scheduler.isRunning) {
        return { status: 'already_running', message: '采集任务正在进行中' };
      }
      // 异步触发
      this.scheduler.triggerNow().then(result => {
        console.log('[API] Manual crawl completed');
      });
      return { status: 'triggered', message: '采集任务已触发' };
    });

    // ==================== 采集状态 ====================
    this.app.get('/api/crawl/status', async () => {
      return {
        is_running: this.scheduler.isRunning,
        next_scheduled: this.scheduler.timer ? 'scheduled' : 'stopped',
        interval_hours: this.scheduler.intervalHours
      };
    });

    // ==================== 最近采集日志 ====================
    this.app.get('/api/crawl/logs', async (request) => {
      const { limit = 10 } = request.query;
      return this.db.db.prepare(
        'SELECT * FROM crawl_logs ORDER BY start_time DESC LIMIT ?'
      ).all(parseInt(limit));
    });

    // ==================== 搜索 ====================
    this.app.get('/api/search', async (request) => {
      const { q, limit = 20 } = request.query;
      if (!q) return { total: 0, data: [] };

      const stmt = this.db.db.prepare(`
        SELECT id, title_original, title_cn, summary_cn, organization,
               category, importance_level, published_date, country, source_link
        FROM regulatory_events
        WHERE review_status = 'published'
          AND (title_cn LIKE ? OR title_original LIKE ? OR summary_cn LIKE ?
               OR summary_en LIKE ? OR organization LIKE ? OR background LIKE ?)
        ORDER BY published_date DESC
        LIMIT ?
      `);

      const searchTerm = `%${q}%`;
      const results = stmt.all(searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, searchTerm, parseInt(limit));

      return { total: results.length, data: results };
    });
  }

  async start() {
    await this.app.listen({ port: this.port, host: this.host });
    console.log(`[API] Server running at http://${this.host}:${this.port}`);
  }

  async stop() {
    await this.app.close();
    console.log('[API] Server stopped');
  }
}

module.exports = APIServer;
