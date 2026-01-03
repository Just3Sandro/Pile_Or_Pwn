import os
import subprocess

def greet(name):
    return f"Hello {name}"

# Risky patterns for AST demo
os.system("echo demo")
subprocess.run("echo via subprocess", shell=True)
value = eval("1 + 2")
print(greet("Pile ou Face"), value)
