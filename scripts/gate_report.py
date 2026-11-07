"""Fail a pipeline when load-test reports miss their acceptance targets.
Example: python scripts/gate_report.py artifacts/load-V4-*.json
Exit code 0 only when every report carries targets.passed=true.
"""
import argparse,json,pathlib,sys

def failed_targets(report):
    """Return the names of unmet targets; a missing targets block is itself a failure."""
    targets=report.get("targets")
    if not isinstance(targets,dict) or targets.get("passed") is not True:
        return [name for name,value in (targets or {}).items() if name != "passed" and value is not True] or ["targets.passed"]
    return []

def main(argv=None):
    parser=argparse.ArgumentParser()
    parser.add_argument("reports",nargs="+",help="verification_load.py JSON report(s)")
    args=parser.parse_args(argv)
    failed=False
    for name in args.reports:
        try:
            report=json.loads(pathlib.Path(name).read_text(encoding="utf-8"))
        except (OSError,json.JSONDecodeError) as error:
            print(f"{name}: unreadable report: {error}")
            failed=True
            continue
        missing=failed_targets(report)
        if missing:
            print(f"{name}: unmet targets: {','.join(missing)}")
            failed=True
        else:
            print(f"{name}: passed")
    return 1 if failed else 0

if __name__=="__main__":
    sys.exit(main())
