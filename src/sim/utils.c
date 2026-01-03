/*
 * String helpers used by the ASM parser.
 *
 * Includes trimming, tokenization, and integer parsing.
 */
#include "../include/utils.h"
#include <string.h>
#include <ctype.h>
#include <stdlib.h>

// Remove comments and surrounding whitespace in-place.
void trim_line(char* s) {
    if (!s) return;

    // Couper au premier ';' (commentaire)
    char* p = strchr(s, ';');
    if (p) *p = '\0';

    // Rstrip (espaces, tab, \r, \n)
    size_t len = strlen(s);
    while (len > 0 && (s[len - 1] == ' ' || s[len - 1] == '\t' ||
                       s[len - 1] == '\r' || s[len - 1] == '\n')) {
        s[--len] = '\0';
    }

    // Lstrip
    char* start = s;
    while (*start == ' ' || *start == '\t') {
        start++;
    }
    if (start != s) {
        memmove(s, start, strlen(start) + 1);
    }
}

// Split a line into tokens by space/tab/comma delimiters.
int tokenize(char* line, char tokens[][32], int max_tokens) {
    int count = 0;
    const char* delim = " \t,"; // espace, tab, virgule

    char* tok = strtok(line, delim);
    while (tok && count < max_tokens) {
        strncpy(tokens[count], tok, 31);
        tokens[count][31] = '\0';
        count++;
        tok = strtok(NULL, delim);
    }
    return count;
}

// Parse a decimal or hex literal into int64_t.
bool parse_int64(const char* s, int64_t* out) {
    if (!s || !*s) return false;

    int sign = 1;
    if (*s == '+' || *s == '-') {
        if (*s == '-') sign = -1;
        s++;
    }

    int base = 10;
    if (s[0] == '0' && (s[1] == 'x' || s[1] == 'X')) {
        base = 16;
        s += 2;
    }

    if (*s == '\0') return false;

    char* end = NULL;
    long long val = strtoll(s, &end, base);
    if (*end != '\0') return false;

    *out = (int64_t)(sign * val);
    return true;
}
