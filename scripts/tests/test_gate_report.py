import contextlib
import io
import json
import pathlib
import sys
import tempfile
import unittest

TESTS = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(TESTS.parent))
import gate_report


class GateReportTest(unittest.TestCase):
    def test_passed_report_has_no_failures(self):
        self.assertEqual([], gate_report.failed_targets({"targets": {"passed": True, "p95Below500ms": True}}))

    def test_unmet_targets_are_named(self):
        report = {"targets": {"passed": False, "p95Below500ms": False, "ordersTerminal": True}}
        self.assertEqual(["p95Below500ms"], gate_report.failed_targets(report))

    def test_missing_targets_is_a_failure(self):
        self.assertEqual(["targets.passed"], gate_report.failed_targets({}))

    def test_cli_returns_one_for_unmet_report(self):
        with tempfile.TemporaryDirectory(dir=TESTS) as folder:
            passed = pathlib.Path(folder, "passed.json")
            failed = pathlib.Path(folder, "failed.json")
            passed.write_text(json.dumps({"targets": {"passed": True}}), encoding="utf-8")
            failed.write_text(json.dumps({"targets": {"passed": False, "qpsAtLeast1000": False}}), encoding="utf-8")
            with contextlib.redirect_stdout(io.StringIO()):
                self.assertEqual(0, gate_report.main([str(passed)]))
                self.assertEqual(1, gate_report.main([str(failed)]))


if __name__ == "__main__":
    unittest.main()
