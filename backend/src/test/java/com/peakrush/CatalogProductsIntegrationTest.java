package com.peakrush;

import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;

@EnabledIfEnvironmentVariable(named="PEAKRUSH_INTEGRATION_TESTS",matches="true")
class CatalogProductsIntegrationTest {
 Store db;
 final List<Long> products=new ArrayList<>(), activities=new ArrayList<>();
 @BeforeEach void connect() {
  var ds=new DriverManagerDataSource(System.getenv().getOrDefault("DB_URL","jdbc:mysql://127.0.0.1:13306/peakrush?serverTimezone=UTC"),System.getenv().getOrDefault("DB_USER","peakrush"),Objects.requireNonNull(System.getenv("DB_PASSWORD")));
  var jdbc=new JdbcTemplate(ds);
  new CatalogSchema(jdbc).afterPropertiesSet();
  db=new Store(jdbc,new DataSourceTransactionManager(ds),new Json(new ObjectMapper().findAndRegisterModules()));
 }
 @AfterEach void removeOwnedFixtures() {
  if(db==null)return;
  for(long id:activities){db.jdbc.update("DELETE FROM seckill_item WHERE activity_id=?",id);db.jdbc.update("DELETE FROM activity WHERE id=?",id);}
  for(long id:products)db.jdbc.update("DELETE FROM product WHERE id=?",id);
 }
 Map<String,Object> create(String category) {
  var body=Json.map("name","Catalog integration "+UUID.randomUUID(),"description","isolated fixture","imageUrl","/assets/products/desk-lamp.png","originalPrice",199);
  if(category!=null)body.put("category",category);
  var result=db.saveProduct(null,body);products.add(Json.number(result.get("id")));return result;
 }
 @Test void categoryPersistsAndLegacyUpdatesKeepIt() {
  var created=create("居家生活");
  assertEquals("居家生活",created.get("category"));
  var update=Json.map("name",created.get("name"),"description","updated","imageUrl",created.get("imageUrl"),"originalPrice",199);
  assertEquals("居家生活",db.saveProduct(Json.number(created.get("id")),update).get("category"));
  update.put("category","旅行出行");
  assertEquals("旅行出行",db.saveProduct(Json.number(created.get("id")),update).get("category"));
 }
 @Test void legacyCreationDefaultsAndActivityProjectsCategory() {
  assertEquals("其他好物",create(null).get("category"));
  var product=create("居家生活");
  var activity=db.saveActivity(null,Json.map("name","Catalog integration activity","description","isolated","startTime",Instant.now().toString(),"endTime",Instant.now().plusSeconds(60).toString(),"architectureVersion","V3","items",List.of(Json.map("productId",product.get("id"),"seckillPrice",99,"totalStock",2,"limitPerUser",1))));
  activities.add(Json.number(activity.get("id")));
  var item=(Map<?,?>)((List<?>)activity.get("items")).get(0);
  assertEquals("居家生活",item.get("category"));
  long count=db.jdbc.queryForObject("SELECT COUNT(*) FROM product",Long.class);
  new CatalogSchema(db.jdbc).afterPropertiesSet();
  assertEquals(count,db.jdbc.queryForObject("SELECT COUNT(*) FROM product",Long.class));
 }
}
