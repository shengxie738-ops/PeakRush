package com.peakrush;
import org.springframework.http.*;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.servlet.resource.NoResourceFoundException;
import org.slf4j.*;
import java.util.Map;
@RestControllerAdvice
public class Errors {
 private static final Logger log=LoggerFactory.getLogger(Errors.class);
 @ExceptionHandler(ApiException.class) ResponseEntity<?> api(ApiException e){return ResponseEntity.status(e.status).body(Map.of("code",e.code,"message",e.getMessage()));}
 @ExceptionHandler({IllegalArgumentException.class,org.springframework.http.converter.HttpMessageNotReadableException.class,org.springframework.web.bind.MissingRequestHeaderException.class,org.springframework.beans.TypeMismatchException.class,ClassCastException.class})
 ResponseEntity<?> bad(Exception e){return ResponseEntity.badRequest().body(Map.of("code","INVALID_INPUT","message","输入参数不正确"));}
 @ExceptionHandler(NoResourceFoundException.class) ResponseEntity<?> missing(Exception e){return ResponseEntity.status(404).body(Map.of("code","NOT_FOUND","message","资源不存在"));}
 @ExceptionHandler(Exception.class) ResponseEntity<?> error(Exception e){log.error("Request failed",e);return ResponseEntity.status(503).body(Map.of("code","DEPENDENCY_UNAVAILABLE","message","服务暂不可用，请使用相同请求标识重试"));}
}
