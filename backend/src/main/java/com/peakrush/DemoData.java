package com.peakrush;
import org.springframework.stereotype.Component;
import org.springframework.context.annotation.Profile;
import org.springframework.boot.ApplicationArguments;
import org.springframework.boot.ApplicationRunner;
import org.slf4j.*;
import java.time.*;
import java.util.*;
@Component @Profile({"local","demo"})
public class DemoData implements ApplicationRunner {
 final Store db;final Auth auth;final Reservations redis;
 private static final Logger log=LoggerFactory.getLogger(DemoData.class);
 public DemoData(Store db,Auth auth,Reservations redis){this.db=db;this.auth=auth;this.redis=redis;}
 public void run(ApplicationArguments ignored){
  for(String name:List.of("admin","demo"))if(db.jdbc.queryForObject("SELECT COUNT(*) FROM app_user WHERE username=?",Long.class,name)==0)db.jdbc.update("INSERT INTO app_user(username,password_hash,role) VALUES(?,?,?)",name,auth.hashPassword(name+"12345"),name.equals("admin")?"ADMIN":"USER");
  if(db.jdbc.queryForObject("SELECT COUNT(*) FROM product",Long.class)==0){
   db.saveProduct(null,Json.map("name","轻羽无线耳机","description","主动降噪 · 空间音频 · 限时好价","imageUrl","/assets/product-earbuds.png","originalPrice",399));
   db.saveProduct(null,Json.map("name","复古全画幅微单相机","description","捕捉每一帧精彩，开启你的创作时刻","imageUrl","/assets/product-camera.png","originalPrice",12999));
   db.saveProduct(null,Json.map("name","全天候运动智能手表","description","健康监测 · 运动追踪 · 长效续航","imageUrl","/assets/product-watch.png","originalPrice",1599));
  }
  if(db.jdbc.queryForObject("SELECT COUNT(*) FROM activity",Long.class)==0){
   var products=db.jdbc.queryForList("SELECT id FROM product ORDER BY id");
   for(int n=0;n<7;n++){
    int product=n<3?n:0,version=n<3?3:n-3;
    Instant start=Instant.now().plusSeconds(n==1?3600:n==2?7200:-3600);
    Map<String,Object> a=db.saveActivity(null,Json.map("name",n==0?"今日限时抢购":n==1?"光影新篇 · 相机专场":n==2?"腕间科技 · 新品开抢":"V"+version+" 架构实验活动","description",n<3?"每一份热爱，都值得好价。数量有限，先到先得。":"同一业务规则下的架构性能对照","startTime",start.toString(),"endTime",Instant.now().plusSeconds(8*3600).toString(),"architectureVersion","V"+version,"items",List.of(Json.map("productId",products.get(product).get("id"),"seckillPrice",n==1?9999:n==2?1299:199,"totalStock",n==0?100:200,"limitPerUser",1))));
    if(n>=3)continue; // Architecture experiments stay in the admin draft list.
    db.jdbc.update("UPDATE activity SET status='PREHEATED' WHERE id=?",a.get("id"));
    for(var item:db.allItems())if(Json.number(item.get("activity_id"))==Json.number(a.get("id")))redis.warmup(item);
    db.jdbc.update("UPDATE activity SET status='RUNNING' WHERE id=?",a.get("id"));
    for(var item:db.allItems())if(Json.number(item.get("activity_id"))==Json.number(a.get("id")))redis.enabled(Json.number(a.get("id")),Json.number(item.get("id")),true);
   }
  }
  // Existing live inventory is never rebuilt automatically after a restart.
  log.info("Local demo users ready; seeded data is never reset on restart.");
 }
}
