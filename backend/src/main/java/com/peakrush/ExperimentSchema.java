package com.peakrush;

import org.springframework.beans.factory.InitializingBean;
import org.springframework.boot.sql.init.dependency.DependsOnDatabaseInitialization;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Additive migrations for databases created before experiment release versions and load modes existed. */
@Component
@DependsOnDatabaseInitialization
public class ExperimentSchema implements InitializingBean {
 private final JdbcTemplate jdbc;

 public ExperimentSchema(JdbcTemplate jdbc) { this.jdbc = jdbc; }

 private boolean hasColumn(String column) {
  return jdbc.queryForObject(
   "SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='experiment' AND column_name=?",
   Long.class,
   column) > 0;
 }

 private void ensureColumn(String column, String definition) {
  if (hasColumn(column)) return;
  try {
   jdbc.execute("ALTER TABLE experiment ADD COLUMN " + column + " " + definition);
  } catch (DataAccessException failure) {
   // A second instance may have completed the same migration while we waited for DDL.
   if (!hasColumn(column)) throw failure;
  }
 }

 @Override public void afterPropertiesSet() {
  ensureColumn("release_version", "VARCHAR(20) NOT NULL DEFAULT 'V5.2'");
  ensureColumn("load_mode", "VARCHAR(16) NOT NULL DEFAULT 'STEADY'");
  ensureColumn("target_rps", "INT NULL");
 }
}
