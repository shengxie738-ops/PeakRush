package com.peakrush;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.core.io.ClassPathResource;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DriverManagerDataSource;
import org.springframework.jdbc.datasource.init.ResourceDatabasePopulator;

import java.net.URI;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.CyclicBarrier;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.*;

/** Only creates and drops its own random databases on an explicitly selected test server. */
@EnabledIfEnvironmentVariable(named = "PEAKRUSH_MIGRATION_TESTS", matches = "true")
class CatalogLegacyMigrationTest {
 @Test void legacyUpgradePreservesBusinessRowsAndCanRunAgain() {
  try (var database = new IsolatedDatabase()) {
   seedLegacyRows(database);
   var before = snapshot(database.jdbc);
   database.populate("schema.sql");
   assertEquals(0L, categoryColumns(database.jdbc), "CREATE TABLE IF NOT EXISTS must leave the old product structure intact");

   var migration = new CatalogSchema(database.jdbc);
   migration.afterPropertiesSet();
   migration.afterPropertiesSet();

   assertMigrated(database.jdbc, before);
  }
 }

 @Test void concurrentStartupMigrationsBothCompleteWithoutLosingLegacyData() throws Exception {
  try (var database = new IsolatedDatabase()) {
   seedLegacyRows(database);
   var before = snapshot(database.jdbc);
   var bothObservedMissingColumn = new CyclicBarrier(2);
   var workers = Executors.newFixedThreadPool(2);
   try {
    var first = workers.submit(() -> new CatalogSchema(database.migrationJdbc(bothObservedMissingColumn)).afterPropertiesSet());
    var second = workers.submit(() -> new CatalogSchema(database.migrationJdbc(bothObservedMissingColumn)).afterPropertiesSet());
    first.get(30, TimeUnit.SECONDS);
    second.get(30, TimeUnit.SECONDS);
   } finally {
    workers.shutdownNow();
    assertTrue(workers.awaitTermination(30, TimeUnit.SECONDS), "Migration workers must stop before dropping their database");
   }
   new CatalogSchema(database.jdbc).afterPropertiesSet();
   assertMigrated(database.jdbc, before);
  }
 }

 private static long categoryColumns(JdbcTemplate jdbc) {
  return jdbc.queryForObject("SELECT COUNT(*) FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='product' AND column_name='category'", Long.class);
 }

 private static void assertMigrated(JdbcTemplate jdbc, Map<String, List<Map<String, Object>>> before) {
  assertEquals(1L, categoryColumns(jdbc));
  assertEquals("其他好物", jdbc.queryForObject("SELECT category FROM product WHERE id=1", String.class));
  assertEquals(before, snapshot(jdbc), "All pre-existing business columns and rows must survive migration unchanged");
  assertEquals(8, jdbc.queryForObject("SELECT available_stock FROM seckill_item WHERE id=1", Integer.class));
  assertEquals(2, jdbc.queryForObject("SELECT quantity FROM seckill_order WHERE id=1 AND status='CREATED'", Integer.class));
  assertEquals(10, jdbc.queryForObject("SELECT i.available_stock + SUM(o.quantity) FROM seckill_item i JOIN seckill_order o ON o.item_id=i.id WHERE i.id=1 GROUP BY i.available_stock", Integer.class));
 }

 private static Map<String, List<Map<String, Object>>> snapshot(JdbcTemplate jdbc) {
  var rows = new LinkedHashMap<String, List<Map<String, Object>>>();
  rows.put("product", jdbc.queryForList("SELECT id,name,description,image_url,original_price,active FROM product ORDER BY id"));
  for (String table : List.of("app_user", "activity", "seckill_item", "seckill_order", "payment_record", "stock_change_log", "recovery_outbox", "dead_letter_record", "experiment")) {
   rows.put(table, jdbc.queryForList("SELECT * FROM " + table + " ORDER BY id"));
  }
  rows.put("seckill_request", jdbc.queryForList("SELECT * FROM seckill_request ORDER BY request_id"));
  return rows;
 }

 private static void seedLegacyRows(IsolatedDatabase database) {
  // Exact pre-category schema from repository commit 415a6f8, retained as a test fixture.
  database.populate("legacy-schema.sql");
  var jdbc = database.jdbc;
  jdbc.update("INSERT INTO app_user(id,username,password_hash,role) VALUES(1,'legacy-user','legacy-hash','USER')");
  jdbc.update("INSERT INTO product(id,name,description,image_url,original_price,active) VALUES(1,'旧商品','existing catalog','/assets/legacy.png',199.00,TRUE)");
  jdbc.update("INSERT INTO activity(id,name,description,start_time,end_time,status,architecture_version) VALUES(1,'旧V3活动','existing activity','2026-01-01 00:00:00','2027-01-01 00:00:00','RUNNING',3)");
  jdbc.update("INSERT INTO seckill_item(id,activity_id,product_id,seckill_price,total_stock,available_stock,limit_per_user,generation,version) VALUES(1,1,1,99.00,10,8,2,'legacy-generation',4)");
  jdbc.update("INSERT INTO seckill_request(request_id,user_id,activity_id,item_id,quantity,payload_hash,generation,redis_reserved,status,reason,order_id,state_version,accepted_at) VALUES('legacy-request',1,1,1,2,'legacy-payload','legacy-generation',TRUE,'SUCCESS',NULL,1,2,'2026-01-01 00:01:00')");
  jdbc.update("INSERT INTO seckill_order(id,request_id,user_id,activity_id,item_id,quantity,unit_price,total_amount,status,created_at,expire_time,paid_at) VALUES(1,'legacy-request',1,1,1,2,99.00,198.00,'CREATED','2026-01-01 00:01:00','2026-01-01 00:16:00',NULL)");
  jdbc.update("INSERT INTO stock_change_log(id,operation_key,request_id,item_id,order_id,change_type,delta) VALUES(1,'legacy-allocate','legacy-request',1,1,'ALLOCATE',-2)");
  jdbc.update("INSERT INTO recovery_outbox(id,operation_key,request_id,payload,status,attempts,next_retry_at,last_error) VALUES(1,'legacy-compensation','legacy-request','{\"generation\":\"legacy-generation\"}','PENDING',2,'2026-01-01 00:02:00','retry preserved')");
  jdbc.update("INSERT INTO dead_letter_record(id,request_id,payload,reason,status,attempts) VALUES(1,'legacy-dead-letter','legacy payload','legacy failure','OPEN',1)");
  jdbc.update("INSERT INTO experiment(id,name,architecture_version,concurrency_count,duration_seconds,stock,notes,results_json) VALUES(1,'legacy-experiment',3,100,30,10,'retain result','{\"success\":10}')");
 }

 private static final class IsolatedDatabase implements AutoCloseable {
  private final String name = "peakrush_review_" + UUID.randomUUID().toString().replace("-", "");
  private final JdbcTemplate admin;
  private final DriverManagerDataSource dataSource;
  private final JdbcTemplate jdbc;

  private IsolatedDatabase() {
   String url = Objects.requireNonNull(System.getenv("REVIEW_DB_ADMIN_URL"), "Set REVIEW_DB_ADMIN_URL to a dedicated test server with an empty database path");
   if (!url.startsWith("jdbc:mysql://")) throw new IllegalArgumentException("REVIEW_DB_ADMIN_URL must be a MySQL JDBC URL");
   URI uri = URI.create(url.substring("jdbc:".length()));
   if (uri.getPath() != null && !uri.getPath().isEmpty() && !uri.getPath().equals("/")) {
    throw new IllegalArgumentException("REVIEW_DB_ADMIN_URL must have an empty database path; migration tests only use randomly created databases");
   }
   String user = System.getenv().getOrDefault("DB_USER", "peakrush");
   String password = Objects.requireNonNull(System.getenv("DB_PASSWORD"), "Set DB_PASSWORD for migration tests");
   admin = new JdbcTemplate(new DriverManagerDataSource(url, user, password));
   int query = url.indexOf('?');
   String base = query < 0 ? url : url.substring(0, query);
   String databaseUrl = (base.endsWith("/") ? base : base + "/") + name + (query < 0 ? "" : url.substring(query));
   dataSource = new DriverManagerDataSource(databaseUrl, user, password);
   jdbc = new JdbcTemplate(dataSource);
   admin.execute("CREATE DATABASE `" + name + "` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
  }

  private void populate(String resource) {
   var populator = new ResourceDatabasePopulator(new ClassPathResource(resource));
   populator.setSqlScriptEncoding("UTF-8");
   populator.execute(dataSource);
  }

  private JdbcTemplate migrationJdbc(CyclicBarrier barrier) {
   return new JdbcTemplate(dataSource) {
    @Override public <T> T queryForObject(String sql, Class<T> type) {
     T result = super.queryForObject(sql, type);
     if (sql.contains("information_schema.columns") && Long.valueOf(0).equals(result)) {
      try {
       barrier.await(10, TimeUnit.SECONDS);
      } catch (Exception failure) {
       throw new AssertionError("Both migration instances must observe the old schema before ALTER", failure);
      }
     }
     return result;
    }
   };
  }

  @Override public void close() {
   admin.execute("DROP DATABASE `" + name + "`");
  }
 }
}
