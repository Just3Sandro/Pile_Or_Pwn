#include <stdlib.h>
#include <unistd.h>
#include <stdio.h>
#include <string.h>

void err(int exit_code, const char *message) {
    fprintf(stderr, "%s", message);
    exit(exit_code);
}

int main(int argc, char **argv)
{
  volatile int modified;
  char buffer[64];

  if(argc == 1) {
      err(1, "please specify an argument\n");
  }

  modified = 0;
  strcpy(buffer, argv[1]);

  if(modified == 0x61626364) {
      printf("you have correctly got the variable to the right value\n");
  } else {
      printf("Try again, you got 0x%08x\n", modified);
  }
}