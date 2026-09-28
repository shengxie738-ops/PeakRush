package com.peakrush;
import jakarta.servlet.http.*;
import org.springframework.context.annotation.Configuration;
import org.springframework.web.servlet.config.annotation.*;
import org.springframework.web.servlet.HandlerInterceptor;
import io.micrometer.core.instrument.*;
import java.util.concurrent.TimeUnit;
@Configuration
public class WebConfig implements WebMvcConfigurer {
 private final Auth auth; private final MeterRegistry registry;
 public WebConfig(Auth auth,MeterRegistry registry){this.auth=auth;this.registry=registry;}
 @Override public void addInterceptors(InterceptorRegistry interceptors){
  interceptors.addInterceptor(new HandlerInterceptor(){
   public boolean preHandle(HttpServletRequest r,HttpServletResponse response,Object handler){
    r.setAttribute("started",System.nanoTime());
    String p=r.getRequestURI();
    if(p.equals("/api/auth/login")||p.equals("/api/auth/register")||(r.getMethod().equals("GET")&&p.startsWith("/api/seckill/activities")))return true;
    Auth.User u=auth.verify(r.getHeader("Authorization"));r.setAttribute("user",u);
    if(p.startsWith("/api/admin/")&&!u.role().equals("ADMIN"))throw new ApiException(403,"FORBIDDEN","需要管理员权限");
    return true;
   }
   public void afterCompletion(HttpServletRequest r,HttpServletResponse response,Object handler,Exception e){
    Object start=r.getAttribute("started");if(start!=null)Timer.builder("peakrush.api.duration").tag("outcome",response.getStatus()>=500?"error":"ok").publishPercentiles(.95).register(registry).record(System.nanoTime()-(long)start,TimeUnit.NANOSECONDS);
   }
  }).addPathPatterns("/api/**");
 }
}
