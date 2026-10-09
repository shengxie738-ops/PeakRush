package com.peakrush;

import org.junit.jupiter.api.Test;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.transaction.PlatformTransactionManager;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ProductCategoryTest {
 private final Store store = new Store(mock(JdbcTemplate.class), mock(PlatformTransactionManager.class), null);

 @Test void productsExposeTheirCategory() {
  var product = store.product(Json.map("id",1,"name","台灯","category","居家生活"));
  assertEquals("居家生活", product.get("category"));
 }

 @Test void legacyProductsHaveAUsableCategory() {
  assertEquals("其他好物", store.product(Json.map("id",1,"name","旧商品")).get("category"));
 }

 @Test void unsupportedCategoriesAreRejectedBeforeWriting() {
  assertThrows(ApiException.class, () -> store.saveProduct(null, Json.map("name","测试","imageUrl","","originalPrice",10,"category","unknown")));
  assertThrows(ApiException.class, () -> Store.category("数码影音".repeat(100)));
 }

 @Test void supportedCategoriesAndLegacyDefaultAreAccepted() {
  for (String category : new String[]{"数码影音","居家生活","运动户外","旅行出行","其他好物"}) assertEquals(category, Store.category(category));
  assertEquals("其他好物", Store.category(null));
 }
}
