package com.peakrush;
import org.springframework.stereotype.Service;
import org.springframework.data.redis.core.*;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.core.io.ClassPathResource;
import java.nio.charset.StandardCharsets;
import java.util.*;
@Service
public class Reservations {
 final StringRedisTemplate redis; final Json json;final StockHints hints;
 private final DefaultRedisScript<List> reserve;
 private final DefaultRedisScript<String> finalize;
 public Reservations(StringRedisTemplate redis,Json json,StockHints hints){
  this.redis=redis;this.json=json;this.hints=hints;
  reserve=new DefaultRedisScript<>();reserve.setLocation(new ClassPathResource("reserve.lua"));reserve.setResultType(List.class);
  finalize=new DefaultRedisScript<>();finalize.setLocation(new ClassPathResource("finalize.lua"));finalize.setResultType(String.class);
 }
 public String prefix(long aid,long iid){return "pr:{"+aid+":"+iid+"}:";}
 public String prefix(String rid){String[] p=rid.split("\\.");if(p.length!=3||!p[0].matches("[0-9]+")||!p[1].matches("[0-9]+")||!p[2].matches("[a-f0-9]{32}"))throw new ApiException(404,"NOT_FOUND","请求不存在");return prefix(Long.parseLong(p[0]),Long.parseLong(p[1]));}
 public Map<String,String> request(String rid){Map<Object,Object> data=redis.opsForHash().entries(prefix(rid)+"req:"+rid);Map<String,String> out=new LinkedHashMap<>();data.forEach((k,v)->out.put(k.toString(),v.toString()));return out;}
 public List<String> reserve(PurchaseEvent e){
  String p=prefix(e.activityId(),e.itemId());
  List<?> result=redis.execute(reserve,List.of(p+"req:"+e.requestId(),p+"stock",p+"users",p+"meta",p+"events",p+"pending"),String.valueOf(e.userId()),String.valueOf(e.quantity()),e.payloadHash(),e.generation(),e.requestId(),json.write(e),String.valueOf(e.version()));
  if(result==null)throw new IllegalStateException("Redis returned no reservation result");
  return result.stream().map(Object::toString).toList();
 }
 public void warmup(Map<String,Object> item){
  String p=prefix(Json.number(item.get("activity_id")),Json.number(item.get("id")));
  boolean meta=Boolean.TRUE.equals(redis.hasKey(p+"meta")),stock=Boolean.TRUE.equals(redis.hasKey(p+"stock"));
  boolean mayInitialize=List.of("DRAFT","PREHEATED").contains(String.valueOf(item.get("activity_status")))&&Json.number(item.get("total_stock"))==Json.number(item.get("available_stock"));
  if(meta!=stock||(!meta&&!mayInitialize))throw new ApiException(409,"RECOVERY_REQUIRED","运行中库存丢失，禁止重新预热覆盖预占");
  if(!meta){try(var cursor=redis.scan(ScanOptions.scanOptions().match(p+"req:*").count(100).build())){if(cursor.hasNext())throw new ApiException(409,"RECOVERY_REQUIRED","存在未清理请求，禁止重建库存");}}
  var script=new DefaultRedisScript<Long>();script.setLocation(new ClassPathResource("warmup.lua"));script.setResultType(Long.class);
  Long result=redis.execute(script,List.of(p+"meta",p+"stock",p+"users",p+"events",p+"pending"),String.valueOf(item.get("available_stock")),String.valueOf(item.get("generation")),String.valueOf(item.get("limit_per_user")),String.valueOf(Store.instant(item.get("start_time")).toEpochMilli()),String.valueOf(Store.instant(item.get("end_time")).toEpochMilli()),"RUNNING".equals(item.get("activity_status"))?"1":"0",mayInitialize?"1":"0");
  if(result==null||result<0)throw new ApiException(409,"RECOVERY_REQUIRED","库存工作集不完整，禁止覆盖");
 }
 public void enabled(long aid,long iid,boolean enabled){String key=prefix(aid,iid)+"meta";if(Boolean.TRUE.equals(redis.hasKey(key)))redis.opsForHash().put(key,"enabled",enabled?"1":"0");}
 public void apply(Map<String,Object> task){
  String rid=Json.string(task,"requestId"),p=prefix(rid);
  String outcome=redis.execute(finalize,List.of(p+"req:"+rid,p+"stock",p+"users",p+"meta",p+"pending"),Json.string(task,"generation"),Json.string(task,"status"),Json.string(task,"orderId"),Json.string(task,"userId"),rid,Json.string(task,"stateVersion"),Json.string(task,"reason"));
  if(!"OK".equals(outcome))throw new IllegalStateException("Redis recovery: "+outcome);
  if(List.of("FAILED","CANCELLED","CLOSED").contains(Json.string(task,"status")))hints.clear(rid);
 }
 public StreamOperations<String,String,String> streams(){return redis.<String,String>opsForStream();}
 public void createGroup(String stream){try{streams().createGroup(stream,org.springframework.data.redis.connection.stream.ReadOffset.from("0-0"),"bridge");}catch(Exception e){if(!Objects.toString(e.getMessage(),"").contains("BUSYGROUP")&&!Objects.toString(e.getCause(),"").contains("BUSYGROUP"))throw e;}}
}