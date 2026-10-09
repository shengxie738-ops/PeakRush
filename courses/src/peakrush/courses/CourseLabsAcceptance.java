package peakrush.courses;

import java.util.*;

/** Independent acceptance assertions; no application, Redis, MySQL or Kafka fixture. */
public final class CourseLabsAcceptance {
    public static void main(String[] args) throws Exception {
        Map<String, Object> report = CourseLabs.runAll(80, 40);
        verify(report);
        System.out.println("COURSE_ACCEPTANCE_PASSED");
    }

    @SuppressWarnings("unchecked")
    public static void verify(Map<String, Object> report) {
        List<Map<String, Object>> labs = (List<Map<String, Object>>) report.get("labs");
        require(labs != null && labs.size() == 10, "Expected ten real course experiments");
        Set<String> ids = new HashSet<>();
        for (var lab : labs) {
            ids.add((String) lab.get("id"));
            require("PASSED".equals(lab.get("status")), "Experiment failed: " + lab);
            require(((Number) lab.get("elapsedMs")).doubleValue() >= 0, "Missing measured duration");
        }
        require(ids.equals(Set.of("inventory-race", "deadlock", "monitor-producer-consumer",
                "condition-producer-consumer", "synchronizers", "bounded-thread-pool",
                "concurrent-containers", "thread-local", "completable-future", "blocking-io")),
                "Missing required course experiment");
        var race = details(labs, "inventory-race");
        var unsafe = (Map<String, Object>) race.get("unsafe");
        require(number(unsafe, "accepted") == 2 && number(unsafe, "remaining") == -1,
                "No deterministic oversell evidence");
        for (String name : List.of("synchronized", "reentrantLock", "atomicInteger")) {
            var safe = (Map<String, Object>) race.get(name);
            require(number(safe, "accepted") == 1 && number(safe, "remaining") == 0,
                    "Mutual exclusion did not preserve stock: " + name);
        }
        var deadlock = details(labs, "deadlock");
        require(Boolean.TRUE.equals(deadlock.get("detected")) && Boolean.TRUE.equals(deadlock.get("threadsTerminated")),
                "Deadlock must be detected and interruptibly terminated");
        for (String id : List.of("monitor-producer-consumer", "condition-producer-consumer")) {
            var pc = details(labs, id);
            require(number(pc, "produced") == 100 && number(pc, "consumed") == 100
                    && Boolean.TRUE.equals(pc.get("fifoPreserved")), "Lost/duplicated/reordered queue value");
        }
        var sync = details(labs, "synchronizers");
        require(number(sync, "peakPermitsInUse") == 3 && number(sync, "completed") == 12
                && number(sync, "barrierRounds") == 3, "Synchronizer contract failed");
        var pool = details(labs, "bounded-thread-pool");
        require(number(pool, "rejected") == 1 && number(pool, "completed") == 4,
                "Bounded executor did not reject saturation");
        require(((List<String>) pool.get("workerNames")).stream().allMatch(n -> n.startsWith("course-bounded-")),
                "Thread factory naming failed");
        WorkloadComparisons.validateThreadReuse((Map<String,Object>)pool.get("threadReuseComparison"));
        var maps = details(labs, "concurrent-containers");
        require(number((Map<String, Object>) maps.get("lockedHashMap"), "total") == 40000
                && number((Map<String, Object>) maps.get("concurrentHashMap"), "total") == 40000,
                "Container compound increments lost updates");
        var local = details(labs, "thread-local");
        require("alice".equals(local.get("leakedBeforeCleanup")) && local.get("afterCleanup") == null
                && Boolean.TRUE.equals(local.get("sameWorkerReused")), "ThreadLocal evidence incomplete");
        var futures = details(labs, "completable-future");
        require(number(futures, "combined") == 42 && number(futures, "allOfSum") == 6
                && Boolean.TRUE.equals(futures.get("exceptionPropagated")), "Async composition contract failed");
        WorkloadComparisons.validateAsyncComposition((Map<String,Object>)futures.get("interfaceComparison"));
        var io = details(labs, "blocking-io");
        var platform = (Map<String, Object>) io.get("platform");
        require(number(platform, "completed") == number(io, "tasks"), "TCP I/O did not complete all tasks");
        var virtual = (Map<String, Object>) io.get("virtual");
        require(Set.of("OK", "SKIPPED").contains(virtual.get("status")), "Invalid virtual-thread outcome");
        var environment = (Map<String, Object>) report.get("environment");
        require((number(environment, "javaFeature") >= 21 ? "OK" : "SKIPPED").equals(virtual.get("status")),
                "Virtual threads must run on a supported JDK and skip on JDK17");
        if ("OK".equals(virtual.get("status"))) {
            require(number(virtual, "completed") == number(io, "tasks"), "Virtual TCP I/O lost task");
        }
        require(Boolean.TRUE.equals(report.get("passed")), "Report does not indicate verified pass");
    }

    @SuppressWarnings("unchecked")
    private static Map<String, Object> details(List<Map<String, Object>> labs, String id) {
        return (Map<String, Object>) labs.stream().filter(l -> id.equals(l.get("id"))).findFirst().orElseThrow().get("details");
    }
    private static long number(Map<String, Object> value, String key) { return ((Number) value.get(key)).longValue(); }
    private static void require(boolean value, String message) { if (!value) throw new AssertionError(message); }
}
