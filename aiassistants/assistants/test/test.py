#!/usr/bin/env python
import sys

while True:
  inputs = sys.stdin.readline() # clean=/app/input.csv,messy=/app/input.csv
  cmd = sys.stdin.readline()    # completions | data
  query = sys.stdin.readline()  # e.g. geo=EU28

  if cmd == "completions\n":
    print("first completion\npath1")
    print("second completion\npath2")
    print("third completion\npath3")
    print("fourth completion\npath4")
    print("")
    sys.stdout.flush()
  else:
    f = open("test.csv","w+")
    f.write("one,two\n")
    f.write("1,2\n")
    f.write("3,4")
    f.close()
    print("test.csv")
    sys.stdout.flush()
