package com.peakrush;
import java.util.Map;
public record PurchaseEvent(String requestId,long userId,long activityId,long itemId,int quantity,String payloadHash,String generation,int version,long acceptedAt,boolean redisReserved) {
 public static PurchaseEvent from(Map<String,Object> m){return new PurchaseEvent(Json.string(m,"requestId"),Json.number(m.get("userId")),Json.number(m.get("activityId")),Json.number(m.get("itemId")),(int)Json.number(m.get("quantity")),Json.string(m,"payloadHash"),Json.string(m,"generation"),(int)Json.number(m.get("version")),Json.number(m.get("acceptedAt")),Boolean.parseBoolean(String.valueOf(m.get("redisReserved"))));}
}
