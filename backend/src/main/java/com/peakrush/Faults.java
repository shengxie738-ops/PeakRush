package com.peakrush;
import org.springframework.stereotype.Component;
import org.springframework.core.env.Environment;
import org.springframework.kafka.config.KafkaListenerEndpointRegistry;
import java.util.*;
import java.util.concurrent.atomic.*;
@Component
public class Faults {
 public final AtomicBoolean consumerPaused=new AtomicBoolean(),failConsumer=new AtomicBoolean(),pauseBridge=new AtomicBoolean(),pauseOutbox=new AtomicBoolean();
 public final AtomicLong consumerDelayMs=new AtomicLong(),afterDbCommitPauseMs=new AtomicLong(),afterRedisApplyPauseMs=new AtomicLong();
 final boolean lab; final KafkaListenerEndpointRegistry registry;
 public Faults(Environment env,KafkaListenerEndpointRegistry registry){lab=Arrays.asList(env.getActiveProfiles()).contains("lab");this.registry=registry;}
 public Map<String,Object> get(){check();return Json.map("consumerPaused",consumerPaused.get(),"consumerDelayMs",consumerDelayMs.get(),"failConsumer",failConsumer.get(),"pauseBridge",pauseBridge.get(),"pauseOutbox",pauseOutbox.get(),"afterDbCommitPauseMs",afterDbCommitPauseMs.get(),"afterRedisApplyPauseMs",afterRedisApplyPauseMs.get());}
 public Map<String,Object> set(Map<String,Object> values){
  check();values.forEach((k,v)->{
   switch(k){
    case "consumerPaused":consumerPaused.set(bool(v));var c=registry.getListenerContainer("orders");if(c!=null){if(consumerPaused.get())c.pause();else c.resume();}break;
    case "failConsumer":failConsumer.set(bool(v));break;
    case "pauseBridge":pauseBridge.set(bool(v));break;
    case "pauseOutbox":pauseOutbox.set(bool(v));break;
    case "consumerDelayMs":consumerDelayMs.set(delay(v));break;
    case "afterDbCommitPauseMs":afterDbCommitPauseMs.set(delay(v));break;
    case "afterRedisApplyPauseMs":afterRedisApplyPauseMs.set(delay(v));break;
    default:throw ApiException.bad("未知故障字段："+k);
   }
  });return get();
 }
 private boolean bool(Object x){if(!(x instanceof Boolean b))throw ApiException.bad("故障开关须为布尔值");return b;}
 private long delay(Object x){long ms=Json.number(x);if(ms<0||ms>30000)throw ApiException.bad("故障延迟范围0–30000ms");return ms;}
 public void check(){if(!lab)throw new ApiException(404,"NOT_FOUND","故障控制仅在lab配置可用");}
 public static void delay(long ms){if(ms>0)try{Thread.sleep(ms);}catch(InterruptedException e){Thread.currentThread().interrupt();throw new IllegalStateException("Interrupted",e);}}
}
