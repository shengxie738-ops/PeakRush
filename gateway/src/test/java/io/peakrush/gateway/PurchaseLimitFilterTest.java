package io.peakrush.gateway;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.data.redis.connection.lettuce.LettuceConnectionFactory;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.http.HttpStatus;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import reactor.core.publisher.Flux;
import reactor.core.publisher.Mono;
import java.util.List;
import java.util.concurrent.atomic.AtomicBoolean;
import static org.assertj.core.api.Assertions.assertThat;

class PurchaseLimitFilterTest {
 private static MockServerWebExchange purchase(){return MockServerWebExchange.from(MockServerHttpRequest.post("/api/seckill/t/1/2").build());}
 private static GatewayFilterChain chain(AtomicBoolean downstream){return exchange->{downstream.set(true);return Mono.empty();};}
 private static String body(MockServerWebExchange exchange){return exchange.getResponse().getBodyAsString().block();}

 @Test void redisFailureRejectsWith503AndDoesNotCallDownstream(){
  var redis=new ReactiveStringRedisTemplate(new LettuceConnectionFactory("127.0.0.1",1)){
   @Override public <T> Flux<T> execute(RedisScript<T> script,List<String> keys,List<?> args){return Flux.error(new IllegalStateException("redis down"));}
   @Override public <T> Flux<T> execute(RedisScript<T> script,List<String> keys,Object... args){return Flux.error(new IllegalStateException("redis down"));}
  };
  var meters=new SimpleMeterRegistry();
  var exchange=purchase();var downstream=new AtomicBoolean();
  new PurchaseLimitFilter(redis,meters,true,10,10,10).filter(exchange,chain(downstream)).block();
  assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.SERVICE_UNAVAILABLE);
  assertThat(body(exchange)).contains("ADMISSION_UNAVAILABLE");
  assertThat(downstream).isFalse();
  assertThat(meters.counter("peakrush.gateway.rejected","reason","redis_unavailable").count()).isEqualTo(1.0);
 }

 @Test @EnabledIfEnvironmentVariable(named="PEAKRUSH_INTEGRATION_TESTS",matches="true")
 void realLuaAllowsTwoThenRateLimitsTheThird(){
  var factory=new LettuceConnectionFactory(System.getenv().getOrDefault("REDIS_HOST","127.0.0.1"),
   Integer.parseInt(System.getenv().getOrDefault("REDIS_PORT","16379")));
  factory.afterPropertiesSet();factory.start();
  try{
   var redis=new ReactiveStringRedisTemplate(factory);
   redis.delete(GatewayPolicy.keys(purchase()).toArray(String[]::new)).block();
   var filter=new PurchaseLimitFilter(redis,new SimpleMeterRegistry(),true,2,1000,1000);
   for(int n=0;n<2;n++){
    var allowed=new AtomicBoolean();var exchange=purchase();
    filter.filter(exchange,chain(allowed)).block();
    assertThat(allowed).as("第 %d 次请求应被放行",n+1).isTrue();
   }
   var allowed=new AtomicBoolean();var exchange=purchase();
   filter.filter(exchange,chain(allowed)).block();
   assertThat(allowed).isFalse();
   assertThat(exchange.getResponse().getStatusCode()).isEqualTo(HttpStatus.TOO_MANY_REQUESTS);
   assertThat(body(exchange)).contains("RATE_LIMITED");
   redis.delete(GatewayPolicy.keys(purchase()).toArray(String[]::new)).block();
  }finally{factory.destroy();}
 }
}
