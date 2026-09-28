package com.peakrush;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
@EnabledIfEnvironmentVariable(named="PEAKRUSH_INTEGRATION_TESTS",matches="true")
class RedisReliabilityTest {
 LettuceConnectionFactory connection;Reservations reservations;long aid;long iid=1;String p;Map<String,Object> item;
 @BeforeEach void open(){
  connection=new LettuceConnectionFactory("127.0.0.1",16379);connection.afterPropertiesSet();connection.start();
  var template=new StringRedisTemplate(connection);template.afterPropertiesSet();
  reservations=new Reservations(template,new Json(new ObjectMapper()),new StockHints());aid=System.nanoTime();p=reservations.prefix(aid,iid);
  item=Json.map("activity_id",aid,"id",iid,"available_stock",10,"total_stock",10,"limit_per_user",1,"generation","test-generation","start_time",Instant.now().minusSeconds(10),"end_time",Instant.now().plusSeconds(120),"activity_status","PREHEATED");
  reservations.warmup(item);reservations.enabled(aid,iid,true);
 }
 @AfterEach void close(){
  Set<String> owned=reservations.redis.keys(p+"*");if(owned!=null&&!owned.isEmpty())reservations.redis.delete(owned);connection.destroy();
 }
 PurchaseEvent event(int n,int quantity){String rid=aid+"."+iid+"."+String.format("%032x",n);return new PurchaseEvent(rid,n,aid,iid,quantity,"hash-"+n+"-"+quantity,"test-generation",4,System.currentTimeMillis(),true);}
 @Test void concurrentReservationsNeverOversell()throws Exception {
  ExecutorService executor=Executors.newFixedThreadPool(12);
  try{List<Future<List<String>>> jobs=new ArrayList<>();for(int n=1;n<=100;n++){int id=n;jobs.add(executor.submit(()->reservations.reserve(event(id,1))));}
   long accepted=0;for(var job:jobs)if(job.get().get(0).equals("RESERVED"))accepted++;
   assertEquals(10,accepted);assertEquals("0",reservations.redis.opsForValue().get(p+"stock"));
   assertEquals(10L,reservations.redis.opsForZSet().zCard(p+"pending"));
  }finally{executor.shutdownNow();}
 }
 @Test void duplicateAndConflictingPayloadDoNotConsumeStock(){
  var e=event(1,1);assertEquals("RESERVED",reservations.reserve(e).get(0));assertEquals("EXISTING",reservations.reserve(e).get(0));
  assertEquals("CONFLICT",reservations.reserve(event(1,2)).get(0));assertEquals("9",reservations.redis.opsForValue().get(p+"stock"));
 }
 @Test void badStreamTypeRejectsBeforeAnyMutation(){
  reservations.redis.opsForValue().set(p+"events","wrong-type");
  assertEquals("ERROR",reservations.reserve(event(1,1)).get(0));
  assertEquals("10",reservations.redis.opsForValue().get(p+"stock"));
  assertTrue(reservations.request(event(1,1).requestId()).isEmpty());assertFalse(Boolean.TRUE.equals(reservations.redis.hasKey(p+"users")));
 }
 @Test void liveMissingMetadataFailsClosed(){
  reservations.reserve(event(1,1));reservations.redis.delete(p+"meta");item.put("activity_status","RUNNING");
  assertThrows(ApiException.class,()->reservations.warmup(item));assertEquals("9",reservations.redis.opsForValue().get(p+"stock"));
 }
 @Test void warmupNeverResetsExistingReservation(){
  reservations.reserve(event(1,1));reservations.warmup(item);assertEquals("9",reservations.redis.opsForValue().get(p+"stock"));
 }
 @Test void releaseIsIdempotentAndOlderConfirmationCannotResurrect(){
  var e=event(1,1);reservations.reserve(e);
  var release=Json.map("requestId",e.requestId(),"generation",e.generation(),"status","FAILED","orderId","","userId",1,"stateVersion",2,"reason","TEST");
  reservations.apply(release);reservations.apply(release);
  var late=new LinkedHashMap<>(release);late.put("stateVersion",1);late.put("status","SUCCESS");reservations.apply(late);
  assertEquals("10",reservations.redis.opsForValue().get(p+"stock"));assertEquals("FAILED",reservations.request(e.requestId()).get("state"));
 }
 @Test void journalTypedCommandsExposePayloadAndAcknowledge(){
  var e=event(1,1);reservations.reserve(e);String stream=p+"events";reservations.createGroup(stream);
  var operations=reservations.streams();
  var read=operations.read(org.springframework.data.redis.connection.stream.Consumer.from("bridge","test"),org.springframework.data.redis.connection.stream.StreamReadOptions.empty().count(256),org.springframework.data.redis.connection.stream.StreamOffset.create(stream,org.springframework.data.redis.connection.stream.ReadOffset.lastConsumed()));
  assertNotNull(read);assertEquals(1,read.size());assertTrue(read.get(0).getValue().get("payload").contains(e.requestId()));
  assertEquals(1,operations.pending(stream,"bridge",org.springframework.data.domain.Range.unbounded(),20).size());
  assertEquals(1L,operations.acknowledge(stream,"bridge",read.get(0).getId()));
  assertEquals(0,operations.pending(stream,"bridge",org.springframework.data.domain.Range.unbounded(),20).size());
 }
 @Test void windowChecksUseServerTime(){
  reservations.redis.opsForHash().put(p+"meta","start",String.valueOf(System.currentTimeMillis()+60000));
  assertEquals("NOT_STARTED",reservations.reserve(event(1,1)).get(1));
  reservations.redis.opsForHash().put(p+"meta","start","0");reservations.redis.opsForHash().put(p+"meta","end","1");
  assertEquals("ENDED",reservations.reserve(event(2,1)).get(1));assertEquals("10",reservations.redis.opsForValue().get(p+"stock"));
 }
}
