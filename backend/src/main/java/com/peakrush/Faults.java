package com.peakrush;
import org.springframework.stereotype.Component;
import org.springframework.core.env.Environment;
import org.springframework.kafka.config.KafkaListenerEndpointRegistry;
import java.util.*;
import java.util.concurrent.atomic.*;
@Component
public class Faults {
 public final AtomicBoolean consumerPaused=new AtomicBoolean(),failConsumer=new AtomicBoolean(),pauseBridge=new AtomicBoolean(),pauseOutbox=new AtomicBoolean();
 public final AtomicLong consumerDelayMs=new AtomicLong(),afterDbCommitPauseMs=new AtomicLong(),afterRedisApplyPauseMs=new AtomicLong(),afterKafkaAckPauseMs=new AtomicLong();
 final boolean lab; final KafkaListenerEndpointRegistry registry;
 // Kafka ACK 后的暂停必须给 awaitSends（12 秒）之后的确认留出续租余量，
 // 上限 = claim-idle-seconds - 12s，默认 8 秒；超过时直接拒绝而不是静默接受。
 final long maxAckPauseMs;
 public Faults(Environment env,KafkaListenerEndpointRegistry registry){
  lab=Arrays.asList(env.getActiveProfiles()).contains("lab");this.registry=registry;
  long claimIdle=env.getProperty("peakrush.bridge.claim-idle-seconds",Long.class,20L);
  this.maxAckPauseMs=Math.max(0,claimIdle*1000-12000);
 }
 public Map<String,Object> get(){check();return Json.map("consumerPaused",consumerPaused.get(),"consumerDelayMs",consumerDelayMs.get(),"failConsumer",failConsumer.get(),"pauseBridge",pauseBridge.get(),"pauseOutbox",pauseOutbox.get(),"afterDbCommitPauseMs",afterDbCommitPauseMs.get(),"afterRedisApplyPauseMs",afterRedisApplyPauseMs.get(),"afterKafkaAckPauseMs",afterKafkaAckPauseMs.get(),"maxAckPauseMs",maxAckPauseMs);}
 public Map<String,Object> set(Map<String,Object> values){
  check();
  // 先完整校验再统一应用：任一字段非法时不会留下“部分字段已生效”的半更新状态。
  List<Runnable> apply=new ArrayList<>();
  values.forEach((k,v)->{
   switch(k){
    case "consumerPaused":{boolean b=bool(v);apply.add(()->{consumerPaused.set(b);var c=registry.getListenerContainer("orders");if(c!=null){if(b)c.pause();else c.resume();}});break;}
    case "failConsumer":{boolean b=bool(v);apply.add(()->failConsumer.set(b));break;}
    case "pauseBridge":{boolean b=bool(v);apply.add(()->pauseBridge.set(b));break;}
    case "pauseOutbox":{boolean b=bool(v);apply.add(()->pauseOutbox.set(b));break;}
    case "consumerDelayMs":{long ms=delay(v);apply.add(()->consumerDelayMs.set(ms));break;}
    case "afterDbCommitPauseMs":{long ms=delay(v);apply.add(()->afterDbCommitPauseMs.set(ms));break;}
    case "afterRedisApplyPauseMs":{long ms=delay(v);apply.add(()->afterRedisApplyPauseMs.set(ms));break;}
    case "afterKafkaAckPauseMs":{long ms=delay(v);if(ms>maxAckPauseMs)throw ApiException.bad("afterKafkaAckPauseMs 不能超过 "+maxAckPauseMs+"ms（claim-idle-seconds - 12s）");apply.add(()->afterKafkaAckPauseMs.set(ms));break;}
    default:throw ApiException.bad("未知故障字段："+k);
   }
  });
  apply.forEach(Runnable::run);return get();
 }
 private boolean bool(Object x){if(!(x instanceof Boolean b))throw ApiException.bad("故障开关须为布尔值");return b;}
 private long delay(Object x){long ms=Json.number(x);if(ms<0||ms>30000)throw ApiException.bad("故障延迟范围0–30000ms");return ms;}
 public void check(){if(!lab)throw new ApiException(404,"NOT_FOUND","故障控制仅在lab配置可用");}
 public static void delay(long ms){if(ms>0)try{Thread.sleep(ms);}catch(InterruptedException e){Thread.currentThread().interrupt();throw new IllegalStateException("Interrupted",e);}}
}
