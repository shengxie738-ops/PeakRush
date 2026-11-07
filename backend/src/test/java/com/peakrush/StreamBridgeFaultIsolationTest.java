package com.peakrush;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.Tag;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.data.redis.connection.stream.*;
import org.springframework.data.domain.Range;
import org.springframework.kafka.config.KafkaListenerEndpointRegistry;
import org.springframework.kafka.support.SendResult;
import org.springframework.mock.env.MockEnvironment;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.time.Duration;
import java.util.*;
import java.util.concurrent.*;
import java.util.concurrent.atomic.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.*;

/**
 * bridge 的故障隔离与发送上限回归。需要真实 Redis（REDIS_HOST/REDIS_PORT，默认 127.0.0.1:16379）。
 * 断言依据 PR #3 评审的 R1/R2/R3：坏记录不能拖垮其他活动、在途发送不超过 32、XACK 与 XDEL 原子完成。
 */
@EnabledIfEnvironmentVariable(named="PEAKRUSH_INTEGRATION_TESTS",matches="true")
class StreamBridgeFaultIsolationTest {
 LettuceConnectionFactory connection;StringRedisTemplate template;Reservations reservations;Json json;Faults faults;
 long aidA;long aidB;long iid=1;
 @BeforeEach void open(){
  connection=new LettuceConnectionFactory(System.getenv().getOrDefault("REDIS_HOST","127.0.0.1"),Integer.parseInt(System.getenv().getOrDefault("REDIS_PORT","16379")));connection.afterPropertiesSet();connection.start();
  template=new StringRedisTemplate(connection);template.afterPropertiesSet();
  json=new Json(new ObjectMapper());reservations=new Reservations(template,json,new StockHints());
  faults=new Faults(new MockEnvironment(),new KafkaListenerEndpointRegistry());
  aidA=System.nanoTime();aidB=aidA+1;
 }
 @AfterEach void close(){
  for(long aid:List.of(aidA,aidB)){Set<String> owned=template.keys(reservations.prefix(aid,iid)+"*");if(owned!=null&&!owned.isEmpty())template.delete(owned);}
  connection.destroy();
 }
 private String stream(long aid){return reservations.prefix(aid,iid)+"events";}
 private PurchaseEvent event(long aid,int n){return new PurchaseEvent(aid+".1."+String.format("%032x",n),n,aid,iid,1,"hash-"+n,"gen",4,System.currentTimeMillis(),true);}
 private RecordId append(long aid,PurchaseEvent e){return reservations.streams().add(stream(aid),Map.of("payload",json.write(e)));}
 private Map<String,Object> item(long aid){return Json.map("activity_id",aid,"id",iid,"architecture_version",4);}
 private Workers worker(List<Map<String,Object>> items,Purchases purchases){return worker(items,purchases,12);}
 private Workers worker(List<Map<String,Object>> items,Purchases purchases,long claimIdleSeconds){
  Store store=mock(Store.class);when(store.allItems()).thenReturn(items);
  return new Workers(store,reservations,purchases,mock(Orders.class),faults,json,1800,claimIdleSeconds);
 }
 private static void waitFor(java.util.function.BooleanSupplier condition,long millis){
  long deadline=System.nanoTime()+TimeUnit.MILLISECONDS.toNanos(millis);
  while(!condition.getAsBoolean()){if(System.nanoTime()>=deadline)return;try{Thread.sleep(20);}catch(InterruptedException e){Thread.currentThread().interrupt();return;}}
 }
 @Test void poisonRecordInOneStreamDoesNotStopAnotherActivity(){
  append(aidA,event(aidA,1));
  reservations.streams().add(stream(aidA),Map.of("bad","no-payload-field"));
  var good=event(aidB,2);append(aidB,good);
  Purchases purchases=mock(Purchases.class);
  when(purchases.enqueue(any())).thenReturn(CompletableFuture.completedFuture(null));
  worker(List.of(item(aidA),item(aidB)),purchases).bridge();
  var captor=org.mockito.ArgumentCaptor.forClass(PurchaseEvent.class);
  verify(purchases,times(2)).enqueue(captor.capture());
  assertEquals(Set.of(event(aidA,1).requestId(),good.requestId()),captor.getAllValues().stream().map(PurchaseEvent::requestId).collect(java.util.stream.Collectors.toSet()),"两个活动中的有效记录都必须被发送");
  assertEquals(1,reservations.streams().pending(stream(aidA),"bridge",Range.unbounded(),10).size(),"无法解析的记录必须留在 PEL 中而不是被丢弃");
 }
 @Test void synchronousProducerFailureDoesNotStopAnotherActivity(){
  var broken=event(aidA,1);append(aidA,broken);
  var good=event(aidB,2);append(aidB,good);
  Purchases purchases=mock(Purchases.class);
  when(purchases.enqueue(any())).thenAnswer(inv->{
   if(((PurchaseEvent)inv.getArgument(0)).requestId().equals(broken.requestId()))throw new IllegalStateException("producer unavailable");
   return CompletableFuture.completedFuture(null);
  });
  worker(List.of(item(aidA),item(aidB)),purchases).bridge();
  verify(purchases,times(2)).enqueue(any());
  assertEquals(1,reservations.streams().pending(stream(aidA),"bridge",Range.unbounded(),10).size());
  assertEquals(0,reservations.streams().pending(stream(aidB),"bridge",Range.unbounded(),10).size(),"成功发送的条目必须被确认并清理");
  assertEquals(0L,reservations.streams().size(stream(aidB)));
 }
 @Test void atMost32UncompletedSendsAreSubmitted()throws Exception{
  for(int n=1;n<=256;n++)append(aidA,event(aidA,n));
  var inFlight=new AtomicInteger();var peak=new AtomicInteger();var submitted=new AtomicInteger();
  Queue<CompletableFuture<SendResult<String,String>>> outstanding=new ConcurrentLinkedQueue<>();
  Purchases purchases=mock(Purchases.class);
  when(purchases.enqueue(any())).thenAnswer(inv->{
   var future=new CompletableFuture<SendResult<String,String>>();outstanding.add(future);
   submitted.incrementAndGet();peak.accumulateAndGet(inFlight.incrementAndGet(),Math::max);return future;
  });
  ExecutorService executor=Executors.newSingleThreadExecutor();
  try{
   var bridge=executor.submit(()->worker(List.of(item(aidA)),purchases).bridge());
   waitFor(()->submitted.get()>=32,5000);Thread.sleep(300);
   assertEquals(32,submitted.get(),"容量用尽后不得继续创建第 33 个未完成发送");
   for(int round=0;round<8;round++){
    int target=Math.min(256,32*(round+1));waitFor(()->submitted.get()>=target,15000);
    CompletableFuture<SendResult<String,String>> pending;while((pending=outstanding.poll())!=null){inFlight.decrementAndGet();pending.complete(null);}
   }
   bridge.get(60,TimeUnit.SECONDS);
   assertEquals(256,submitted.get());
   assertTrue(peak.get()<=32,"同时未完成的发送不得超过 32，实际峰值 "+peak.get());
   assertEquals(0L,reservations.streams().size(stream(aidA)),"全部确认后 Stream 条目应被清理");
  }finally{executor.shutdownNow();}
 }
 @Test void exceptionalCompletionReleasesCapacityForAnotherStream(){
  for(int n=1;n<=32;n++)append(aidA,event(aidA,n));
  for(int n=1;n<=32;n++)append(aidB,event(aidB,n));
  var submitted=new AtomicInteger();
  Purchases purchases=mock(Purchases.class);
  when(purchases.enqueue(any())).thenAnswer(inv->{submitted.incrementAndGet();var future=new CompletableFuture<SendResult<String,String>>();future.completeExceptionally(new IllegalStateException("broker down"));return future;});
  worker(List.of(item(aidA),item(aidB)),purchases).bridge();
  assertEquals(64,submitted.get(),"失败完成的发送必须归还容量，另一个活动仍能提交");
  assertEquals(32,reservations.streams().pending(stream(aidA),"bridge",Range.unbounded(),100).size(),"未确认的失败发送必须留在 PEL 中");
 }
 @Test void entryYoungerThanClaimThresholdIsNotStealed()throws Exception{
  // 阈值 12 秒 > delivery.timeout.ms(10000)：刚失败 6.1 秒的条目仍可能被原实例重试，不能被 claim。
  append(aidA,event(aidA,1));
  reservations.createGroup(stream(aidA));
  reservations.streams().read(Consumer.from("bridge","crashed"),StreamReadOptions.empty().count(10),StreamOffset.create(stream(aidA),ReadOffset.lastConsumed()));
  Purchases purchases=mock(Purchases.class);
  Thread.sleep(6500);
  worker(List.of(item(aidA)),purchases).bridge();
  verify(purchases,never()).enqueue(any());
  assertEquals(1,reservations.streams().pending(stream(aidA),"bridge",Range.unbounded(),10).size());
 }
 @Test void staleEntriesBeyondFirstPendingPageAreEventuallyClaimed(){
  // 首屏 256 条被 claim 后空闲时间被重置；若每轮都从头读 PEL，第 257 条之后会永久饿死。
  for(int n=1;n<=300;n++)append(aidA,event(aidA,n));
  reservations.createGroup(stream(aidA));
  reservations.streams().read(Consumer.from("bridge","crashed"),StreamReadOptions.empty().count(300),StreamOffset.create(stream(aidA),ReadOffset.lastConsumed()));
  assertEquals(300,reservations.streams().pending(stream(aidA),"bridge",Range.unbounded(),400).size());
  Set<String> attempted=java.util.concurrent.ConcurrentHashMap.newKeySet();
  Purchases purchases=mock(Purchases.class);
  when(purchases.enqueue(any())).thenAnswer(inv->{
   attempted.add(((PurchaseEvent)inv.getArgument(0)).requestId());
   var future=new CompletableFuture<SendResult<String,String>>();future.completeExceptionally(new IllegalStateException("broker down"));return future;
  });
  var worker=worker(List.of(item(aidA)),purchases,0);
  worker.bridge();worker.bridge();
  assertTrue(attempted.contains(event(aidA,257).requestId()),"第二轮必须从游标处继续扫描到第 257 条之后，而不是重复扫描首屏");
 }
 @Test void acknowledgeAndDeleteRemovesPendingAndEntriesAtomically(){
  String stream=stream(aidA);reservations.createGroup(stream);
  var first=event(aidA,1);var second=event(aidA,2);
  RecordId firstId=append(aidA,first),secondId=append(aidA,second);
  reservations.streams().read(Consumer.from("bridge","crashed"),StreamReadOptions.empty().count(10),StreamOffset.create(stream,ReadOffset.lastConsumed()));
  assertEquals(2,reservations.streams().pending(stream,"bridge",Range.unbounded(),10).size());
  // 模拟旧实现遗留的已 ACK 未删除条目：XACK 生效而 XDEL 未执行。
  reservations.streams().acknowledge(stream,"bridge",firstId);
  assertEquals(1,reservations.streams().pending(stream,"bridge",Range.unbounded(),10).size(),"第二条仍在 PEL 中");
  long acknowledged=reservations.acknowledgeAndDelete(stream,List.of(firstId.getValue(),secondId.getValue()));
  assertEquals(1,acknowledged,"只剩尚未确认的那条会被本次 XACK 计数");
  assertEquals(0,reservations.streams().pending(stream,"bridge",Range.unbounded(),10).size());
  assertEquals(0L,reservations.streams().size(stream),"已确认条目必须从 Stream 中删除");
 }
 @Test void mixedSuccessAndFailureAcknowledgeOnlySuccessfulEntries(){
  var ok=event(aidA,1);var bad=event(aidA,2);
  append(aidA,ok);RecordId badId=append(aidA,bad);
  Purchases purchases=mock(Purchases.class);
  when(purchases.enqueue(any())).thenAnswer(inv->{
   var future=new CompletableFuture<SendResult<String,String>>();
   if(((PurchaseEvent)inv.getArgument(0)).requestId().equals(bad.requestId()))future.completeExceptionally(new IllegalStateException("broker down"));
   else future.complete(null);
   return future;
  });
  worker(List.of(item(aidA)),purchases).bridge();
  var pending=reservations.streams().pending(stream(aidA),"bridge",Range.unbounded(),10);
  assertEquals(1,pending.size(),"只有成功发送的条目可以被确认");
  assertEquals(badId.getValue(),pending.get(0).getId().getValue(),"失败的条目必须留在 PEL 中");
  assertEquals(1L,reservations.streams().size(stream(aidA)),"失败条目仍留在 Stream 中等待下一轮重试");
 }
 @Test void acknowledgementFailureKeepsEntriesPendingAndOtherActivitiesContinue(){
  append(aidA,event(aidA,1));append(aidB,event(aidB,1));
  Purchases purchases=mock(Purchases.class);
  when(purchases.enqueue(any())).thenReturn(CompletableFuture.completedFuture(null));
  var failing=spy(reservations);
  doThrow(new IllegalStateException("XDEL denied")).when(failing).acknowledgeAndDelete(anyString(),anyList());
  Store store=mock(Store.class);when(store.allItems()).thenReturn(List.of(item(aidA),item(aidB)));
  assertDoesNotThrow(()->new Workers(store,failing,purchases,mock(Orders.class),faults,json,1800,12).bridge());
  assertEquals(1,reservations.streams().pending(stream(aidA),"bridge",Range.unbounded(),10).size(),"XACK/XDEL 失败必须保留 PEL");
  assertEquals(1,reservations.streams().pending(stream(aidB),"bridge",Range.unbounded(),10).size(),"一个活动的确认失败不能阻止另一个活动");
  assertEquals(2L,reservations.streams().size(stream(aidA))+reservations.streams().size(stream(aidB)));
 }
 @Test void repeatedAcknowledgementAfterLostResponseIsIdempotent(){
  String stream=stream(aidA);reservations.createGroup(stream);
  String id=append(aidA,event(aidA,1)).getValue();
  reservations.streams().read(Consumer.from("bridge","crashed"),StreamReadOptions.empty().count(10),StreamOffset.create(stream,ReadOffset.lastConsumed()));
  assertEquals(1,reservations.acknowledgeAndDelete(stream,List.of(id)));
  // 模拟清理响应丢失后客户端重试：脚本已生效，第二次只能返回 0，不能抛错或复活条目。
  assertEquals(0,reservations.acknowledgeAndDelete(stream,List.of(id)));
  assertEquals(0,reservations.streams().pending(stream,"bridge",Range.unbounded(),10).size());
  assertEquals(0L,reservations.streams().size(stream));
 }
 @Test void anotherInstanceClaimsEntriesAbandonedByACrashedConsumer(){
  append(aidA,event(aidA,1));
  reservations.createGroup(stream(aidA));
  reservations.streams().read(Consumer.from("bridge","crashed"),StreamReadOptions.empty().count(10),StreamOffset.create(stream(aidA),ReadOffset.lastConsumed()));
  Purchases purchases=mock(Purchases.class);
  when(purchases.enqueue(any())).thenReturn(CompletableFuture.completedFuture(null));
  worker(List.of(item(aidA)),purchases,0).bridge();
  verify(purchases,times(1)).enqueue(any());
  assertEquals(0,reservations.streams().pending(stream(aidA),"bridge",Range.unbounded(),10).size(),"新实例必须接管并确认崩溃消费者的 PEL");
  assertEquals(0L,reservations.streams().size(stream(aidA)));
 }
 @Test @Tag("slow") @EnabledIfEnvironmentVariable(named="PEAKRUSH_SLOW_TESTS",matches="true")
 void capacityIsNotReleasedWhenSendWaitTimesOut()throws Exception{
  for(int n=1;n<=32;n++)append(aidA,event(aidA,n));
  var submitted=new AtomicInteger();
  Queue<CompletableFuture<SendResult<String,String>>> outstanding=new ConcurrentLinkedQueue<>();
  Purchases purchases=mock(Purchases.class);
  when(purchases.enqueue(any())).thenAnswer(inv->{
   var future=new CompletableFuture<SendResult<String,String>>();outstanding.add(future);submitted.incrementAndGet();return future;
  });
  var worker=worker(List.of(item(aidA)),purchases,0);
  ExecutorService executor=Executors.newSingleThreadExecutor();
  try{
   executor.submit(()->worker.bridge()).get(30,TimeUnit.SECONDS);
   assertEquals(32,submitted.get());
   worker.bridge();
   assertEquals(32,submitted.get(),"等待超时后不得释放容量并继续追加发送");
   CompletableFuture<SendResult<String,String>> future;while((future=outstanding.poll())!=null)future.completeExceptionally(new IllegalStateException("timeout released"));
   executor.submit(()->worker.bridge());
   waitFor(()->submitted.get()>=64,5000);
   assertTrue(submitted.get()>=64,"发送完成归还容量后，下一轮才能继续提交");
  }finally{executor.shutdownNow();}
 }
}
