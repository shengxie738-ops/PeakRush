package com.peakrush;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Test;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.Map;
import static org.junit.jupiter.api.Assertions.*;

class ExperimentConfigTest {
 private final Json json = new Json(new ObjectMapper());

 @Test void acceptsReleaseVersionV52AndRejectsMalformedOrOversized() {
  assertEquals("V5.2", Admin.releaseVersion(null));
  assertEquals("V5.2", Admin.releaseVersion("  "));
  assertEquals("V5.2", Admin.releaseVersion("V5.2"));
  assertEquals("V5.2", Admin.releaseVersion("v5.2"));
  assertEquals("V5", Admin.releaseVersion("V5"));
  assertThrows(ApiException.class, () -> Admin.releaseVersion("5.2"));
  assertThrows(ApiException.class, () -> Admin.releaseVersion("V" + "1".repeat(25)));
 }

 @Test void normalizesLoadModeAndRejectsUnsupportedModes() {
  assertEquals("STEADY", Admin.loadMode(null));
  assertEquals("STEADY", Admin.loadMode(""));
  assertEquals("BURST", Admin.loadMode("burst"));
  assertEquals("STEADY", Admin.loadMode("steady"));
  assertThrows(ApiException.class, () -> Admin.loadMode("SPIKE"));
 }

 @Test void resolvesLoadPlanFromExplicitConfigLegacyResultsAndOverrides() {
  Map<String,Object> explicit = new LinkedHashMap<>();
  explicit.put("concurrency_count", 200);
  explicit.put("duration_seconds", 30);
  explicit.put("stock", 100);
  explicit.put("load_mode", "BURST");
  explicit.put("target_rps", null);
  var burstPlan = LoadReruns.resolvePlan(explicit, null, json);
  assertEquals(new LoadReruns.LoadPlan(200, 200, 30, 100, true), burstPlan);

  Map<String,Object> legacyBurst = new LinkedHashMap<>();
  legacyBurst.put("concurrency_count", 2000);
  legacyBurst.put("duration_seconds", 30);
  legacyBurst.put("stock", 1000);
  legacyBurst.put("load_mode", "STEADY");
  legacyBurst.put("target_rps", null);
  legacyBurst.put("results_json", "{\"workload\":{\"requestedRps\":1100,\"model\":\"barrier-released burst\"}}");
  var inferred = LoadReruns.resolvePlan(legacyBurst, null, json);
  assertEquals(new LoadReruns.LoadPlan(2000, 1100, 30, 1000, true), inferred);

  var overridden = LoadReruns.resolvePlan(legacyBurst, Json.map("rps", 500, "loadMode", "STEADY", "seconds", 10), json);
  assertEquals(new LoadReruns.LoadPlan(2000, 500, 10, 1000, false), overridden);
 }

 @Test void locatesProjectRootFromWorkingDirectoryOrParent() {
  Path cwd = Path.of("").toAbsolutePath().normalize();
  Path root = LoadReruns.resolveProjectRoot(cwd);
  assertTrue(java.nio.file.Files.isRegularFile(root.resolve("scripts").resolve("verification_load.py")));
 }

 @Test void parsesTemporaryActivityIdLinesSafely() {
  assertEquals(91L, LoadReruns.parseActivityId("[load] activity_id=91"));
  assertNull(LoadReruns.parseActivityId("[load] [1/5] 正在准备"));
  assertNull(LoadReruns.parseActivityId("[load] activity_id=abc"));
  assertNull(LoadReruns.parseActivityId(null));
 }
}
