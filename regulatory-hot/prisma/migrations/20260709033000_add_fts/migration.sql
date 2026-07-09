-- FTS5 全文检索索引
CREATE VIRTUAL TABLE IF NOT EXISTS events_fts USING fts5(
  titleCn, summaryCn, contentCn,
  content='events',
  content_rowid='rowid',
  tokenize='unicode61 remove_diacritics 2'
);

-- 触发器：INSERT 自动同步
CREATE TRIGGER IF NOT EXISTS events_fts_ai AFTER INSERT ON events BEGIN
  INSERT INTO events_fts(rowid, titleCn, summaryCn, contentCn)
  VALUES (new.rowid, new.titleCn, new.summaryCn, new.contentCn);
END;

-- 触发器：UPDATE 自动同步
CREATE TRIGGER IF NOT EXISTS events_fts_au AFTER UPDATE ON events BEGIN
  DELETE FROM events_fts WHERE rowid = old.rowid;
  INSERT INTO events_fts(rowid, titleCn, summaryCn, contentCn)
  VALUES (new.rowid, new.titleCn, new.summaryCn, new.contentCn);
END;

-- 触发器：DELETE 自动同步
CREATE TRIGGER IF NOT EXISTS events_fts_ad AFTER DELETE ON events BEGIN
  DELETE FROM events_fts WHERE rowid = old.rowid;
END;

-- 初始数据填充
INSERT INTO events_fts(rowid, titleCn, summaryCn, contentCn)
SELECT rowid, titleCn, summaryCn, contentCn FROM events;
