package com.peakrush;
import org.springframework.stereotype.Component;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.beans.factory.annotation.Value;
import org.slf4j.*;
import java.time.*;
import java.util.*;
import org.springframework.data.redis.connection.stream.*;
import org.springframework.data.domain.Range;
@Component
public class Workers {
 final Store db;final Reservations redis;final Purchases purchases;final Orders orders;final Faults faults;final Json json;final long pendingTimeout;final long claimIdleMillis;
 final String consumer="bridge-"+UUID.randomUUID();
 private static final Logger log=LoggerFactory.getLogger(Workers.class);
 // 每个 Workers 实例最多同时持有 32 个未完成的 bridge 发送；读取上限 256 不会再一次性提交全部发送。
 private static final int SEND_CHUNK=32;
 private static final int SEND_WAIT_SECONDS=12;
 // 单次 XPENDING 只取一页，并用每个流的游标轮转，避免只扫描 PEL 最前面的 256 条。
 private static final int PENDING_PAGE=256;
 private final java.util.concurrent.Semaphore producerCapacity=new java.util.concurrent.Semaphore(SEND_CHUNK);
 private final Map<String,String> pendingCursors=new java.util.concurrent.ConcurrentHashMap<>();
 public Workers(Store db,Reservations redis,Purchases purchases,Orders orders,Faults faults,Json json,@Value("${peakrush.pending-timeout-seconds}")long pendingTimeout,@Value("${peakrush.bridge.claim-idle-seconds:12}")long claimIdleSeconds){this.db=db;this.redis=redis;this.purchases=purchases;this.orders=orders;this.faults=faults;this.json=json;this.pendingTimeout=pendingTimeout;this.claimIdleMillis=claimIdleSeconds*1000;}
 @Scheduled(fixedDelay=50,initialDelay=4000)
 public void bridge(){
  if(faults.pauseBridge.get())return;
  List<Map<String,Object>> items;
  try{items=db.allItems();}catch(Exception e){log.warn("Stream bridge deferred; activity list unavailable: {}",e.toString());return;}
  // 每个活动独立隔离：一个活动的坏记录或同步发送异常不能让后续活动整轮跳过。
  for(var item:items)try{bridgeItem(item);}
   catch(Exception e){log.warn("Stream bridge deferred for activity {}; unacknowledged events remain recoverable: {}",item.get("activity_id"),e.toString());}
 }
 private void bridgeItem(Map<String,Object> item){
  if(Json.number(item.get("architecture_version"))!=4)return;
  String stream=redis.prefix(Json.number(item.get("activity_id")),Json.number(item.get("id")))+"events";
  if(!Boolean.TRUE.equals(redis.redis.hasKey(stream)))return;
  redis.createGroup(stream);
  var operations=redis.streams();
  List<RecordId> ids=stalePending(stream,operations);
  if(!ids.isEmpty()&&!sendRecords(stream,operations.claim(stream,"bridge",consumer,Duration.ofMillis(claimIdleMillis),ids.toArray(RecordId[]::new))))return;
  var records=operations.read(Consumer.from("bridge",consumer),StreamReadOptions.empty().count(256),StreamOffset.create(stream,ReadOffset.lastConsumed()));
  if(records!=null)sendRecords(stream,records);
 }
 /**
  * 轮转扫描 PEL：XPENDING 单次只返回最前面的 256 条，固定从头读取会让第 256 条之后的
  * 陈旧记录永远得不到处理。每个流维护一个游标，每轮只扫描一页，读取代价有界且能覆盖整条 PEL。
  * 空闲阈值必须大于 Kafka delivery.timeout.ms（默认 10000），否则原实例仍在重试时条目会被
  * 另一个实例 claim，造成重复发布。
  */
 private List<RecordId> stalePending(String stream,org.springframework.data.redis.core.StreamOperations<String,String,String> operations){
  List<RecordId> ids=new ArrayList<>();
  String start=pendingCursors.getOrDefault(stream,"-");
  var page=operations.pending(stream,"bridge",Range.closed(start,"+"),PENDING_PAGE);
  if(page==null||page.isEmpty()){pendingCursors.put(stream,"-");return ids;}
  for(var record:page)if(record.getElapsedTimeSinceLastDelivery().toMillis()>=claimIdleMillis)ids.add(record.getId());
  String last=page.get(page.size()-1).getId().getValue();
  pendingCursors.put(stream,page.size()<PENDING_PAGE?"-":last);
  return ids;
 }
 private boolean sendRecords(String stream,List<MapRecord<String,String,String>> records){
  if(records==null)return true;
  boolean complete=true;
  List<String> acknowledged=new ArrayList<>();
  List<Map.Entry<String,java.util.concurrent.CompletableFuture<org.springframework.kafka.support.SendResult<String,String>>>> chunk=new ArrayList<>();
  for(var record:records){
   // 名额在创建发送前获取：等待超时不释放，容量随实际完成才归还，因此超时后不会继续追加发送。
   if(!producerCapacity.tryAcquire()){
    complete=false;log.warn("Producer send capacity busy; remaining Stream entries on {} stay pending",stream);break;
   }
   try{
    String payload=record.getValue().get("payload");
    if(payload==null)throw new IllegalStateException("Missing journal payload for "+record.getId());
    var future=Objects.requireNonNull(purchases.enqueue(PurchaseEvent.from(json.read(payload))));
    future.whenComplete((result,error)->producerCapacity.release());
    chunk.add(Map.entry(record.getId().getValue(),future));
   }catch(RuntimeException error){
    // 坏记录或同步 producer 异常单独隔离，保留在 PEL 中，其他记录继续发送。
    producerCapacity.release();complete=false;
    log.warn("Stream entry {} not sent; it stays pending: {}",record.getId(),error.toString());
    continue;
   }
   if(chunk.size()>=SEND_CHUNK){
    boolean settled=awaitSends(chunk,acknowledged);
    chunk=new ArrayList<>();
    if(!settled){complete=false;break;}
   }
  }
  if(!chunk.isEmpty()&&!awaitSends(chunk,acknowledged))complete=false;
  // XACK 与 XDEL 由同一个 Lua 脚本原子完成：已确认条目不会再被读取或 claim，
  // 两条命令之间的中断不会再留下无法自动清理的条目。
  if(!acknowledged.isEmpty())try{redis.acknowledgeAndDelete(stream,acknowledged);}
   catch(Exception e){complete=false;log.warn("Stream acknowledgement failed; {} entries stay pending: {}",acknowledged.size(),e.toString());}
  return complete;
 }
 private boolean awaitSends(List<Map.Entry<String,java.util.concurrent.CompletableFuture<org.springframework.kafka.support.SendResult<String,String>>>> chunk,List<String> acknowledged){
  try{java.util.concurrent.CompletableFuture.allOf(chunk.stream().map(Map.Entry::getValue).toArray(java.util.concurrent.CompletableFuture[]::new)).get(SEND_WAIT_SECONDS,java.util.concurrent.TimeUnit.SECONDS);}
  catch(Exception e){log.warn("Kafka batch send uncertain; unacknowledged Stream entries stay pending: {}",e.toString());}
  boolean complete=true;
  for(var send:chunk){
   var future=send.getValue();
   if(!future.isDone()||future.isCompletedExceptionally()){
    complete=false;log.warn("Kafka send uncertain; Stream entry {} remains pending",send.getKey());continue;
   }
   acknowledged.add(send.getKey());
  }
  return complete;
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
  try{for(var row:db.jdbc.queryForList("SELECT id FROM seckill_order WHERE status='CREATED' AND expire_time<=UTC_TIMESTAMP(3) ORDER BY expire_time LIMIT 100"))orders.expire(Json.number(row.get("id")));}catch(Exception e){log.debug("Expiry retry: {}",e.toString());}
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
