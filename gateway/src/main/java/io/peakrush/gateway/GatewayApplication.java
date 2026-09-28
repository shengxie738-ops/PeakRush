package io.peakrush.gateway;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
@SpringBootApplication
public class GatewayApplication {
 public static void main(String[] args) { SpringApplication.run(GatewayApplication.class,args); }
 @Bean RouteLocator apiRoutes(RouteLocatorBuilder routes,@Value("${peakrush.backend-uri}") String backend) {
  return routes.routes().route("peakrush-api",r->r.path("/api/**").uri(backend)).build();
 }
}

