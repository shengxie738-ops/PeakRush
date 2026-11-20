package com.peakrush;

import org.springframework.context.annotation.DependsOn;
import org.springframework.stereotype.Service;
import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.Instant;
import java.util.*;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Runs scripts/verification_load.py for an existing experiment and imports the new report
 * back into the same row. Only one rerun may run at a time because the fixture creates real
 * activities and users against the shared local stack.
 */
@Service
@DependsOn("experimentSchema")
public class LoadReruns {
 private static final int OUTPUT_TAIL = 40;
 private static final String ACTIVITY_PREFIX = "[load] activity_id=";
 private final Store db;
 private final Json json;
 private final Admin admin;
 private final AtomicBoolean running = new AtomicBoolean();
 private final Map<String,Object> state = new LinkedHashMap<>();
 private volatile Process activeProcess;
 private volatile Long activeActivityId;
 private volatile boolean cancelRequested;

 record LoadPlan(int users, int rps, int seconds, int stock, boolean burst) {}

 public LoadReruns(Store db, Json json, Admin admin) {
  this.db = db;
  this.json = json;
  this.admin = admin;
 }

 public Map<String,Object> status() {
  synchronized (state) {
   if (state.isEmpty()) return Json.map("running", false);
   Map<String,Object> copy = new LinkedHashMap<>(state);
   Object output = state.get("output");
   if (output instanceof List<?> lines) copy.put("output", new ArrayList<>(lines));
   return copy;
  }
 }

 public Map<String,Object> cancel() {
  Process process = activeProcess;
  if (!running.get() || process == null) return status();
  cancelRequested = true;
  appendOutput("[load] 管理员请求停止压测，正在终止压测进程...");
  process.descendants().forEach(ProcessHandle::destroyForcibly);
  process.destroyForcibly();
  return status();
 }

 public Map<String,Object> start(long id) { return start(id, null); }

 public Map<String,Object> start(long id, Map<String,Object> overrides) {
  var row = db.one("SELECT id,CONCAT('V',architecture_version) AS version,release_version,load_mode,target_rps,concurrency_count,duration_seconds,stock,results_json FROM experiment WHERE id=?", id);
  LoadPlan plan = resolvePlan(row, overrides, json);
  Path root = resolveProjectRoot(Path.of("").toAbsolutePath().normalize());
  if (!running.compareAndSet(false, true))
   throw new ApiException(409, "RERUN_BUSY", "已有压测任务在运行，请等待完成");
  activeActivityId = null;
  cancelRequested = false;
  activeProcess = null;
  try {
   Path outputDir = root.resolve(".runtime").resolve("load-reports");
   Files.createDirectories(outputDir);
   List<String> command = new ArrayList<>(List.of(
    envOrDefault("PEAKRUSH_PYTHON", "python"),
    root.resolve("scripts").resolve("verification_load.py").toString(),
    "--base", envOrDefault("PEAKRUSH_GATEWAY_URI", "http://127.0.0.1:8080"),
    "--versions", String.valueOf(row.get("version")),
    "--users", String.valueOf(plan.users()),
    "--rps", String.valueOf(plan.rps()),
    "--seconds", String.valueOf(plan.seconds()),
    "--stock", String.valueOf(plan.stock()),
    "--experiment-id", String.valueOf(id),
    "--report-only",
    "--output-dir", outputDir.toAbsolutePath().toString()));
   if (plan.burst()) command.add("--burst");

   ProcessBuilder builder = new ProcessBuilder(command);
   builder.directory(root.toFile());
   builder.redirectErrorStream(true);
   builder.environment().put("PYTHONUTF8", "1");
   builder.environment().put("PYTHONIOENCODING", "utf-8");
   builder.environment().put("PYTHONUNBUFFERED", "1");
   Process process = builder.start();
   activeProcess = process;

   synchronized (state) {
    state.clear();
    state.put("experimentId", id);
    state.put("releaseVersion", row.get("release_version"));
    state.put("architectureVersion", row.get("version"));
    state.put("running", true);
    state.put("cancelled", false);
    state.put("startedAt", Instant.now().toString());
    state.put("users", plan.users());
    state.put("rps", plan.rps());
    state.put("seconds", plan.seconds());
    state.put("stock", plan.stock());
    state.put("burst", plan.burst());
    state.put("output", new ArrayList<String>());
   }

   Thread reader = new Thread(() -> {
    try (BufferedReader stdout = new BufferedReader(new InputStreamReader(process.getInputStream(), StandardCharsets.UTF_8))) {
     String line;
     while ((line = stdout.readLine()) != null) {
      Long parsedId = parseActivityId(line);
      if (parsedId != null) {
       activeActivityId = parsedId;
       continue;
      }
      appendOutput(line);
     }
    } catch (IOException ignored) {
    }
   });
   reader.setDaemon(true);
   reader.start();

   Thread waiter = new Thread(() -> {
    String message = "压测结束";
    int exitCode = -1;
    boolean cancelled = false;
    try {
     if (process.waitFor(30, TimeUnit.MINUTES)) {
      exitCode = process.exitValue();
      cancelled = cancelRequested;
      if (cancelled) message = "压测已由管理员手动停止";
      else message = exitCode == 0 ? "压测完成，结果已回填" : "压测进程退出码 " + exitCode + "，请查看下方输出";
     } else {
      process.descendants().forEach(ProcessHandle::destroyForcibly);
      process.destroyForcibly();
      process.waitFor(5, TimeUnit.SECONDS);
      message = "压测超时（30 分钟），已终止进程";
     }
     reader.join(2000);
    } catch (InterruptedException interrupted) {
     Thread.currentThread().interrupt();
     process.descendants().forEach(ProcessHandle::destroyForcibly);
     process.destroyForcibly();
     message = "压测被中断，已终止进程";
    } finally {
     Long aid = activeActivityId;
     if (aid != null && (cancelled || exitCode != 0)) {
      try {
       admin.lifecycle(aid, "offline");
       appendOutput("[load] 已自动下线临时压测活动 #" + aid);
      } catch (Exception ignored) {
      }
     }
     activeProcess = null;
     activeActivityId = null;
     synchronized (state) {
      state.put("running", false);
      state.put("cancelled", cancelled);
      state.put("finishedAt", Instant.now().toString());
      state.put("exitCode", exitCode);
      state.put("message", message);
     }
     running.set(false);
    }
   });
   waiter.setDaemon(true);
   waiter.start();
   return status();
  } catch (ApiException failure) {
   activeProcess = null;
   activeActivityId = null;
   cancelRequested = false;
   running.set(false);
   throw failure;
  } catch (IOException failure) {
   activeProcess = null;
   activeActivityId = null;
   cancelRequested = false;
   running.set(false);
   throw new ApiException(503, "RERUN_UNAVAILABLE", "无法启动压测脚本，请确认 python 在 PATH 中或设置 PEAKRUSH_PYTHON：" + failure.getMessage());
  }
 }

 @SuppressWarnings("unchecked")
 private void appendOutput(String line) {
  synchronized (state) {
   Object existing = state.get("output");
   List<String> tail = existing instanceof List<?> list ? new ArrayList<>((List<String>) list) : new ArrayList<>();
   tail.add(line);
   if (tail.size() > OUTPUT_TAIL) tail.remove(0);
   state.put("output", tail);
  }
 }

 static Long parseActivityId(String line) {
  if (line == null || !line.startsWith(ACTIVITY_PREFIX)) return null;
  String raw = line.substring(ACTIVITY_PREFIX.length()).trim();
  if (!raw.matches("[0-9]+")) return null;
  try { return Long.parseLong(raw); } catch (NumberFormatException ignored) { return null; }
 }

 static LoadPlan resolvePlan(Map<String,Object> row, Map<String,Object> overrides, Json json) {
  int users = (int) Json.number(row.get("concurrency_count"));
  int seconds = (int) Json.number(row.get("duration_seconds"));
  int stock = (int) Json.number(row.get("stock"));
  String dbMode = row.get("load_mode") == null ? "" : String.valueOf(row.get("load_mode")).trim().toUpperCase(Locale.ROOT);
  boolean burst = "BURST".equals(dbMode);
  int rps = row.get("target_rps") != null ? (int) Json.number(row.get("target_rps")) : users;
  boolean explicitConfig = row.get("target_rps") != null || burst;

  if (!explicitConfig && row.get("results_json") != null) {
   try {
    Map<String,Object> results = json.read(String.valueOf(row.get("results_json")));
    if (results.get("workload") instanceof Map<?,?> workload) {
     Object requested = workload.get("requestedRps");
     if (requested != null && Json.number(requested) > 0) rps = (int) Json.number(requested);
     Object model = workload.get("model");
     burst = model != null && String.valueOf(model).toLowerCase(Locale.ROOT).contains("burst");
    }
   } catch (RuntimeException ignored) {
    // Existing results may be hand-written; fall back to the experiment configuration.
   }
  }

  if (overrides != null && !overrides.isEmpty()) {
   if (overrides.get("users") != null) users = Store.positive(overrides.get("users"), 100000);
   if (overrides.get("seconds") != null) seconds = Store.positive(overrides.get("seconds"), 86400);
   if (overrides.get("stock") != null) stock = Store.positive(overrides.get("stock"), 1000000);
   if (overrides.get("rps") != null) rps = Store.positive(overrides.get("rps"), 100000);
   if (overrides.get("loadMode") != null) burst = "BURST".equals(Admin.loadMode(overrides.get("loadMode")));
   else if (overrides.get("burst") instanceof Boolean b) burst = b;
  }
  return new LoadPlan(users, rps, seconds, stock, burst);
 }

 static Path resolveProjectRoot(Path start) {
  for (Path dir = start; dir != null; dir = dir.getParent()) {
   if (Files.isRegularFile(dir.resolve("scripts").resolve("verification_load.py"))) return dir;
  }
  throw new ApiException(503, "RERUN_UNAVAILABLE", "未找到压测脚本 scripts/verification_load.py");
 }

 static String envOrDefault(String name, String fallback) {
  String value = System.getenv(name);
  return value == null || value.isBlank() ? fallback : value.trim();
 }
}
