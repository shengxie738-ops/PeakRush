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
 final Store db;final Reservations redis;final Purchases purchases;final Orders orders;final Faults faults;final Json json;final long pendingTimeout;
 final String consumer="bridge-"+UUID.randomUUID();
 private static final Logger log=LoggerFactory.getLogger(Workers.class);
 public Workers(Store db,Reservations redis,Purchases purchases,Orders orders,Faults faults,Json json,@Value("${peakrush.pending-timeout-seconds}")long pendingTimeout){this.db=db;this.redis=redis;this.purchases=purchases;this.orders=orders;this.faults=faults;this.json=json;this.pendingTimeout=pendingTimeout;}
 @Scheduled(fixedDelay=50,initialDelay=4000)
 public void bridge(){
  if(faults.pauseBridge.get())return;
  try{for(var item:db.allItems()){
   if(Json.number(item.get("architecture_version"))!=4)continue;
   String stream=redis.prefix(Json.number(item.get("activity_id")),Json.number(item.get("id")))+"events";
   if(!Boolean.TRUE.equals(redis.redis.hasKey(stream)))continue;
   redis.createGroup(stream);
   var operations=redis.streams();
   var pending=operations.pending(stream,"bridge",Range.unbounded(),256);
   if(pending!=null&&!pending.isEmpty()){
    List<RecordId> ids=new ArrayList<>();for(var record:pending)if(record.getElapsedTimeSinceLastDelivery().toMillis()>=6000)ids.add(record.getId());
    if(!ids.isEmpty()&&!sendRecords(stream,operations.claim(stream,"bridge",consumer,Duration.ofSeconds(6),ids.toArray(RecordId[]::new))))return;
   }
   var records=operations.read(Consumer.from("bridge",consumer),StreamReadOptions.empty().count(256),StreamOffset.create(stream,ReadOffset.lastConsumed()));
   if(records!=null&&!sendRecords(stream,records))return;
  }}catch(Exception e){log.warn("Stream bridge deferred; unacknowledged events remain recoverable: {}",e.toString());}
 }
 private boolean sendRecords(String stream,List<MapRecord<String,String,String>> records){
  if(records==null)return true;
  List<Map.Entry<String,java.util.concurrent.CompletableFuture<org.springframework.kafka.support.SendResult<String,String>>>> sends=new ArrayList<>();
  for(var record:records){
   String payload=record.getValue().get("payload");
   if(payload==null)throw new IllegalStateException("Missing journal payload for "+record.getId());
   sends.add(Map.entry(record.getId().getValue(),purchases.enqueue(PurchaseEvent.from(json.read(payload)))));
  }
  boolean complete=true;
  for(var send:sends)try{send.getValue().get(12,java.util.concurrent.TimeUnit.SECONDS);redis.streams().acknowledge(stream,"bridge",send.getKey());}
   catch(Exception e){complete=false;log.warn("Kafka send uncertain; Stream entry {} remains pending: {}",send.getKey(),e.toString());}
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
  }}catch(Exception e){log.warn("Pending recovery deferred: {}",e.toString());}
 }
}
