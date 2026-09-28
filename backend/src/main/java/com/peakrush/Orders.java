package com.peakrush;
import org.springframework.stereotype.Service;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DuplicateKeyException;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
@Service
public class Orders {
 final Store db; final Json json; final long ttl;
 public Orders(Store db,Json json,@Value("${peakrush.order-ttl-seconds}")long ttl){this.db=db;this.json=json;this.ttl=ttl;}
 private void initialize(PurchaseEvent e){
  db.jdbc.update("INSERT INTO seckill_request(request_id,user_id,activity_id,item_id,quantity,payload_hash,generation,redis_reserved,status,accepted_at) VALUES(?,?,?,?,?,?,?,?,'PENDING',?) ON DUPLICATE KEY UPDATE request_id=request_id",e.requestId(),e.userId(),e.activityId(),e.itemId(),e.quantity(),e.payloadHash(),e.generation(),e.redisReserved(),Store.timestamp(Instant.ofEpochMilli(e.acceptedAt())));
 }
 public Map<String,Object> existing(String rid){
  var rows=db.jdbc.queryForList("SELECT * FROM seckill_request WHERE request_id=?",rid);return rows.isEmpty()?null:rows.get(0);
 }
 public Map<String,Object> result(Map<String,Object> r){
  Map<String,Object> out=Json.map("requestId",r.get("request_id"),"status",r.get("status"));
  if(r.get("reason")!=null)out.put("message",r.get("reason"));
  if(r.get("order_id")!=null){out.put("orderId",r.get("order_id"));var states=db.jdbc.queryForList("SELECT status FROM seckill_order WHERE id=?",r.get("order_id"));if(!states.isEmpty())out.put("orderStatus",states.get(0).get("status"));}
  return out;
 }
 public Map<String,Object> process(PurchaseEvent e){
  try{return db.tx.execute(s->{
   initialize(e);
   var request=db.one("SELECT * FROM seckill_request WHERE request_id=? FOR UPDATE",e.requestId());
   if(!e.payloadHash().equals(request.get("payload_hash")))throw new ApiException(409,"IDEMPOTENCY_CONFLICT","请求标识已用于不同参数");
   if(!"PENDING".equals(request.get("status")))return result(request);
   var item=db.one("SELECT i.*,a.status AS activity_status,a.start_time,a.end_time,a.architecture_version FROM seckill_item i JOIN activity a ON a.id=i.activity_id WHERE i.id=? AND i.activity_id=?"+(e.version()==0?" FOR UPDATE":""),e.itemId(),e.activityId());
   if(!e.generation().equals(item.get("generation")))throw new BusinessReject("STALE_GENERATION");
   if(e.quantity()<1||e.quantity()>Json.number(item.get("limit_per_user")))throw new BusinessReject("LIMIT_EXCEEDED");
   if(e.version()<2)validateWindow(item,Instant.now());
   Instant now=Instant.now();BigDecimal price=(BigDecimal)item.get("seckill_price");
   long oid=db.insert("INSERT INTO seckill_order(request_id,user_id,activity_id,item_id,quantity,unit_price,total_amount,status,created_at,expire_time) VALUES(?,?,?,?,?,?,?,'CREATED',?,?)",e.requestId(),e.userId(),e.activityId(),e.itemId(),e.quantity(),price,price.multiply(BigDecimal.valueOf(e.quantity())),Store.timestamp(now),Store.timestamp(now.plusSeconds(ttl)));
   if(e.version()==0){
    if(Json.number(item.get("available_stock"))<e.quantity())throw new BusinessReject("SOLD_OUT");
    db.jdbc.update("UPDATE seckill_item SET available_stock=available_stock-?,version=version+1 WHERE id=?",e.quantity(),e.itemId());
   }else if(db.jdbc.update("UPDATE seckill_item SET available_stock=available_stock-?,version=version+1 WHERE id=? AND available_stock>=?",e.quantity(),e.itemId(),e.quantity())!=1)throw new BusinessReject("SOLD_OUT");
   db.jdbc.update("UPDATE seckill_request SET status='SUCCESS',order_id=?,state_version=1 WHERE request_id=?",oid,e.requestId());
   db.jdbc.update("INSERT INTO stock_change_log(operation_key,request_id,item_id,order_id,change_type,delta) VALUES(?,?,?,?,'ALLOCATE',?)","allocate:"+e.requestId(),e.requestId(),e.itemId(),oid,-e.quantity());
   var done=db.one("SELECT * FROM seckill_request WHERE request_id=?",e.requestId());outbox(done);
   db.jdbc.update("UPDATE dead_letter_record SET status='RESOLVED' WHERE request_id=?",e.requestId());
   return result(done);
  });}catch(BusinessReject b){return fail(e,b.getMessage());}
  catch(DuplicateKeyException duplicate){
   Map<String,Object> request=existing(e.requestId());
   if(request!=null&&!"PENDING".equals(request.get("status")))return result(request);
   Long count=db.jdbc.queryForObject("SELECT COUNT(*) FROM seckill_order WHERE user_id=? AND activity_id=? AND item_id=?",Long.class,e.userId(),e.activityId(),e.itemId());
   if(count!=null&&count>0)return fail(e,"ALREADY_PURCHASED");
   throw duplicate;
  }
 }
 static class BusinessReject extends RuntimeException {BusinessReject(String c){super(c);}}
 public static void validateWindow(Map<String,Object> item,Instant now){
  if(!"RUNNING".equals(item.get("activity_status")))throw new BusinessReject("ACTIVITY_UNAVAILABLE");
  if(now.isBefore(Store.instant(item.get("start_time"))))throw new BusinessReject("NOT_STARTED");
  if(now.isAfter(Store.instant(item.get("end_time"))))throw new BusinessReject("ENDED");
 }
 public Map<String,Object> fail(PurchaseEvent e,String reason){
  return db.tx.execute(s->{
   initialize(e);var r=db.one("SELECT * FROM seckill_request WHERE request_id=? FOR UPDATE",e.requestId());
   if(!e.payloadHash().equals(r.get("payload_hash")))throw new ApiException(409,"IDEMPOTENCY_CONFLICT","请求参数冲突");
   if(!"PENDING".equals(r.get("status")))return result(r);
   String state=!e.redisReserved()&&reason.equals("SOLD_OUT")?"SOLD_OUT":"FAILED";
   db.jdbc.update("UPDATE seckill_request SET status=?,reason=?,state_version=state_version+1 WHERE request_id=?",state,reason,e.requestId());
   var done=db.one("SELECT * FROM seckill_request WHERE request_id=?",e.requestId());outbox(done);return result(done);
  });
 }
 public void outbox(Map<String,Object> r){
  if(!Boolean.TRUE.equals(r.get("redis_reserved"))&&!"1".equals(String.valueOf(r.get("redis_reserved"))))return;
  String rid=String.valueOf(r.get("request_id"));
  Map<String,Object> payload=Json.map("requestId",rid,"generation",r.get("generation"),"userId",r.get("user_id"),"status",r.get("status"),"orderId",r.get("order_id"),"stateVersion",r.get("state_version"),"reason",r.get("reason"));
  db.jdbc.update("INSERT INTO recovery_outbox(operation_key,request_id,payload,next_retry_at) VALUES(?,?,?,UTC_TIMESTAMP(3)) ON DUPLICATE KEY UPDATE operation_key=operation_key",rid+":"+r.get("state_version"),rid,json.write(payload));
 }
 private void closeLocked(Map<String,Object> o,String target){
  if(!o.get("status").equals("CREATED"))return;
  long oid=Json.number(o.get("id"));String rid=String.valueOf(o.get("request_id"));
  if(db.jdbc.update("UPDATE seckill_order SET status=? WHERE id=? AND status='CREATED'",target,oid)!=1)return;
  db.jdbc.update("UPDATE seckill_item SET available_stock=available_stock+?,version=version+1 WHERE id=?",o.get("quantity"),o.get("item_id"));
  db.jdbc.update("UPDATE seckill_request SET status=?,state_version=state_version+1 WHERE request_id=?",target,rid);
  db.jdbc.update("INSERT INTO stock_change_log(operation_key,request_id,item_id,order_id,change_type,delta) VALUES(?,?,?,?,?,?)","release:"+rid,rid,o.get("item_id"),oid,target,o.get("quantity"));
  outbox(db.one("SELECT * FROM seckill_request WHERE request_id=?",rid));
 }
 public Map<String,Object> change(long oid,Auth.User user,boolean pay){
  db.order(oid,user);
  boolean expired=Boolean.TRUE.equals(db.tx.execute(s->{
   var initial=db.one("SELECT request_id FROM seckill_order WHERE id=?",oid);
   db.one("SELECT request_id FROM seckill_request WHERE request_id=? FOR UPDATE",initial.get("request_id"));
   var o=db.one("SELECT * FROM seckill_order WHERE id=? FOR UPDATE",oid);
   String state=String.valueOf(o.get("status"));
   if(pay&&state.equals("PAID"))return false;
   if(!pay&&(state.equals("CANCELLED")||state.equals("CLOSED")))return false;
   if(!state.equals("CREATED"))throw new ApiException(409,"ORDER_TERMINAL","订单状态不允许此操作");
   boolean timeout=!Store.instant(o.get("expire_time")).isAfter(Instant.now());
   if(timeout){closeLocked(o,"CLOSED");return pay;}
   if(pay){
    db.jdbc.update("UPDATE seckill_order SET status='PAID',paid_at=UTC_TIMESTAMP(3) WHERE id=? AND status='CREATED'",oid);
    db.jdbc.update("INSERT INTO payment_record(order_id,pay_no,status,paid_at) VALUES(?,?,'PAID',UTC_TIMESTAMP(3))",oid,"mock-"+oid);
   }else closeLocked(o,"CANCELLED");
   return false;
  }));
  if(expired)throw new ApiException(409,"ORDER_EXPIRED","订单已超时关闭");
  return db.order(oid,user);
 }
 public void expire(long oid){
  db.tx.executeWithoutResult(s->{
   var initial=db.one("SELECT request_id FROM seckill_order WHERE id=?",oid);
   db.one("SELECT request_id FROM seckill_request WHERE request_id=? FOR UPDATE",initial.get("request_id"));
   var o=db.one("SELECT * FROM seckill_order WHERE id=? FOR UPDATE",oid);
   if("CREATED".equals(o.get("status"))&&!Store.instant(o.get("expire_time")).isAfter(Instant.now()))closeLocked(o,"CLOSED");
  });
 }
}
