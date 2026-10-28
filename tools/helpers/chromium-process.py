#!/usr/bin/env python3
"""Linux subreaper for one test browser, including detached crash/DBus helpers."""
import ctypes
import os
import signal
import subprocess
import sys
import time


def descendants(pid):
    # PPid metadata also covers children created by non-main threads. Never
    # inspect command lines or signal an unrelated runner process.
    graph = {}
    for entry in os.listdir("/proc"):
        if not entry.isdecimal():
            continue
        try:
            with open(f"/proc/{entry}/stat", encoding="utf-8", errors="replace") as source:
                stat = source.read()
            fields = stat[stat.rfind(")") + 2:].split()
            graph.setdefault(int(fields[1]), []).append((int(entry), fields[19]))
        except (FileNotFoundError, ProcessLookupError):
            pass
    result = []
    seen = {pid}

    def visit(parent):
        for child, birth in graph.get(parent, []):
            if child in seen:
                continue
            seen.add(child)
            visit(child)
            result.append((child, birth))

    visit(pid)
    return result


def main():
    libc = ctypes.CDLL(None, use_errno=True)
    if libc.prctl(36, 1, 0, 0, 0) != 0:  # PR_SET_CHILD_SUBREAPER
        raise OSError(ctypes.get_errno(), "Cannot supervise browser descendants")
    requested = 0

    def request(number, _frame):
        nonlocal requested
        requested = max(requested, 2 if number == signal.SIGUSR2 else 1)

    for number in (signal.SIGTERM, signal.SIGINT, signal.SIGUSR2):
        signal.signal(number, request)
    command = sys.argv[1:]
    receipt = None
    if command and command[0].startswith("--receipt="):
        receipt = command.pop(0).split("=", 1)[1]
    child = subprocess.Popen(command)
    closing = None
    result = None
    while True:
        status = child.poll()  # Only Popen reaps the command leader; preserve its status.
        if status is not None and result is None:
            result = status
        if (requested or result is not None) and closing is None:
            closing = time.monotonic()
        targets = descendants(os.getpid()) if closing is not None else []
        if closing is not None:
            hard = requested == 2 or time.monotonic() - closing >= 1
            for pid, birth in targets:
                try:
                    with open(f"/proc/{pid}/stat", encoding="utf-8", errors="replace") as source:
                        stat = source.read()
                    if stat[stat.rfind(")") + 2:].split()[19] == birth:
                        os.kill(pid, signal.SIGKILL if hard else signal.SIGTERM)
                except (FileNotFoundError, ProcessLookupError):
                    pass
        # Orphans (also setsid/double-fork helpers) are reparented here, not PID 1.
        for pid, _birth in targets:
            if pid == child.pid:
                continue
            try:
                os.waitpid(pid, os.WNOHANG)
            except (ChildProcessError, ProcessLookupError):
                pass
        if child.poll() is not None and not descendants(os.getpid()):
            status = result if result is not None else child.returncode
            if receipt:
                with open(receipt, "x", encoding="ascii") as target:
                    target.write("reaped\n")
            return status if status >= 0 else 128 - status
        time.sleep(0.02)


if __name__ == "__main__":
    sys.exit(main())
