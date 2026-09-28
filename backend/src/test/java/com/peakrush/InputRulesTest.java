package com.peakrush;
import org.junit.jupiter.api.Test;
import java.math.BigDecimal;
import static org.junit.jupiter.api.Assertions.*;
class InputRulesTest {
 @Test void rejectsFractionalAndOverflowIntegers(){
  assertThrows(ApiException.class,()->Json.number(1.5));
  assertThrows(ApiException.class,()->Json.number(new BigDecimal("9223372036854775808")));
  assertEquals(2,Json.number(new BigDecimal("2.0")));
  assertThrows(ApiException.class,()->Store.positive(0,10));
 }
 @Test void priceCannotRoundToZeroOrSilentlyLosePrecision(){
  assertThrows(ApiException.class,()->Store.money("0.001"));
  assertThrows(ApiException.class,()->Store.money("-1"));
  assertEquals(new BigDecimal("19.90"),Store.money("19.9"));
 }
}
