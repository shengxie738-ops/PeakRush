package com.peakrush;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.jdbc.datasource.*;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
@EnabledIfEnvironmentVariable(named="PEAKRUSH_INTEGRATION_TESTS",matches="true")
class MySqlTransactionsTest {
 Store db;Orders orders;long aid,iid,pid;String generation;
 @BeforeEach void create(){
  String url=System.getenv().getOrDefault("DB_URL","jdbc:mysql://127.0.0.1:13306/peakrush?serverTimezone=UTC");
  if(!url.contains("forceConnectionTimeZoneToSession="))url+=(url.contains("?")?"&":"?")+"forceConnectionTimeZoneToSession=true";
  var ds=new DriverManagerDataSource(url,System.getenv().getOrDefault("DB_USER","peakrush"),Objects.requireNonNull(System.getenv("DB_PASSWORD"),"Set DB_PASSWORD for integration tests"));
  var jdbc=new JdbcTemplate(ds);var json=new Json(new ObjectMapper().findAndRegisterModules());db=new Store(jdbc,new DataSourceTransactionManager(ds),json);orders=new Orders(db,json,900);
  pid=Json.number(db.saveProduct(null,Json.map("name","Integration stock test","description","isolated test","imageUrl","","originalPrice",10)).get("id"));
  aid=Json.number(db.saveActivity(null,Json.map("name","Integration transaction "+System.nanoTime(),"description","test","startTime",Instant.now().minusSeconds(60).toString(),"endTime",Instant.now().plusSeconds(3600).toString(),"architectureVersion","V1","items",List.of(Json.map("productId",pid,"seckillPrice",1,"totalStock",10,"limitPerUser",1)))).get("id"));
  db.jdbc.update("UPDATE activity SET status='RUNNING' WHERE id=?",aid);
  var item=db.one("SELECT * FROM seckill_item WHERE activity_id=?",aid);iid=Json.number(item.get("id"));generation=String.valueOf(item.get("generation"));
 }
 @AfterEach void remove(){
  if(db==null||iid==0)return;
  db.jdbc.update("DELETE p FROM payment_record p JOIN seckill_order o ON p.order_id=o.id WHERE o.item_id=?",iid);
  db.jdbc.update("DELETE b FROM recovery_outbox b JOIN seckill_request r ON b.request_id=r.request_id WHERE r.item_id=?",iid);
  db.jdbc.update("DELETE FROM stock_change_log WHERE item_id=?",iid);
  db.jdbc.update("DELETE FROM seckill_order WHERE item_id=?",iid);
  db.jdbc.update("DELETE FROM seckill_request WHERE item_id=?",iid);
  db.jdbc.update("DELETE FROM seckill_item WHERE id=?",iid);db.jdbc.update("DELETE FROM activity WHERE id=?",aid);db.jdbc.update("DELETE FROM product WHERE id=?",pid);
 }
 PurchaseEvent event(int request,int user){return new PurchaseEvent(aid+"."+iid+"."+String.format("%032x",request),user,aid,iid,1,"payload-"+request,generation,1,System.currentTimeMillis(),false);}
 @Test void realMySqlConcurrentConditionalStockHasExactlyTenWinners()throws Exception{
  ExecutorService workers=Executors.newFixedThreadPool(12);
  try{List<Future<Map<String,Object>>> jobs=new ArrayList<>();for(int n=1;n<=100;n++){int k=n;jobs.add(workers.submit(()->orders.process(event(k,k))));}
   long won=0;for(var job:jobs)if("SUCCESS".equals(job.get(20,TimeUnit.SECONDS).get("status")))won++;
   assertEquals(10,won);assertEquals(0L,db.jdbc.queryForObject("SELECT available_stock FROM seckill_item WHERE id=?",Long.class,iid));
   assertEquals(10L,db.jdbc.queryForObject("SELECT COUNT(*) FROM seckill_order WHERE item_id=?",Long.class,iid));
  }finally{workers.shutdownNow();}
 }
 @Test void duplicateRequestAndBusinessKeyDoNotLeakStock(){
  var first=orders.process(event(1,1));assertEquals("SUCCESS",first.get("status"));
  assertEquals(first.get("orderId"),orders.process(event(1,1)).get("orderId"));
  assertEquals("FAILED",orders.process(event(2,1)).get("status"));
  assertEquals(9L,db.jdbc.queryForObject("SELECT available_stock FROM seckill_item WHERE id=?",Long.class,iid));
  assertEquals(1L,db.jdbc.queryForObject("SELECT COUNT(*) FROM seckill_order WHERE item_id=?",Long.class,iid));
 }
 @Test void failedTombstoneFencesLateEvent(){
  var e=event(1,1);assertEquals("FAILED",orders.fail(e,"ABORT").get("status"));assertEquals("FAILED",orders.process(e).get("status"));
  assertEquals(10L,db.jdbc.queryForObject("SELECT available_stock FROM seckill_item WHERE id=?",Long.class,iid));
 }
 @Test void cancelledOrderRefundsExactlyOnce(){
  var result=orders.process(event(1,1));long oid=Json.number(result.get("orderId"));var user=new Auth.User(1,"test","USER");
  orders.change(oid,user,false);orders.change(oid,user,false);orders.expire(oid);
  assertEquals(10L,db.jdbc.queryForObject("SELECT available_stock FROM seckill_item WHERE id=?",Long.class,iid));
  assertEquals(1L,db.jdbc.queryForObject("SELECT COUNT(*) FROM stock_change_log WHERE item_id=? AND change_type='CANCELLED'",Long.class,iid));
 }
 @Test void outboxIsEligibleInUtcEvenWhenDatabaseServerUsesAnotherTimezone(){
  var e=event(1,1);orders.process(e);
  var row=db.one("SELECT * FROM seckill_request WHERE request_id=?",e.requestId());row.put("redis_reserved",true);orders.outbox(row);
  assertEquals(1L,db.jdbc.queryForObject("SELECT COUNT(*) FROM recovery_outbox WHERE request_id=? AND next_retry_at<=DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 5 SECOND)",Long.class,e.requestId()));
  assertEquals("+00:00",db.jdbc.queryForObject("SELECT @@session.time_zone",String.class));
 }
}
