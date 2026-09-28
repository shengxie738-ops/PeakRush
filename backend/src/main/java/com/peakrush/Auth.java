package com.peakrush;
import jakarta.servlet.http.*;
import org.springframework.stereotype.Component;
import org.springframework.core.env.Environment;
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder;
import org.springframework.jdbc.core.JdbcTemplate;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.time.Instant;
import java.util.*;
import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
@Component
public class Auth {
 public record User(long id,String username,String role) {}
 private final JdbcTemplate jdbc; private final Json json; private final byte[] secret;
 private final BCryptPasswordEncoder passwords=new BCryptPasswordEncoder(10);
 private record CachedUser(User user,long until){}
 private final java.util.concurrent.ConcurrentHashMap<Long,CachedUser> userCache=new java.util.concurrent.ConcurrentHashMap<>();
 public Auth(JdbcTemplate jdbc,Json json,Environment env){
  this.jdbc=jdbc;this.json=json;
  String configured=env.getProperty("peakrush.jwt-secret","");
  boolean local=Arrays.stream(env.getActiveProfiles().length==0?env.getDefaultProfiles():env.getActiveProfiles()).anyMatch(p->p.equals("local")||p.equals("demo"));
  if(configured.length()<32){if(!local)throw new IllegalStateException("JWT_SECRET must contain at least 32 characters outside local/demo");configured="PeakRush_LOCAL_ONLY_not_for_deployment_2026";}
  secret=configured.getBytes(StandardCharsets.UTF_8);
 }
 public String hashPassword(String password){return passwords.encode(password);}
 public Map<String,Object> login(Map<String,Object> input,boolean register){
  String name=Json.string(input,"username").trim(),password=Json.string(input,"password");
  if(!name.matches("[A-Za-z0-9_]{3,40}")||password.length()<8||password.getBytes(StandardCharsets.UTF_8).length>72)throw ApiException.bad("用户名须为3–40位字母数字下划线，密码须为8–72字节");
  if(register){try{jdbc.update("INSERT INTO app_user(username,password_hash,role) VALUES(?,?,'USER')",name,hashPassword(password));}catch(org.springframework.dao.DuplicateKeyException e){throw new ApiException(409,"USERNAME_EXISTS","用户名已存在");}}
  var users=jdbc.queryForList("SELECT * FROM app_user WHERE username=?",name);
  if(users.isEmpty()||!passwords.matches(password,String.valueOf(users.get(0).get("password_hash"))))throw new ApiException(401,"INVALID_CREDENTIALS","用户名或密码不正确");
  var row=users.get(0);User user=new User(Json.number(row.get("id")),name,String.valueOf(row.get("role")));
  return Json.map("token",token(user),"user",user);
 }
 private String enc(byte[] b){return Base64.getUrlEncoder().withoutPadding().encodeToString(b);}
 private byte[] sign(String text){try{Mac m=Mac.getInstance("HmacSHA256");m.init(new SecretKeySpec(secret,"HmacSHA256"));return m.doFinal(text.getBytes(StandardCharsets.UTF_8));}catch(Exception e){throw new IllegalStateException(e);}}
 private String token(User u){
  String head=enc("{\"alg\":\"HS256\",\"typ\":\"JWT\"}".getBytes(StandardCharsets.UTF_8));
  String body=enc(json.write(Json.map("sub",u.id(),"exp",Instant.now().plusSeconds(28800).getEpochSecond())).getBytes(StandardCharsets.UTF_8));
  return head+"."+body+"."+enc(sign(head+"."+body));
 }
 public User verify(String header){
  try{
   if(header==null||!header.startsWith("Bearer "))throw new IllegalArgumentException();
   String[] parts=header.substring(7).split("\\.");if(parts.length!=3)throw new IllegalArgumentException();
   if(!MessageDigest.isEqual(sign(parts[0]+"."+parts[1]),Base64.getUrlDecoder().decode(parts[2])))throw new IllegalArgumentException();
   Map<String,Object> claims=json.read(new String(Base64.getUrlDecoder().decode(parts[1]),StandardCharsets.UTF_8));
   if(Json.number(claims.get("exp"))<=Instant.now().getEpochSecond())throw new IllegalArgumentException();
   long id=Json.number(claims.get("sub"));
   long now=System.currentTimeMillis();var cached=userCache.get(id);if(cached!=null&&cached.until()>now)return cached.user();
   User user=jdbc.queryForObject("SELECT id,username,role FROM app_user WHERE id=?",(rs,n)->new User(rs.getLong(1),rs.getString(2),rs.getString(3)),id);
   if(userCache.size()>10000)userCache.clear();userCache.put(id,new CachedUser(user,now+30000));return user;
  }catch(org.springframework.dao.EmptyResultDataAccessException e){throw new ApiException(401,"UNAUTHORIZED","用户不存在");}
  catch(org.springframework.dao.DataAccessException e){throw e;}
  catch(Exception e){throw new ApiException(401,"UNAUTHORIZED","请登录或重新登录");}
 }
 public static User current(HttpServletRequest r){return (User)r.getAttribute("user");}
}
