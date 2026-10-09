package com.peakrush;
import org.springframework.stereotype.Service;
import org.springframework.jdbc.core.*;
import org.springframework.jdbc.support.*;
import org.springframework.transaction.support.TransactionTemplate;
import java.sql.*;
import java.math.BigDecimal;
import java.time.*;
import java.util.*;
@Service
@org.springframework.context.annotation.DependsOn("catalogSchema")
public class Store {
 final JdbcTemplate jdbc; final TransactionTemplate tx; final Json json;
 private record CachedItem(Map<String,Object> value,long until){}
 private final java.util.concurrent.ConcurrentHashMap<String,CachedItem> itemCache=new java.util.concurrent.ConcurrentHashMap<>();
 public Map<String,Object> itemCached(long aid,long iid){String key=aid+":"+iid;var c=itemCache.get(key);long now=System.currentTimeMillis();if(c!=null&&c.until()>now)return c.value();var value=item(aid,iid);if(itemCache.size()>2048)itemCache.clear();itemCache.put(key,new CachedItem(value,now+1000));return value;}
 public void invalidateItems(){itemCache.clear();}
 public Store(JdbcTemplate jdbc,org.springframework.transaction.PlatformTransactionManager tm,Json json){this.jdbc=jdbc;this.tx=new TransactionTemplate(tm);this.json=json;}
 public long insert(String sql,Object... args){
  KeyHolder kh=new GeneratedKeyHolder();
  jdbc.update(c->{PreparedStatement ps=c.prepareStatement(sql,Statement.RETURN_GENERATED_KEYS);for(int i=0;i<args.length;i++)ps.setObject(i+1,args[i]);return ps;},kh);
  return Objects.requireNonNull(kh.getKey()).longValue();
 }
 public Map<String,Object> one(String sql,Object...args){
  var rows=jdbc.queryForList(sql,args);if(rows.isEmpty())throw new ApiException(404,"NOT_FOUND","记录不存在");return rows.get(0);
 }
 public static Instant instant(Object value){if(value instanceof Timestamp t)return t.toInstant();if(value instanceof LocalDateTime t)return t.toInstant(ZoneOffset.UTC);return Instant.parse(String.valueOf(value));}
 public static Timestamp timestamp(Instant time){return Timestamp.from(time);}
 public static int version(Object x){String v=String.valueOf(x);if(v.matches("V[0-4]"))return Integer.parseInt(v.substring(1));if(v.matches("[0-4]"))return Integer.parseInt(v);throw ApiException.bad("版本须为V0–V4");}
 public static BigDecimal money(Object x){try{BigDecimal d=new BigDecimal(String.valueOf(x));if(d.signum()<=0||d.compareTo(new BigDecimal("999999999"))>0)throw new Exception();return d.setScale(2,java.math.RoundingMode.UNNECESSARY);}catch(Exception e){throw ApiException.bad("金额须为正数");}}
 public static int positive(Object x,int maximum){long n=Json.number(x);if(n<1||n>maximum)throw ApiException.bad("数量不在允许范围");return (int)n;}
 private String name(Map<String,Object>b){String v=Json.string(b,"name").trim();if(v.isEmpty()||v.length()>160)throw ApiException.bad("请输入有效名称");return v;}
 private static final Set<String> CATEGORIES=Set.of("数码影音","居家生活","运动户外","旅行出行","其他好物");
 static String category(Object value){String c=value==null?"其他好物":String.valueOf(value).trim();if(!CATEGORIES.contains(c))throw ApiException.bad("请选择有效商品分类");return c;}
 public Map<String,Object> product(Map<String,Object> r){return Json.map("id",r.get("id"),"name",r.get("name"),"description",r.get("description"),"imageUrl",r.get("image_url"),"originalPrice",r.get("original_price"),"category",r.getOrDefault("category","其他好物"));}
 public Map<String,Object> products(){return list(jdbc.queryForList("SELECT * FROM product WHERE active=TRUE ORDER BY id DESC").stream().map(this::product).toList());}
 public Map<String,Object> saveProduct(Long id,Map<String,Object>b){
  String n=name(b),image=Json.string(b,"imageUrl");
  if(image.length()>500||!(image.isBlank()||image.startsWith("/")||image.startsWith("https://")))throw ApiException.bad("图片须为站内路径或HTTPS地址");
  String c=category(b.containsKey("category")?b.get("category"):id==null?null:one("SELECT category FROM product WHERE id=?",id).get("category"));
  if(id==null)id=insert("INSERT INTO product(name,description,image_url,original_price,category) VALUES(?,?,?,?,?)",n,Json.string(b,"description"),image,money(b.get("originalPrice")),c);
  else{one("SELECT id FROM product WHERE id=?",id);jdbc.update("UPDATE product SET name=?,description=?,image_url=?,original_price=?,category=? WHERE id=?",n,Json.string(b,"description"),image,money(b.get("originalPrice")),c,id);}
  invalidateItems();
  return product(one("SELECT * FROM product WHERE id=?",id));
 }
 public void deleteProduct(long id){if(jdbc.queryForObject("SELECT COUNT(*) FROM seckill_item WHERE product_id=?",Long.class,id)>0)throw new ApiException(409,"PRODUCT_IN_USE","商品已绑定活动");jdbc.update("UPDATE product SET active=FALSE WHERE id=?",id);}
 public Map<String,Object> list(List<?> items){return Json.map("items",items,"total",items.size());}
 public Map<String,Object> activities(boolean admin){return list(jdbc.queryForList("SELECT id FROM activity "+(admin?"":"WHERE status NOT IN ('DRAFT','OFFLINE') ")+"ORDER BY id").stream().map(r->activity(Json.number(r.get("id")))).toList());}
 public Map<String,Object> activity(long id){
  var a=one("SELECT * FROM activity WHERE id=?",id);
  var items=jdbc.queryForList("SELECT i.*,p.name,p.description,p.image_url,p.original_price,p.category FROM seckill_item i JOIN product p ON p.id=i.product_id WHERE i.activity_id=? ORDER BY i.id",id).stream().map(r->Json.map("id",r.get("id"),"productId",r.get("product_id"),"name",r.get("name"),"description",r.get("description"),"imageUrl",r.get("image_url"),"originalPrice",r.get("original_price"),"category",r.get("category"),"seckillPrice",r.get("seckill_price"),"totalStock",r.get("total_stock"),"availableStock",r.get("available_stock"),"limitPerUser",r.get("limit_per_user"))).toList();
  String state=String.valueOf(a.get("status"));Instant now=Instant.now();
  if(state.equals("RUNNING")&&now.isAfter(instant(a.get("end_time"))))state="ENDED";
  return Json.map("id",id,"name",a.get("name"),"description",a.get("description"),"startTime",instant(a.get("start_time")),"endTime",instant(a.get("end_time")),"status",state,"architectureVersion","V"+a.get("architecture_version"),"items",items);
 }
 @SuppressWarnings("unchecked")
 public Map<String,Object> saveActivity(Long id,Map<String,Object>b){
  return tx.execute(s->{
   String n=name(b);Instant start=Instant.parse(Json.string(b,"startTime")),end=Instant.parse(Json.string(b,"endTime"));
   if(!end.isAfter(start))throw ApiException.bad("结束时间须晚于开始时间");
   int v=version(b.get("architectureVersion"));
   if(!(b.get("items") instanceof List<?> details)||details.isEmpty())throw ApiException.bad("活动至少需要一个商品");
   Long aid=id;
   if(aid==null)aid=insert("INSERT INTO activity(name,description,start_time,end_time,architecture_version) VALUES(?,?,?,?,?)",n,Json.string(b,"description"),timestamp(start),timestamp(end),v);
   else {
    var existing=one("SELECT * FROM activity WHERE id=? FOR UPDATE",aid);
    if(!existing.get("status").equals("DRAFT"))throw new ApiException(409,"ACTIVITY_IMMUTABLE","只能编辑草稿活动");
    jdbc.update("DELETE FROM seckill_item WHERE activity_id=?",aid);
    jdbc.update("UPDATE activity SET name=?,description=?,start_time=?,end_time=?,architecture_version=? WHERE id=?",n,Json.string(b,"description"),timestamp(start),timestamp(end),v,aid);
   }
   Set<Long> products=new HashSet<>();
   for(Object raw:details){
    Map<String,Object> i=(Map<String,Object>)raw;long product=Json.number(i.get("productId"));
    if(!products.add(product))throw ApiException.bad("活动商品不能重复");
    one("SELECT id FROM product WHERE id=? AND active=TRUE",product);
    int stock=positive(i.get("totalStock"),1000000),limit=positive(i.get("limitPerUser"),10000);
    insert("INSERT INTO seckill_item(activity_id,product_id,seckill_price,total_stock,available_stock,limit_per_user,generation) VALUES(?,?,?,?,?,?,?)",aid,product,money(i.get("seckillPrice")),stock,stock,limit,UUID.randomUUID().toString());
   }
   return activity(aid);
  });
 }
 public Map<String,Object> item(long aid,long iid){return one("SELECT i.*,a.start_time,a.end_time,a.status AS activity_status,a.architecture_version FROM seckill_item i JOIN activity a ON a.id=i.activity_id WHERE i.id=? AND a.id=?",iid,aid);}
 public List<Map<String,Object>> allItems(){return jdbc.queryForList("SELECT i.*,a.start_time,a.end_time,a.status AS activity_status,a.architecture_version FROM seckill_item i JOIN activity a ON a.id=i.activity_id");}
 public Map<String,Object> order(long id,Auth.User user){
  var r=one("SELECT o.*,p.name,p.image_url FROM seckill_order o JOIN seckill_item i ON i.id=o.item_id JOIN product p ON p.id=i.product_id WHERE o.id=?",id);
  if(user!=null&&Json.number(r.get("user_id"))!=user.id()&&!user.role().equals("ADMIN"))throw new ApiException(404,"NOT_FOUND","订单不存在");
  return Json.map("id",id,"requestId",r.get("request_id"),"activityId",r.get("activity_id"),"itemId",r.get("item_id"),"productName",r.get("name"),"imageUrl",r.get("image_url"),"quantity",r.get("quantity"),"unitPrice",r.get("unit_price"),"totalAmount",r.get("total_amount"),"status",r.get("status"),"createdAt",instant(r.get("created_at")),"expireTime",instant(r.get("expire_time")),"paidAt",r.get("paid_at")==null?null:instant(r.get("paid_at")));
 }
 public Map<String,Object> orders(Auth.User user){return list(jdbc.queryForList("SELECT id FROM seckill_order WHERE user_id=? ORDER BY id DESC",user.id()).stream().map(r->order(Json.number(r.get("id")),user)).toList());}
}
