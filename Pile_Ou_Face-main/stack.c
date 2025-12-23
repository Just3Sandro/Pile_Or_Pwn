#include "stack.h"
#include <stdio.h>

void stack_init(Stack* st) {
    if (!st) return;
    st->sp      = 0;
    st->next_id = 1;
}

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
