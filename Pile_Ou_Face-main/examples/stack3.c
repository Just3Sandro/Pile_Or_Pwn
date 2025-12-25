/*
 * Deliberately vulnerable example used for stack overflow demos.
 *
 * Reads more than 64 bytes into buffer to overwrite adjacent data.
 * Uses a raw syscall so Unicorn can inject input via --stdin.
 */
#include <stdlib.h>
#include <unistd.h>
#include <stdio.h>
#include <string.h>

void win()
{
  printf("you have correctly got the variable to the right value\n");
}

// Minimal syscall wrapper (avoids libc PLT resolution).
static ssize_t sys_read(int fd, void *buf, size_t count)
{
  ssize_t ret;
#if defined(__x86_64__)
  __asm__ volatile (
    "mov $0, %%rax\n"
    "syscall\n"
    : "=a"(ret)
    : "D"(fd), "S"(buf), "d"(count)
    : "rcx", "r11", "memory"
  );
#else
  __asm__ volatile (
    "mov $3, %%eax\n"
    "int $0x80\n"
    : "=a"(ret)
    : "b"(fd), "c"(buf), "d"(count)
    : "memory"
  );
#endif
  return ret;
}

// Entry point: read input, then check if "modified" was overwritten.
int main(int argc, char **argv)
{
  volatile int modified;
  char buffer[74];

  (void)argc;
  (void)argv;

  modified = 0;
  sys_read(0, buffer, 256);

  if (modified == 0x43434343) {
    win();
  } else {
    printf("Try again, you got 0x%08x\n", modified);
  }
}
