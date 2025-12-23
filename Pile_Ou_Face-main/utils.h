/*
 * Utility helpers for parsing and tokenization.
 */
#ifndef UTILS_H
#define UTILS_H

#include <stdint.h>
#include <stdbool.h>

// Trim comments and whitespace in-place.
void trim_line(char* s);
// Tokenize a line into fixed-size token buffers.
int  tokenize(char* line, char tokens[][32], int max_tokens);
// Parse integer literal (decimal or hex).
bool parse_int64(const char* s, int64_t* out);

#endif
