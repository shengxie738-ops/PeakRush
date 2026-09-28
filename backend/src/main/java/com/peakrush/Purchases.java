package com.peakrush;
import org.springframework.stereotype.Service;
import org.springframework.kafka.core.KafkaTemplate;
import java.time.*;
import java.security.*;
import java.nio.charset.StandardCharsets;
import java.util.*;
import java.util.concurrent.TimeUnit;
@Service
public class Purchases {
 final Store db; final Orders orders; final Reservations reservations; final KafkaTemplate<String,String> kafka;final Json json;final StockHints hints;
 public Purchases(Store db,Orders orders,Reservations reservations,KafkaTemplate<String,String> kafka,Json json,StockHints hints){this.db=db;this.orders=orders;this.reservations=reservations;this.kafka=kafka;this.json=json;this.hints=hints;}
 public static String digest(String s){try{return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(s.getBytes(StandardCharsets.UTF_8)));}catch(Exception e){throw new IllegalStateException(e);}}
 public Map<String,Object> path(long aid,long iid,Auth.User user){
  var item=db.item(aid,iid);
  if(!"RUNNING".equals(item.get("activity_status"))||Instant.now().isAfter(Store.instant(item.get("end_time"))))throw new ApiException(409,"ACTIVITY_UNAVAILABLE","活动当前不可抢购");
  String path=UUID.randomUUID().toString();
  reservations.redis.opsForValue().set("pr:path:"+path,user.id()+":"+aid+":"+iid,Duration.ofSeconds(120));
  return Json.map("path",path,"expiresIn",120);
 }
 public Map<String,Object> submit(long aid,long iid,String path,Auth.User user,String key,int qty){
  if(key==null||!key.matches("[A-Za-z0-9_.:-]{8,100}"))throw ApiException.bad("需要8–100位Idempotency-Key");
  if(qty<1||qty>10000)throw ApiException.bad("购买数量不合法");
  String rid=aid+"."+iid+"."+digest(user.id()+":"+key).substring(0,32),hash=digest(user.id()+":"+aid+":"+iid+":"+qty);
  var item=db.itemCached(aid,iid);int version=(int)Json.number(item.get("architecture_version"));
  if(version<2){var persisted=orders.existing(rid);if(persisted!=null){if(!hash.equals(persisted.get("payload_hash")))throw new ApiException(409,"IDEMPOTENCY_CONFLICT","相同请求标识的参数发生变化");return orders.result(persisted);}}
  if(version>=2){
   var existing=reservations.request(rid);
   if(!existing.isEmpty()){if(!hash.equals(existing.get("hash")))throw new ApiException(409,"IDEMPOTENCY_CONFLICT","相同请求标识的参数发生变化");return redisResult(rid,existing);}
  }
  if(!Objects.equals(reservations.redis.opsForValue().get("pr:path:"+path),user.id()+":"+aid+":"+iid))throw new ApiException(403,"INVALID_PATH","抢购凭证已过期或不属于当前用户");
  if(version>=2&&hints.soldOut(aid,iid))return Json.map("requestId",rid,"status","SOLD_OUT","message","商品已售罄");
  var event=new PurchaseEvent(rid,user.id(),aid,iid,qty,hash,String.valueOf(item.get("generation")),version,Instant.now().toEpochMilli(),version>=2);
  if(version<2)return orders.process(event);
  List<String> reserved=reservations.reserve(event);
  switch(reserved.get(0)){
   case "CONFLICT":throw new ApiException(409,"IDEMPOTENCY_CONFLICT","相同请求标识的参数发生变化");
   case "ERROR":throw new ApiException(503,reserved.get(1),"活动缓存不可用，请管理员检查预热状态");
   case "REJECT":throw new ApiException(409,reserved.get(1),"活动未开始、已结束或超过限购");
   case "SOLD_OUT":if(reserved.size()>2&&reserved.get(2).equals("0"))hints.mark(aid,iid);return Json.map("requestId",rid,"status","SOLD_OUT","message","商品已售罄");
   case "EXISTING":return redisResult(rid,reservations.request(rid));
   default:break;
  }
  if(version==2)return orders.process(event);
  if(version==3){try{enqueue(event);}catch(Exception ignored){/* reservation remains recoverable; never refund uncertain send */}}
  return Json.map("requestId",rid,"status","PENDING","message","排队处理中");
 }
 private Map<String,Object> redisResult(String rid,Map<String,String> r){Map<String,Object> out=Json.map("requestId",rid,"status",r.get("state"));if(r.get("orderId")!=null&&!r.get("orderId").isBlank())out.put("orderId",Long.parseLong(r.get("orderId")));if(r.get("reason")!=null&&!r.get("reason").isBlank())out.put("message",r.get("reason"));return out;}
 public java.util.concurrent.CompletableFuture<org.springframework.kafka.support.SendResult<String,String>> enqueue(PurchaseEvent e){return kafka.send("seckill-order-create",String.valueOf(e.itemId()),json.write(e));}
 public void publish(PurchaseEvent e)throws Exception{kafka.send("seckill-order-create",String.valueOf(e.itemId()),json.write(e)).get(4,TimeUnit.SECONDS);}
 public Map<String,Object> result(String rid,Auth.User user){
  reservations.prefix(rid);
  var persisted=orders.existing(rid);
  if(persisted!=null){if(Json.number(persisted.get("user_id"))!=user.id()&&!user.role().equals("ADMIN"))throw new ApiException(404,"NOT_FOUND","请求不存在");return orders.result(persisted);}
  var r=reservations.request(rid);if(r.isEmpty()||(!r.get("userId").equals(String.valueOf(user.id()))&&!user.role().equals("ADMIN")))throw new ApiException(404,"NOT_FOUND","请求不存在");
  Map<String,Object> out=Json.map("requestId",rid,"status",r.get("state"));
  if(r.get("orderId")!=null&&!r.get("orderId").isBlank())out.put("orderId",Long.parseLong(r.get("orderId")));
  var dlq=db.jdbc.queryForList("SELECT status FROM dead_letter_record WHERE request_id=?",rid);if(!dlq.isEmpty())out.put("message","等待故障恢复处理");
  return out;
 }
}
