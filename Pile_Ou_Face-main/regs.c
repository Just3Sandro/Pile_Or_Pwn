#include "regs.h"
#include <string.h>

void regs_init(RegFile* rf) {
    static const char* names[REG_COUNT] = {
        "rax", "rbx", "rcx", "rdx",
        "rsi", "rdi", "rbp", "rsp",
        "r8",  "r9",  "r10", "r11",
        "r12", "r13", "r14", "r15"
    };

    for (int i = 0; i < REG_COUNT; ++i) {
        rf->regs[i].name  = names[i];
        rf->regs[i].value = 0;
    }
}

int reg_index(const RegFile* rf, const char* name) {
    if (!rf || !name) return -1;
    for (int i = 0; i < REG_COUNT; ++i) {
        if (strcmp(rf->regs[i].name, name) == 0) {
            return i;
        }
    }
    return -1;
}

bool regs_get(const RegFile* rf, const char* name, int64_t* out) {
    int idx = reg_index(rf, name);
    if (idx < 0) return false;
    if (out) *out = rf->regs[idx].value;
    return true;
}

bool regs_set(RegFile* rf, const char* name, int64_t value) {
    int idx = reg_index(rf, name);
    if (idx < 0) return false;
    rf->regs[idx].value = value;
    return true;
}

int regs_count(const RegFile* rf) {
    (void)rf;
    return REG_COUNT;
}

const Reg* regs_at(const RegFile* rf, int index) {
    if (!rf || index < 0 || index >= REG_COUNT) return NULL;
    return &rf->regs[index];
}
