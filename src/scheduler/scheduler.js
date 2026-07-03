/**
 * 定时任务调度器
 * 每12小时执行一次全量采集和分析
 */

const EventEmitter = require('events');

class Scheduler extends EventEmitter {
  constructor(crawlEngine, aiAnalyzer, db) {
    super();
    this.crawlEngine = crawlEngine;
    this.aiAnalyzer = aiAnalyzer;
    this.db = db;
    this.intervalHours = 12;
    this.timer = null;
    this.isRunning = false;
  }

  /**
   * 启动定时任务
   */
  start(intervalHours = 12) {
    this.intervalHours = intervalHours;
    const intervalMs = intervalHours * 60 * 60 * 1000;

    console.log(`[Scheduler] Starting scheduled crawl every ${intervalHours} hours`);
    console.log(`[Scheduler] Next run: ${new Date(Date.now() + intervalMs).toISOString()}`);

    // 立即执行一次
    this._executeCycle();

    // 设置定时器
    this.timer = setInterval(() => {
      this._executeCycle();
    }, intervalMs);
  }

  /**
   * 停止定时任务
   */
  stop() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
      console.log('[Scheduler] Stopped');
    }
  }

  /**
   * 手动触发一次采集
   */
  async triggerNow() {
    if (this.isRunning) {
      console.log('[Scheduler] Crawl already in progress, skipping');
      return null;
    }
    return this._executeCycle();
  }

  /**
   * 执行一次完整的采集-分析周期
   */
  async _executeCycle() {
    if (this.isRunning) {
      console.log('[Scheduler] Previous cycle still running, skipping');
      return null;
    }

    this.isRunning = true;
    const startTime = new Date().toISOString();
    this.emit('cycle:start', { startTime });

    let crawlResult = null;
    let analysisResult = null;
    let status = 'completed';
    let errorMessage = null;

    try {
      // Phase 1: 采集
      console.log('\n========================================');
      console.log('[Scheduler] PHASE 1: DATA COLLECTION');
      console.log('========================================\n');
      this.emit('phase:crawl:start');

      crawlResult = await this.crawlEngine.runFullCrawl();
      this.emit('phase:crawl:complete', crawlResult);

      // Phase 2: AI分析
      console.log('\n========================================');
      console.log('[Scheduler] PHASE 2: AI ANALYSIS');
      console.log('========================================\n');
      this.emit('phase:analysis:start');

      analysisResult = await this.aiAnalyzer.runAnalysis(this.db, 100);
      this.emit('phase:analysis:complete', analysisResult);

    } catch (error) {
      console.error(`[Scheduler] Cycle failed: ${error.message}`);
      status = 'failed';
      errorMessage = error.message;
      this.emit('cycle:error', { error: errorMessage });
    }

    const endTime = new Date().toISOString();

    // 保存日志
    try {
      this.db.saveCrawlLog({
        crawl_type: 'scheduled',
        start_time: startTime,
        end_time: endTime,
        total_items: crawlResult?.stats?.total || 0,
        rss_items: crawlResult?.stats?.rss || 0,
        api_items: crawlResult?.stats?.api || 0,
        web_items: crawlResult?.stats?.web || 0,
        duplicates_removed: crawlResult?.stats?.duplicates || 0,
        errors: crawlResult?.stats?.errors || 0,
        status: status,
        error_message: errorMessage
      });
    } catch (e) {
      console.error(`[Scheduler] Failed to save log: ${e.message}`);
    }

    this.isRunning = false;
    this.emit('cycle:complete', {
      startTime,
      endTime,
      status,
      crawlStats: crawlResult?.stats,
      analysisStats: analysisResult
    });

    console.log(`\n[Scheduler] Cycle ${status}. Next run in ${this.intervalHours} hours\n`);

    return { crawlResult, analysisResult, status };
  }
}

module.exports = Scheduler;
