CC = gcc
CFLAGS = -Wall -Wextra -O2 -std=c11

OBJS = main.o parser.o utils.o stack.o regs.o

asm2json: $(OBJS)
	$(CC) $(CFLAGS) -o $@ $(OBJS)

%.o: %.c
	$(CC) $(CFLAGS) -c $<

clean:
	rm -f *.o asm2json
