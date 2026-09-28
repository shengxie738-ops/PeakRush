package io.peakrush.gateway;
import org.springframework.cloud.gateway.filter.GlobalFilter;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.ReactiveStringRedisTemplate;
import org.springframework.data.redis.core.script.DefaultRedisScript;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;
import io.micrometer.core.instrument.MeterRegistry;
import java.nio.charset.StandardCharsets;
import java.util.List;
@Component
public class PurchaseLimitFilter implements GlobalFilter,Ordered {
 private final ReactiveStringRedisTemplate redis;
 private final MeterRegistry meters;
 private final boolean enabled;
 private final List<String> limits;
 private static final DefaultRedisScript<Long> SCRIPT=new DefaultRedisScript<>("""
  for i=1,3 do
    local t=redis.call('TYPE',KEYS[i]).ok
    if t~='none' and t~='string' then return -1 end
    local n=redis.call('GET',KEYS[i])
    if n and not tonumber(n) then return -1 end
    if tonumber(n or '0')>=tonumber(ARGV[i]) then return 0 end
  end
  for i=1,3 do
    local n=redis.call('INCR',KEYS[i])
    if n==1 then redis.call('PEXPIRE',KEYS[i],1000) end
  end
  return 1
  """,Long.class);
 public PurchaseLimitFilter(ReactiveStringRedisTemplate redis,MeterRegistry meters,
  @Value("${peakrush.limits.enabled:true}") boolean enabled,
  @Value("${peakrush.limits.global-per-second:1500}") int global,
  @Value("${peakrush.limits.ip-per-second:1200}") int ip,
  @Value("${peakrush.limits.token-per-second:20}") int token) {
  if(global<1||ip<1||token<1) throw new IllegalArgumentException("Rate limits must be positive");
  this.redis=redis;this.meters=meters;this.enabled=enabled;
  this.limits=List.of(""+global,""+ip,""+token);
 }
 @Override public int getOrder(){return -100;}
 @Override public Mono<Void> filter(ServerWebExchange exchange,GatewayFilterChain chain) {
  if(!enabled||!GatewayPolicy.isPurchase(exchange.getRequest().getMethod().name(),exchange.getRequest().getPath().value()))
   return chain.filter(exchange);
  // Redis failure is admission failure. Do not accidentally turn a failed downstream request into success.
  return redis.execute(SCRIPT,GatewayPolicy.keys(exchange),limits).single()
   .onErrorReturn(-1L).flatMap(allowed->{
    if(allowed==1L) return chain.filter(exchange);
    if(allowed==0L) {
     meters.counter("peakrush.gateway.rejected","reason","rate_limit").increment();
     return reject(exchange,HttpStatus.TOO_MANY_REQUESTS,"RATE_LIMITED","请求较多，请稍后重试");
    }
    meters.counter("peakrush.gateway.rejected","reason","redis_unavailable").increment();
    return reject(exchange,HttpStatus.SERVICE_UNAVAILABLE,"ADMISSION_UNAVAILABLE","抢购入口暂不可用，请保留原请求重试");
   });
 }
 private Mono<Void> reject(ServerWebExchange exchange,HttpStatus status,String code,String message) {
  var response=exchange.getResponse(); response.setStatusCode(status);
  response.getHeaders().setContentType(MediaType.APPLICATION_JSON);
  response.getHeaders().set("Retry-After","1");
  byte[] bytes=("{\"code\":\""+code+"\",\"message\":\""+message+"\"}").getBytes(StandardCharsets.UTF_8);
  return response.writeWith(Mono.just(response.bufferFactory().wrap(bytes)));
 }
}

