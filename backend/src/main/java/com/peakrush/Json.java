package com.peakrush;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.springframework.stereotype.Component;
import java.util.*;
@Component
public class Json {
 private final ObjectMapper mapper;
 public Json(ObjectMapper mapper){this.mapper=mapper;}
 public String write(Object o){try{return mapper.writeValueAsString(o);}catch(Exception e){throw new IllegalArgumentException(e);}}
 public Map<String,Object> read(String s){try{return mapper.readValue(s,new TypeReference<Map<String,Object>>(){});}catch(Exception e){throw new IllegalArgumentException("Invalid event JSON",e);}}
 public static long number(Object x){try{return new java.math.BigDecimal(String.valueOf(x)).longValueExact();}catch(Exception e){throw ApiException.bad("需要有效的整数");}}
 public static String string(Map<String,Object> m,String k){return Objects.toString(m.get(k),"");}
 public static Map<String,Object> map(Object... kv){Map<String,Object> m=new LinkedHashMap<>();for(int i=0;i<kv.length;i+=2)m.put((String)kv[i],kv[i+1]);return m;}
}
