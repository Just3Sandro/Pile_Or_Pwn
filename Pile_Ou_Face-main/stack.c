/*
 * Stack model for the ASM simulator.
 *
 * Stores 64-bit values with stable IDs for visualization.
 */
#include "stack.h"
#include <stdio.h>

// Initialize an empty stack with the next ID counter.
void stack_init(Stack* st) {
    if (!st) return;
    st->sp      = 0;
    st->next_id = 1;
}

// Push a value onto the stack and assign a stable ID.
bool stack_push(Stack* st, int64_t value) {
    if (!st) return false;
    if (st->sp >= STACK_MAX) {
        fprintf(stderr, "Erreur: dépassement de la pile (STACK_MAX=%d)\n", STACK_MAX);
        return false;
    }
    StackEntry* e = &st->data[st->sp++];
    e->id    = st->next_id++;
    e->size  = 8; // 64 bits
    e->value = value;
    return true;
}

// Pop a value from the stack (LIFO).
bool stack_pop(Stack* st, int64_t* out) {
    if (!st) return false;
    if (st->sp <= 0) {
        fprintf(stderr, "Erreur: pile vide, impossible de dépiler\n");
        return false;
    }
    st->sp--;
    if (out) {
        *out = st->data[st->sp].value;
    }
    return true;
}
