package com.peakrush;

import org.springframework.beans.factory.InitializingBean;
import org.springframework.boot.sql.init.dependency.DependsOnDatabaseInitialization;
import org.springframework.dao.DataAccessException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

/** Additive migration for databases created before product categories existed. */
@Component
@DependsOnDatabaseInitialization
public class CatalogSchema implements InitializingBean {
 private final JdbcTemplate jdbc;
 public CatalogSchema(JdbcTemplate jdbc) { this.jdbc = jdbc; }
 private boolean hasCategory() {
  return jdbc.queryForObject("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='product' AND column_name='category'", Long.class) > 0;
 }
 @Override public void afterPropertiesSet() {
  if (hasCategory()) return;
  try {
   jdbc.execute("ALTER TABLE product ADD COLUMN category VARCHAR(32) NOT NULL DEFAULT '其他好物'");
  } catch (DataAccessException failure) {
   // A second instance may have completed the same migration while we waited for DDL.
   if (!hasCategory()) throw failure;
  }
 }
}
