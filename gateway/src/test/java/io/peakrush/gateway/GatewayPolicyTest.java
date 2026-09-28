package io.peakrush.gateway;
import org.junit.jupiter.api.Test;
import org.springframework.mock.http.server.reactive.MockServerHttpRequest;
import org.springframework.mock.web.server.MockServerWebExchange;
import java.net.InetSocketAddress;
import static org.assertj.core.api.Assertions.*;
class GatewayPolicyTest {
 @Test void forwardedHeaderCannotEvadeIpQuota() {
  var first=MockServerWebExchange.from(MockServerHttpRequest.post("/api/seckill/token/1/2")
   .remoteAddress(new InetSocketAddress("127.0.0.1",9000)).header("X-Forwarded-For","1.1.1.1").build());
  var second=MockServerWebExchange.from(MockServerHttpRequest.post("/api/seckill/token/1/2")
   .remoteAddress(new InetSocketAddress("127.0.0.1",9001)).header("X-Forwarded-For","2.2.2.2").build());
  assertThat(GatewayPolicy.keys(first)).isEqualTo(GatewayPolicy.keys(second));
 }
 @Test void separateAuthenticatedBuyersShareGlobalAndIpQuotaButHaveSeparateTokenQuota() {
  var first=MockServerWebExchange.from(MockServerHttpRequest.post("/api/seckill/t/1/2").header("Authorization","Bearer first").build());
  var second=MockServerWebExchange.from(MockServerHttpRequest.post("/api/seckill/t/1/2").header("Authorization","Bearer second").build());
  assertThat(GatewayPolicy.keys(first).subList(0,2)).isEqualTo(GatewayPolicy.keys(second).subList(0,2));
  assertThat(GatewayPolicy.keys(first).get(2)).isNotEqualTo(GatewayPolicy.keys(second).get(2));
  assertThat(GatewayPolicy.keys(first).get(2)).doesNotContain("first");
 }
 @Test void resultPollingDoesNotConsumePurchaseQuota() {
  assertThat(GatewayPolicy.isPurchase("GET","/api/seckill/result/abc")).isFalse();
  assertThat(GatewayPolicy.isPurchase("POST","/api/seckill/1/2/path")).isFalse();
  assertThat(GatewayPolicy.isPurchase("POST","/api/seckill/abc/1/2")).isTrue();
 }
}

