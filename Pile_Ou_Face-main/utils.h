#ifndef UTILS_H
#define UTILS_H

#include <stdint.h>
#include <stdbool.h>

void trim_line(char* s);
int  tokenize(char* line, char tokens[][32], int max_tokens);
bool parse_int64(const char* s, int64_t* out);

#endif
