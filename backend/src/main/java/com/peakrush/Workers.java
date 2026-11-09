package com.peakrush;
import org.springframework.stereotype.Component;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.beans.factory.annotation.Value;
import org.slf4j.*;
import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import org.springframework.data.redis.connection.stream.*;
import org.springframework.data.redis.core.StreamOperations;
import org.springframework.data.domain.Range;
import org.springframework.kafka.support.SendResult;
@Component
public class Workers {
 final Store db;final Reservations redis;final Purchases purchases;final Orders orders;final Faults faults;final Json json;final long pendingTimeout;final long claimIdleMillis;
 // Kafka ACK 后暂停必须给剩余续租留出空间：暂停前最后一次续租发生在 awaitSends 之前，
 // 因此上限取 claim-idle-seconds - SEND_WAIT_SECONDS，默认 20-12=8 秒。
 final long maxAckPauseMillis;
 final String consumer;final String instanceName;
 private static final Logger log=LoggerFactory.getLogger(Workers.class);
 // 每个 Workers 实例最多同时持有 32 个未完成的 bridge 发送；claim 与读取都不会超过当前可用名额。
 private static final int SEND_CHUNK=32;
 private static final int SEND_WAIT_SECONDS=12;
 // 单次 XPENDING 只取一页，并用每个流的游标轮转，避免只扫描 PEL 最前面的 256 条。
 private static final int PENDING_PAGE=256;
 // 单个活动在单个调度轮内的有界预算，避免一个热流长期占满调度线程。
 private static final int ROUND_RECORD_BUDGET=256;
 private static final long ROUND_TIME_BUDGET_MILLIS=5000;
 // PEL 恢复最多占用的批次数；剩余预算留给同流新消息，坏记录不会饿死新流入。
 private static final int MAX_STALE_BATCHES=4;
 // 续租间隔必须明显小于 claim 阈值，并且在每条 enqueue 前后都会检查；单次同步发送最多阻塞
 // max.block.ms（3 秒），因此 1 秒的续租检查可以覆盖 32 条逐条发送的整个阻塞期。
 private static final long LEASE_RENEW_MILLIS=1000;
 private final Semaphore producerCapacity=new Semaphore(SEND_CHUNK);
 private final Map<String,String> pendingCursors=new ConcurrentHashMap<>();
 // 已提交但尚未 XACK/XDEL 的条目。Future 完成只更新状态并归还名额；Redis 操作统一在 bridge 线程执行。
 private final Map<String,Map<String,Delivery>> inFlight=new ConcurrentHashMap<>();
 private final java.util.concurrent.atomic.AtomicLong ackFailures=new java.util.concurrent.atomic.AtomicLong();
 private final java.util.concurrent.atomic.AtomicLong expireFailures=new java.util.concurrent.atomic.AtomicLong();
 private static final class Delivery{
  final String recordId;
  volatile boolean done,succeeded,reassigned;volatile long lastRenewed;
  Delivery(String recordId,long now){this.recordId=recordId;this.lastRenewed=now;}
 }
 public Workers(Store db,Reservations redis,Purchases purchases,Orders orders,Faults faults,Json json,@Value("${peakrush.pending-timeout-seconds}")long pendingTimeout,@Value("${peakrush.bridge.claim-idle-seconds:20}")long claimIdleSeconds,@Value("${peakrush.bridge.instance-name:}")String instanceName){
  this.db=db;this.redis=redis;this.purchases=purchases;this.orders=orders;this.faults=faults;this.json=json;this.pendingTimeout=pendingTimeout;this.claimIdleMillis=claimIdleSeconds*1000;
  this.maxAckPauseMillis=Math.max(0,claimIdleMillis-SEND_WAIT_SECONDS*1000L);
  // 实例稳定名用于接管演练判据：同名重启仍是“原实例”，不同名才是“另一实例”。
  // 未配置时退回随机 UUID，保持原有单实例行为。
  this.instanceName=instanceName==null?"":instanceName.trim();
  this.consumer="bridge-"+(this.instanceName.isEmpty()?UUID.randomUUID():this.instanceName);
  if(this.instanceName.isEmpty())log.warn("BRIDGE_INSTANCE_NAME is not set; consumer={} is random and cannot be used as a stable drill identity",consumer);
  log.info("Stream bridge started consumer={} instanceName={} claimIdleMillis={} maxAckPauseMillis={}",consumer,instanceName(instanceName),claimIdleMillis,maxAckPauseMillis);
 }
 private static String instanceName(String value){return value==null||value.isBlank()?"<random>":value.trim();}
 @Scheduled(fixedDelay=50,initialDelay=4000)
 public void bridge(){
  // pauseBridge 只暂停交付，不等于安全 drain：仍要为已有 inFlight 条目续租，
  // 否则暂停前已提交的发送会在阈值后被其他实例接管。
  if(faults.pauseBridge.get()){renewAllLeases();return;}
  List<Map<String,Object>> items;
  try{items=db.allItems();}catch(Exception e){log.warn("Stream bridge deferred; activity list unavailable: {}",e.toString());return;}
  // 活动被删除后不再有 bridgeItem 处理它的 inFlight，主动清理跟踪表避免长期泄漏。
  // 未完成 Future 仍会在回调里归还 Semaphore，因此删除跟踪不会泄漏发送名额。
  Set<String> activeStreams=new HashSet<>();
  for(var item:items)if(Json.number(item.get("architecture_version"))==4)
   activeStreams.add(redis.prefix(Json.number(item.get("activity_id")),Json.number(item.get("id")))+"events");
  for(String stream:new ArrayList<>(inFlight.keySet()))if(!activeStreams.contains(stream)){
   Map<String,Delivery> dropped=inFlight.remove(stream);
   // 活动消失后游标同样失去意义，一并清理，避免长期占用内存。
   pendingCursors.remove(stream);
   if(dropped!=null&&!dropped.isEmpty())log.warn("Stream {} no longer in activity catalog; dropped {} in-flight tracking entries and its PEL cursor",stream,dropped.size());
  }
  // 每个活动独立隔离：一个活动的坏记录或同步发送异常不能让后续活动整轮跳过。
  for(var item:items)try{bridgeItem(item);}
   catch(Exception e){log.warn("Stream bridge deferred for activity {}; unacknowledged events remain recoverable: {}",item.get("activity_id"),e.toString());}
 }
 private void bridgeItem(Map<String,Object> item){
  if(Json.number(item.get("architecture_version"))!=4)return;
  String stream=redis.prefix(Json.number(item.get("activity_id")),Json.number(item.get("id")))+"events";
  if(!Boolean.TRUE.equals(redis.redis.hasKey(stream)))return;
  redis.createGroup(stream);
  StreamOperations<String,String,String> operations=redis.streams();
  long deadline=System.currentTimeMillis()+ROUND_TIME_BUDGET_MILLIS;
  Set<String> attemptedThisRound=new HashSet<>();
  int processed=0,staleBatches=0;
  while(processed<ROUND_RECORD_BUDGET&&System.currentTimeMillis()<deadline){
   flushAcknowledged(stream);
   // 本轮可能刚处理完另一个活动，这里统一续租全部流的在途条目，避免跨活动形成不续租空窗。
   renewAllLeases();
   int capacity=producerCapacity.availablePermits();
   Map<String,Delivery> tracked=inFlight.get(stream);
   int trackedCount=tracked==null?0:tracked.size();
   // 背压：跟踪表达到 2 倍发送并发时本轮不再 claim/read，避免内存与逐条 XPENDING 成本无界增长。
   if(trackedCount>=2*SEND_CHUNK){log.debug("In-flight tracking for {} reached {} entries; defer claim/read",stream,trackedCount);break;}
   // 没有发送名额时不 claim、也不读取：否则会重置 PEL 空闲时间与投递次数，拖慢其他有容量实例的接管。
   if(capacity<=0){log.debug("Producer send capacity busy; Stream entries on {} stay pending",stream);break;}
   boolean worked=false;
   if(staleBatches<MAX_STALE_BATCHES){
    PendingScan scan=stalePending(stream,operations);
    List<RecordId> stale=new ArrayList<>(scan.stale);
    stale.removeIf(id->attemptedThisRound.contains(id.getValue())||isInFlight(stream,id.getValue()));
    if(!stale.isEmpty()){
     // 只 claim 本轮真正能发送的一批；扫描窗口仍是 256。
     int take=Math.min(Math.min(capacity,stale.size()),ROUND_RECORD_BUDGET-processed);
     List<RecordId> ids=stale.subList(0,take);
     for(var id:ids)attemptedThisRound.add(id.getValue());
     var claimed=operations.claim(stream,"bridge",consumer,Duration.ofMillis(claimIdleMillis),ids.toArray(RecordId[]::new));
     if(claimed!=null&&!claimed.isEmpty()){
      // 接管证据：演练据此判断哪个实例、从哪个 ID 开始接管了 PEL。
      log.info("Stream {} claimed {} stale entries consumer={} firstId={}",stream,claimed.size(),consumer,claimed.get(0).getId().getValue());
      processed+=claimed.size();sendBatch(stream,claimed);staleBatches++;worked=true;
     }
     // 游标只推进到本轮实际 claim 的最后一条，未处理的陈旧条目下一轮仍会被扫描到。
     pendingCursors.put(stream,ids.get(take-1).getValue());
    }else{
     // 本页没有任何可 claim 的条目：整页时从页尾继续，否则回绕到 PEL 起点。
     pendingCursors.put(stream,scan.fullPage?scan.lastInspected:"-");
    }
   }
   // 陈旧条目处理有界；没有可发送的陈旧条目时继续读取新消息，坏记录不能堵住同流新流入。
   if(!worked){
    var records=operations.read(Consumer.from("bridge",consumer),StreamReadOptions.empty().count(capacity),StreamOffset.create(stream,ReadOffset.lastConsumed()));
    if(records==null||records.isEmpty())break;
    for(var record:records)attemptedThisRound.add(record.getId().getValue());
    processed+=records.size();sendBatch(stream,records);
   }
  }
 }
 private boolean isInFlight(String stream,String recordId){
  Map<String,Delivery> deliveries=inFlight.get(stream);
  return deliveries!=null&&deliveries.containsKey(recordId);
 }
 private static final class PendingScan{
  final List<RecordId> stale;final String lastInspected;final boolean fullPage;
  PendingScan(List<RecordId> stale,String lastInspected,boolean fullPage){this.stale=stale;this.lastInspected=lastInspected;this.fullPage=fullPage;}
 }
 /**
  * 轮转扫描 PEL：XPENDING 单次只返回最前面的 256 条，固定从头读取会让第 256 条之后的
  * 陈旧记录永远得不到处理。每个流维护一个游标，每轮只扫描一页，读取代价有界且能覆盖整条 PEL。
  * 游标由调用方按“本轮实际 claim 的最后一条”推进，见 bridgeItem；未处理的陈旧条目不会被跳过。
  * 空闲阈值默认 20 秒，发送期间每 1 秒续租一次（awaitSends 分段等待时也续租），
  * 且 Kafka ACK 后暂停被钳制在 claim-idle-seconds - SEND_WAIT_SECONDS 以内；
  * 正常运行时这些续租显著降低被接管的概率，但进程停顿或确认失败时仍按至少一次交付。
  */
 private PendingScan stalePending(String stream,StreamOperations<String,String,String> operations){
  List<RecordId> ids=new ArrayList<>();
  String start=pendingCursors.getOrDefault(stream,"-");
  var page=operations.pending(stream,"bridge",Range.closed(start,"+"),PENDING_PAGE);
  if(page==null||page.isEmpty())return new PendingScan(ids,null,false);
  for(var record:page)if(record.getElapsedTimeSinceLastDelivery().toMillis()>=claimIdleMillis)ids.add(record.getId());
  return new PendingScan(ids,page.get(page.size()-1).getId().getValue(),page.size()>=PENDING_PAGE);
 }
 private void sendBatch(String stream,List<MapRecord<String,String,String>> records){
  if(records==null||records.isEmpty())return;
  List<CompletableFuture<SendResult<String,String>>> created=new ArrayList<>();
  for(var record:records){
   // 单条 enqueue 在 broker 元数据不可用时最多同步阻塞 max.block.ms（3 秒），
   // 因此在每条记录前后都检查全部流的续租，避免逐条阻塞期间其他活动超过接管阈值。
   renewAllLeases();
   // 名额在创建发送前获取：等待超时不释放，容量随实际完成才归还，因此超时后不会继续追加发送。
   if(!producerCapacity.tryAcquire()){
    log.warn("Producer send capacity busy; remaining Stream entries on {} stay pending",stream);break;
   }
   try{
    String payload=record.getValue().get("payload");
    if(payload==null)throw new IllegalStateException("Missing journal payload for "+record.getId());
    var future=Objects.requireNonNull(purchases.enqueue(PurchaseEvent.from(json.read(payload))));
    track(stream,record.getId().getValue(),future);created.add(future);
   }catch(RuntimeException error){
    // 坏记录或同步 producer 异常单独隔离，保留在 PEL 中，其他记录继续发送。
    producerCapacity.release();
    log.warn("Stream entry {} not sent; it stays pending: {}",record.getId(),error.toString());
   }
   renewAllLeases();
  }
  awaitSends(created);
  // 每批 Kafka 成功结果立即进入 Lua 原子确认，而不是等整轮结束再统一清理。
  flushAcknowledged(stream);
 }
 private void track(String stream,String recordId,CompletableFuture<SendResult<String,String>> future){
  var delivery=new Delivery(recordId,System.currentTimeMillis());
  inFlight.computeIfAbsent(stream,k->new ConcurrentHashMap<>()).put(recordId,delivery);
  future.whenComplete((result,error)->{
   delivery.succeeded=error==null;delivery.done=true;
   // Kafka 回调线程只更新状态和归还名额，不在回调里执行 Redis 网络操作。
   producerCapacity.release();
  });
 }
 private void awaitSends(List<CompletableFuture<SendResult<String,String>>> futures){
  if(futures.isEmpty())return;
  long deadline=System.currentTimeMillis()+SEND_WAIT_SECONDS*1000L;
  try{
   while(true){
    long remaining=deadline-System.currentTimeMillis();
    if(remaining<=0)throw new TimeoutException();
    try{
     // 分段等待，等待期间持续为所有活动续租，避免整段 12 秒形成不续租空窗。
     CompletableFuture.allOf(futures.toArray(CompletableFuture[]::new)).get(Math.min(remaining,1000),TimeUnit.MILLISECONDS);
     return;
    }catch(TimeoutException slice){renewAllLeases();}
   }
  }catch(Exception e){
   long waiting=futures.stream().filter(f->!f.isDone()).count();
   log.warn("Kafka batch send uncertain after {}s; {} futures still incomplete and stay tracked for acknowledgement: {}",SEND_WAIT_SECONDS,waiting,e.toString());
  }
 }
 private void flushAcknowledged(String stream){
  Map<String,Delivery> deliveries=inFlight.get(stream);
  if(deliveries==null||deliveries.isEmpty())return;
  List<Delivery> settled=new ArrayList<>();
  for(var it=deliveries.values().iterator();it.hasNext();){
   var delivery=it.next();
   if(!delivery.done)continue;
   it.remove();settled.add(delivery);
  }
  if(settled.isEmpty())return;
  List<String> acknowledged=settled.stream().filter(d->d.succeeded).map(d->d.recordId).toList();
  if(acknowledged.isEmpty())return;
  // 确认列表按 SEND_CHUNK 分批提交，单次 Lua 脚本的 ID 数量有界。
  // 故障暂停与 Lua 确认放在同一个异常边界内：暂停期间被中断时，
  // 已成功条目仍会回填到跟踪表，下一轮只重试 XACK/XDEL，不会丢失确认。
  try{
   long requested=faults.afterKafkaAckPauseMs.getAndSet(0);
   // 暂停前最后一次续租发生在 awaitSends 之前，暂停过长会让条目在确认前就被其他实例接管；
   // 因此超过 claim-idle-seconds - SEND_WAIT_SECONDS 的请求在这里钳制，钩子不能绕过这一约束。
   long delay=Math.min(requested,maxAckPauseMillis);
   if(requested>delay)log.warn("FAULT_AFTER_KAFKA_ACK pause {}ms exceeds safe window; clamped to {}ms (claimIdle={}ms, sendWait={}s)",requested,delay,claimIdleMillis,SEND_WAIT_SECONDS);
   if(delay>0){log.warn("FAULT_AFTER_KAFKA_ACK stream={} entries={} pauseMs={}",stream,acknowledged,delay);Faults.delay(delay);}
   // XACK 与 XDEL 由同一个 Lua 脚本原子完成：已确认条目不会再被读取或 claim，
   // 两条命令之间的中断不会再留下无法自动清理的条目。
   for(int i=0;i<acknowledged.size();i+=SEND_CHUNK)redis.acknowledgeAndDelete(stream,acknowledged.subList(i,Math.min(acknowledged.size(),i+SEND_CHUNK)));
  }catch(Exception e){
   // 确认失败时把成功条目放回跟踪表，下一轮只重试 Lua 确认，不重新发送 Kafka 记录。
   for(var delivery:settled)if(delivery.succeeded)deliveries.putIfAbsent(delivery.recordId,delivery);
   if(interrupted(e)){
    // 演练中 kill/中断打断的是暂停本身，不代表 Lua 确认失败，不累加确认失败计数。
    log.warn("FAULT_AFTER_KAFKA_ACK interrupted on stream={} consumer={}; {} entries kept tracked for confirmation retry",stream,consumer,acknowledged.size());
   }else{
    long failures=ackFailures.incrementAndGet();
    log.warn("Stream {} acknowledgement failed (cumulative {}, consumer={}); {} entries kept tracked for confirmation retry: {}",stream,failures,consumer,acknowledged.size(),e.toString());
   }
  }
 }
 private static boolean interrupted(Throwable error){
  for(Throwable cause=error;cause!=null;cause=cause.getCause())if(cause instanceof InterruptedException)return true;
  return false;
 }
 private void renewLeases(String stream){renewLeases(stream,redis.streams());}
 private void renewAllLeases(){
  if(inFlight.isEmpty())return;
  var operations=redis.streams();
  // 单个流的 Redis 异常不能中断其余流的续租，否则一个坏 key 会让所有活动同时失去租约。
  for(String stream:new ArrayList<>(inFlight.keySet()))try{renewLeases(stream,operations);}
   catch(Exception e){log.warn("Stream lease renewal failed for {}; entries stay recoverable: {}",stream,e.toString());}
 }
 private void renewLeases(String stream,StreamOperations<String,String,String> operations){
  Map<String,Delivery> deliveries=inFlight.get(stream);
  if(deliveries==null||deliveries.isEmpty())return;
  long now=System.currentTimeMillis();
  List<Delivery> candidates=new ArrayList<>();
  // 已完成但等待重试确认的成功条目也要续租，避免确认持续失败时被其他实例再次发送。
  for(var delivery:deliveries.values())
   if(!delivery.reassigned&&(!delivery.done||delivery.succeeded)&&now-delivery.lastRenewed>=LEASE_RENEW_MILLIS)candidates.add(delivery);
  if(candidates.isEmpty())return;
  try{
   // 逐条精确校验归属：1024 条 XPENDING 前缀窗口会把窗口外的在途条目误判为已被接管。
   // 候选受跟踪上限 2*SEND_CHUNK（通常 ≤64）约束，逐条 XPENDING 的代价可控。
   List<RecordId> ids=new ArrayList<>();
   for(var delivery:candidates){
    var owned=operations.pending(stream,Consumer.from("bridge",consumer),Range.closed(delivery.recordId,delivery.recordId),1);
    if(owned!=null&&!owned.isEmpty())ids.add(RecordId.of(delivery.recordId));
    else{delivery.reassigned=true;log.warn("Stream {} entry {} consumer={} was reassigned to another consumer; stop renewing",stream,delivery.recordId,consumer);}
   }
   // 以自己的消费者名 XCLAIM 同一条目会重置空闲时间，存活实例的未完成批次因此不会被其他实例接管。
   if(!ids.isEmpty())operations.claim(stream,"bridge",consumer,Duration.ZERO,ids.toArray(RecordId[]::new));
   for(var delivery:candidates)delivery.lastRenewed=now;
  }catch(Exception e){log.warn("Stream lease renewal failed for {}; entries stay recoverable: {}",stream,e.toString());}
 }
 @Scheduled(fixedDelay=500,initialDelay=4000)
 public void outbox(){
  if(faults.pauseOutbox.get())return;
  try{for(var task:db.jdbc.queryForList("SELECT * FROM recovery_outbox WHERE status='PENDING' AND next_retry_at<=UTC_TIMESTAMP(3) ORDER BY id LIMIT 50")){
   try{
    redis.apply(json.read(String.valueOf(task.get("payload"))));
    long delay=faults.afterRedisApplyPauseMs.getAndSet(0);
    if(delay>0){log.warn("FAULT_AFTER_REDIS_APPLY requestId={} pauseMs={}",task.get("request_id"),delay);Faults.delay(delay);}
    db.jdbc.update("UPDATE recovery_outbox SET status='DONE',attempts=attempts+1,last_error=NULL WHERE id=?",task.get("id"));
   }catch(Exception e){String error=e.toString();db.jdbc.update("UPDATE recovery_outbox SET attempts=attempts+1,next_retry_at=DATE_ADD(UTC_TIMESTAMP(3),INTERVAL 2 SECOND),last_error=? WHERE id=?",error.substring(0,Math.min(490,error.length())),task.get("id"));}
  }}catch(Exception e){log.warn("Outbox database unavailable; durable tasks retained: {}",e.toString());}
 }
 @Scheduled(fixedDelay=1000,initialDelay=5000)
 public void expire(){
  try{for(var row:db.jdbc.queryForList("SELECT id FROM seckill_order WHERE status='CREATED' AND expire_time<=UTC_TIMESTAMP(3) ORDER BY expire_time LIMIT 100"))try{orders.expire(Json.number(row.get("id")));}catch(Exception e){log.warn("Order expiry failed for {}; will retry: {}",row.get("id"),e.toString());}}
  catch(Exception e){long failures=expireFailures.incrementAndGet();if(failures==1||failures%60==0)log.warn("Order expiry scan failed (cumulative {}); will retry: {}",failures,e.toString());}
 }
 @Scheduled(fixedDelay=5000,initialDelay=10000)
 public void recoverPending(){
  try{for(var item:db.allItems()){
   int version=(int)Json.number(item.get("architecture_version"));if(version<2)continue;
   // 同一类故障隔离：一条坏的 pending 请求不能让其他活动的补偿整轮停摆。
   try{
    String prefix=redis.prefix(Json.number(item.get("activity_id")),Json.number(item.get("id")));
    Set<String> ids=redis.redis.opsForZSet().rangeByScore(prefix+"pending",0,System.currentTimeMillis()-5000,0,30);
    if(ids==null)continue;
    for(String id:ids){
     Map<String,String> request=redis.request(id);if(request.isEmpty())continue;
     PurchaseEvent event=PurchaseEvent.from(json.read(request.get("payload")));
     var persisted=orders.existing(id);
     if(persisted!=null&&!"PENDING".equals(persisted.get("status"))){orders.outbox(persisted);continue;}
     if(System.currentTimeMillis()-event.acceptedAt()>pendingTimeout*1000){orders.fail(event,"PROCESSING_TIMEOUT");continue;}
     if(version==2)orders.process(event);
     else if(version==3&&!faults.pauseBridge.get())purchases.publish(event);
    }
   }catch(Exception e){log.warn("Pending recovery deferred for item {}: {}",item.get("id"),e.toString());}
  }}catch(Exception e){log.warn("Pending recovery deferred: {}",e.toString());}
 }
}
