package io.peakrush.gateway;
import org.springframework.web.server.ServerWebExchange;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.List;
final class GatewayPolicy {
 private GatewayPolicy() {}
 static boolean isPurchase(String method,String path) {
  return "POST".equals(method) && path.matches("/api/seckill/[^/]+/[0-9]+/[0-9]+/?");
 }
 static List<String> keys(ServerWebExchange exchange) {
  var address=exchange.getRequest().getRemoteAddress();
  String ip=address==null?"unknown":address.getAddress().getHostAddress();
  // Forwarded headers are deliberately untrusted. Configure an authenticated proxy before changing this.
  String bearer=exchange.getRequest().getHeaders().getFirst("Authorization");
  String identity=bearer==null?"anonymous:"+ip:bearer;
  return List.of("pr:{gateway}:global","pr:{gateway}:ip:"+ip,"pr:{gateway}:token:"+hash(identity));
 }
 private static String hash(String input) {
  try { return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256").digest(input.getBytes(StandardCharsets.UTF_8))); }
  catch(NoSuchAlgorithmException impossible) { throw new IllegalStateException(impossible); }
 }
}

