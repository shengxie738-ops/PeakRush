package com.peakrush;
import org.springframework.stereotype.Service;
import io.micrometer.core.instrument.*;
import java.util.*;
import java.util.concurrent.TimeUnit;
@Service
public class Admin {
 final Store db;final Reservations redis;final Orders orders;final Purchases purchases;final Json json;final MeterRegistry meters;final KafkaLag lag;
 public Admin(Store db,Reservations redis,Orders orders,Purchases purchases,Json json,MeterRegistry meters,KafkaLag lag){this.db=db;this.redis=redis;this.orders=orders;this.purchases=purchases;this.json=json;this.meters=meters;this.lag=lag;}
 public Map<String,Object> lifecycle(long aid,String action){
  var activity=db.one("SELECT * FROM activity WHERE id=?",aid);
  switch(action){
   case "warmup":
    if("OFFLINE".equals(activity.get("status")))throw new ApiException(409,"ACTIVITY_OFFLINE","下线活动不可预热");
    db.jdbc.update("UPDATE activity SET status='PREHEATED' WHERE id=? AND status='DRAFT'",aid);
    for(var item:db.allItems())if(Json.number(item.get("activity_id"))==aid)redis.warmup(item);
    break;
   case "activate":
    if(!List.of("PREHEATED","RUNNING").contains(String.valueOf(activity.get("status"))))throw new ApiException(409,"NOT_PREHEATED","请先预热活动");
    if(!Store.instant(activity.get("end_time")).isAfter(java.time.Instant.now()))throw new ApiException(409,"ENDED","活动已结束");
    for(var item:db.allItems())if(Json.number(item.get("activity_id"))==aid){String p=redis.prefix(aid,Json.number(item.get("id")));if(!Boolean.TRUE.equals(redis.redis.hasKey(p+"stock")))throw new ApiException(409,"NOT_PREHEATED","库存尚未预热");}
    db.jdbc.update("UPDATE activity SET status='RUNNING' WHERE id=?",aid);
    for(var item:db.allItems())if(Json.number(item.get("activity_id"))==aid)redis.enabled(aid,Json.number(item.get("id")),true);
    break;
   case "offline":
    db.jdbc.update("UPDATE activity SET status='OFFLINE' WHERE id=?",aid);
    for(var item:db.allItems())if(Json.number(item.get("activity_id"))==aid)redis.enabled(aid,Json.number(item.get("id")),false);
    break;
   default:throw ApiException.bad("未知操作");
  }
  db.invalidateItems();return db.activity(aid);
 }
 public Map<String,Object> deadLetters(){return db.list(db.jdbc.queryForList("SELECT id,request_id AS requestId,reason,status,attempts,created_at AS createdAt FROM dead_letter_record ORDER BY id DESC"));}
 public Map<String,Object> deadLetter(long id,String action){
  var r=db.one("SELECT * FROM dead_letter_record WHERE id=?",id);
  if(List.of("ABORTED","RESOLVED").contains(String.valueOf(r.get("status"))))return deadLetterView(id);
  PurchaseEvent event;
  try{event=PurchaseEvent.from(json.read(String.valueOf(r.get("payload"))));}catch(Exception e){throw new ApiException(409,"INVALID_EVENT","消息无法解析，请人工检查");}
  if(action.equals("abort")){
   orders.fail(event,"ADMIN_ABORTED");
   db.jdbc.update("UPDATE dead_letter_record SET status=IF(EXISTS(SELECT 1 FROM seckill_request WHERE request_id=? AND status IN ('SUCCESS','CLOSED','CANCELLED')),'RESOLVED','ABORTED') WHERE id=?",event.requestId(),id);
  }else if(action.equals("retry")){
   var existing=orders.existing(event.requestId());
   if(existing!=null&&!"PENDING".equals(existing.get("status"))){db.jdbc.update("UPDATE dead_letter_record SET status=? WHERE id=?",existing.get("status").equals("FAILED")?"ABORTED":"RESOLVED",id);return deadLetterView(id);}
   try{purchases.publish(event);}catch(Exception e){throw new ApiException(503,"PUBLISH_UNCERTAIN","重发结果暂不确定，可使用同一记录重试");}
   db.jdbc.update("UPDATE dead_letter_record SET status='REPLAYED',attempts=attempts+1 WHERE id=? AND status IN ('OPEN','REPLAYED')",id);
  }else throw ApiException.bad("未知操作");
  return deadLetterView(id);
 }
 private Map<String,Object> deadLetterView(long id){return db.one("SELECT id,request_id AS requestId,reason,status,attempts,created_at AS createdAt FROM dead_letter_record WHERE id=?",id);}
 public Map<String,Object> experiments(){return db.list(db.jdbc.queryForList("SELECT id,name,CONCAT('V',architecture_version) AS architectureVersion,concurrency_count AS concurrency,duration_seconds AS durationSeconds,stock,notes,created_at AS createdAt FROM experiment ORDER BY id DESC"));}
 public Map<String,Object> experiment(long id){
  var r=db.one("SELECT id,name,CONCAT('V',architecture_version) AS architectureVersion,concurrency_count AS concurrency,duration_seconds AS durationSeconds,stock,notes,created_at AS createdAt,results_json FROM experiment WHERE id=?",id);
  Object results=r.remove("results_json");r.put("results",results==null?null:json.read(results.toString()));return r;
 }
 public Map<String,Object> createExperiment(Map<String,Object> b){
  String name=Json.string(b,"name");if(name.isBlank()||name.length()>160)throw ApiException.bad("实验名称不合法");
  long id=db.insert("INSERT INTO experiment(name,architecture_version,concurrency_count,duration_seconds,stock,notes) VALUES(?,?,?,?,?,?)",name,Store.version(b.get("architectureVersion")),Store.positive(b.get("concurrency"),100000),Store.positive(b.get("durationSeconds"),86400),Store.positive(b.get("stock"),10000000),Json.string(b,"notes"));
  return experiment(id);
 }
 public Map<String,Object> results(long id,Map<String,Object> data){db.one("SELECT id FROM experiment WHERE id=?",id);db.jdbc.update("UPDATE experiment SET results_json=? WHERE id=?",json.write(data),id);return experiment(id);}
 public Map<String,Object> metrics(){
  List<Map<String,Object>> inventory=new ArrayList<>();long pending=0,redisStock=0;boolean available=true;
  for(var i:db.allItems()){
   long iid=Json.number(i.get("id")),aid=Json.number(i.get("activity_id"));
   Long stock=null,count=0L;try{if(Json.number(i.get("architecture_version"))>=2){String p=redis.prefix(aid,iid);String raw=redis.redis.opsForValue().get(p+"stock");stock=raw==null?null:Long.valueOf(raw);count=redis.redis.opsForZSet().zCard(p+"pending");if(stock!=null)redisStock+=stock;if(count!=null)pending+=count;}}catch(Exception e){available=false;}
   long occupied=db.jdbc.queryForObject("SELECT COALESCE(SUM(quantity),0) FROM seckill_order WHERE item_id=? AND status IN ('CREATED','PAID')",Long.class,iid);
   inventory.add(Json.map("id",iid,"activityId",aid,"architectureVersion","V"+i.get("architecture_version"),"totalStock",i.get("total_stock"),"availableStock",i.get("available_stock"),"redisAvailableStock",stock,"occupiedQuantity",occupied,"pendingReservations",count));
  }
  long orders=db.jdbc.queryForObject("SELECT COUNT(*) FROM seckill_order",Long.class);
  long failures=db.jdbc.queryForObject("SELECT COUNT(*) FROM seckill_request WHERE status IN ('FAILED','SOLD_OUT')",Long.class);
  Double p95=null;var timer=meters.find("peakrush.api.duration").timer();if(timer!=null){for(var p:timer.takeSnapshot().percentileValues())if(p.percentile()==.95)p95=p.value(TimeUnit.MILLISECONDS);}
  return Json.map("requests",db.jdbc.queryForObject("SELECT COUNT(*) FROM seckill_request",Long.class)+pending,"successes",orders,"failures",failures,"pending",pending,"orders",orders,"paidOrders",db.jdbc.queryForObject("SELECT COUNT(*) FROM seckill_order WHERE status='PAID'",Long.class),"dbAvailableStock",db.jdbc.queryForObject("SELECT COALESCE(SUM(available_stock),0) FROM seckill_item",Long.class),"redisAvailableStock",available?redisStock:null,"outboxPending",db.jdbc.queryForObject("SELECT COUNT(*) FROM recovery_outbox WHERE status='PENDING'",Long.class),"deadLetters",db.jdbc.queryForObject("SELECT COUNT(*) FROM dead_letter_record WHERE status IN ('OPEN','REPLAYED')",Long.class),"latencyP95Ms",p95,"kafkaLag",lag.read(),"versions",db.jdbc.queryForList("SELECT CONCAT('V',architecture_version) AS version,COUNT(*) AS activities FROM activity GROUP BY architecture_version"),"inventory",inventory,"requestStates",db.jdbc.queryForList("SELECT status,COUNT(*) AS count FROM seckill_request GROUP BY status"));
 }
}
