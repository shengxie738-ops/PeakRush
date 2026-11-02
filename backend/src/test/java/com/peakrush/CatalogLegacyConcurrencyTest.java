package com.peakrush;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.DataSourceTransactionManager;
import org.springframework.jdbc.datasource.DriverManagerDataSource;

import java.util.Map;
import java.util.Objects;
import java.util.UUID;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

@EnabledIfEnvironmentVariable(named = "PEAKRUSH_INTEGRATION_TESTS", matches = "true")
class CatalogLegacyConcurrencyTest {
 private DriverManagerDataSource dataSource;
 private Store store;
 private long productId;

 @BeforeEach void createOwnedProduct() {
  dataSource = new DriverManagerDataSource(
    System.getenv().getOrDefault("DB_URL", "jdbc:mysql://127.0.0.1:13306/peakrush?serverTimezone=UTC"),
    System.getenv().getOrDefault("DB_USER", "peakrush"),
    Objects.requireNonNull(System.getenv("DB_PASSWORD"), "Set DB_PASSWORD for integration tests"));
  var jdbc = new JdbcTemplate(dataSource);
  new CatalogSchema(jdbc).afterPropertiesSet();
  store = new Store(jdbc, new DataSourceTransactionManager(dataSource), new Json(new ObjectMapper()));
  productId = Json.number(store.saveProduct(null, body("居家生活")).get("id"));
 }

 @AfterEach void removeOwnedProduct() {
  if (productId != 0) store.jdbc.update("DELETE FROM product WHERE id=?", productId);
 }

 private Map<String, Object> body(String category) {
  var body = Json.map("name", "Concurrent catalog " + UUID.randomUUID(), "description", "isolated fixture",
    "imageUrl", "", "originalPrice", 199);
  if (category != null) body.put("category", category);
  return body;
 }

 @Test void omittedCategoryPreservesTheValueCommittedByAnotherWriter() throws Exception {
  // The old request reaches its UPDATE after preparing any category snapshot.
  var readyToUpdate = new CountDownLatch(1);
  var allowUpdate = new CountDownLatch(1);
  var pausedJdbc = new JdbcTemplate(dataSource) {
   @Override public int update(String sql, Object... args) {
    if (sql.startsWith("UPDATE product SET")) {
     readyToUpdate.countDown();
     try {
      if (!allowUpdate.await(10, TimeUnit.SECONDS)) throw new AssertionError("Timed out waiting for concurrent category update");
     } catch (InterruptedException interrupted) {
      Thread.currentThread().interrupt();
      throw new AssertionError(interrupted);
     }
    }
    return super.update(sql, args);
   }
  };
  var legacyWriter = new Store(pausedJdbc, new DataSourceTransactionManager(dataSource), null);
  var executor = Executors.newSingleThreadExecutor();
  try {
   var legacyUpdate = executor.submit(() -> legacyWriter.saveProduct(productId, body(null)));
   assertTrue(readyToUpdate.await(10, TimeUnit.SECONDS), "Legacy request must reach its UPDATE");
   assertEquals("旅行出行", store.saveProduct(productId, body("旅行出行")).get("category"));
   allowUpdate.countDown();
   assertEquals("旅行出行", legacyUpdate.get(10, TimeUnit.SECONDS).get("category"));
   assertEquals("旅行出行", store.jdbc.queryForObject("SELECT category FROM product WHERE id=?", String.class, productId));
  } finally {
   allowUpdate.countDown();
   executor.shutdownNow();
   assertTrue(executor.awaitTermination(10, TimeUnit.SECONDS), "Legacy writer must finish before fixture cleanup");
  }
 }
}
