CC = gcc
CFLAGS = -Wall -Wextra -O2 -std=c11 -Isrc/include

SRCDIR = src/sim
OBJDIR = build
SRCS = $(wildcard $(SRCDIR)/*.c)
OBJS = $(patsubst $(SRCDIR)/%.c, $(OBJDIR)/%.o, $(SRCS))

# Platform / arch aware bin dir (e.g. bin/darwin-arm64 or bin/linux-x64)
ifeq ($(OS),Windows_NT)
  PLATFORM := windows
else
  PLATFORM := $(shell uname -s | tr '[:upper:]' '[:lower:]' | sed -e 's/^mingw.*/windows/' -e 's/^msys.*/windows/' -e 's/^cygwin.*/windows/')
endif
ARCH := $(shell uname -m | sed -e 's/x86_64/x64/' -e 's/aarch64/arm64/' -e 's/i686/x86/' -e 's/armv7l/armv7l/')
BIN_DIR := bin/$(PLATFORM)-$(ARCH)
TARGET := $(BIN_DIR)/asm2json

.PHONY: all clean

all: $(TARGET)

$(BIN_DIR):
	mkdir -p $(BIN_DIR)

$(OBJDIR):
	mkdir -p $(OBJDIR)

$(OBJDIR)/%.o: $(SRCDIR)/%.c | $(OBJDIR)
	$(CC) $(CFLAGS) -c $< -o $@

$(TARGET): $(OBJS) | $(BIN_DIR)
	$(CC) $(CFLAGS) -o $@ $(OBJS)

clean:
	rm -rf $(OBJDIR) $(BIN_DIR)
