#ifndef STACK_H
#define STACK_H

#include <stdint.h>
#include <stdbool.h>

#define STACK_MAX 1024

typedef struct {
    int     id;    // identifiant stable pour traquer la valeur
    int     size;  // en octets (8 pour 64 bits)
    int64_t value;
} StackEntry;

typedef struct {
    StackEntry data[STACK_MAX];
    int        sp;       // taille de la pile
    int        next_id;  // prochain id
} Stack;

void stack_init(Stack* st);
bool stack_push(Stack* st, int64_t value);
bool stack_pop(Stack* st, int64_t* out);

#endif
